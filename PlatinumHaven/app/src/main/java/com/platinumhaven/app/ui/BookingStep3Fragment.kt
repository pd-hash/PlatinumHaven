package com.platinumhaven.app.ui

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.content.res.AppCompatResources
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import com.platinumhaven.app.R
import com.platinumhaven.app.data.TokenStore
import com.platinumhaven.app.databinding.FragmentBookingStep3Binding
import com.platinumhaven.app.viewmodel.BookingViewModel
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.concurrent.TimeUnit

class BookingStep3Fragment : Fragment() {

    private var _binding: FragmentBookingStep3Binding? = null
    private val binding get() = _binding!!
    private val bookingViewModel: BookingViewModel by viewModels()

    private var roomId = ""
    private var roomName = ""
    private var roomImage = ""
    private var checkIn = ""
    private var checkOut = ""
    private var guests = 1
    private var adults = 1
    private var children = 0
    private var specialRequests = ""
    private var totalPrice = 0f
    private var addonIds = ""
    private var isProcessingPayPalCallback = false

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentBookingStep3Binding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        roomId = arguments?.getString("roomId") ?: ""
        roomName = arguments?.getString("roomName") ?: ""
        roomImage = arguments?.getString("roomImage") ?: ""
        checkIn = arguments?.getString("checkIn") ?: ""
        checkOut = arguments?.getString("checkOut") ?: ""
        guests = arguments?.getInt("guests") ?: 1
        adults = arguments?.getInt("adults") ?: 1
        children = arguments?.getInt("children") ?: 0
        specialRequests = arguments?.getString("specialRequests") ?: ""
        totalPrice = arguments?.getFloat("totalPrice") ?: 0f
        addonIds = arguments?.getString("addonIds") ?: ""

        binding.tvTotalAmount.text = "P${String.format("%,.0f", totalPrice)}"
        binding.tvBottomTotal.text = "P${String.format("%,.0f", totalPrice)}"
        binding.tvGuests.text = "$guests Guest${if (guests > 1) "s" else ""}"

        try {
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val d1 = sdf.parse(checkIn.take(10))
            val d2 = sdf.parse(checkOut.take(10))
            if (d1 != null && d2 != null) {
                val nights = TimeUnit.MILLISECONDS.toDays(d2.time - d1.time)
                binding.tvNights.text = "$nights Night${if (nights > 1) "s" else ""}"
            }
        } catch (_: Exception) {
            binding.tvNights.text = "-"
        }

        binding.layoutPaypal.setOnClickListener { selectPaypal() }
        binding.rbPaypal.setOnClickListener { selectPaypal() }
        selectPaypal()

        styleBackButton()
        binding.btnBack.setOnClickListener { findNavController().popBackStack() }
        binding.btnConfirm.setOnClickListener {
            launchPayPalCheckout()
        }

        bookingViewModel.bookingResult.observe(viewLifecycleOwner) { result ->
            result.onSuccess { booking ->
                if (binding.rbPaypal.isChecked) {
                    bookingViewModel.onPaypalPaymentSuccess(
                        requireContext(),
                        booking.reservation_no,
                        "P${String.format("%,.0f", booking.total_amount)}"
                    )
                }
                val bundle = Bundle().apply {
                    putString("reservationNo", booking.reservation_no)
                    putString("roomName", roomName)
                    putString("checkIn", checkIn)
                    putString("checkOut", checkOut)
                    putString("total", "P${String.format("%,.0f", booking.total_amount)}")
                }
                findNavController().navigate(R.id.action_step3_to_confirmation, bundle)
            }

            result.onFailure { error ->
                binding.tvError.text = error.message ?: "Booking failed. Please try again."
                binding.tvError.visibility = View.VISIBLE
                binding.btnConfirm.isEnabled = true
                binding.btnConfirm.text = "Continue with PayPal"
            }
        }

        bookingViewModel.loading.observe(viewLifecycleOwner) { loading ->
            binding.btnConfirm.isEnabled = !loading
            binding.btnConfirm.text = when {
                loading && binding.rbPaypal.isChecked && isProcessingPayPalCallback -> "Finalizing PayPal..."
                loading && binding.rbPaypal.isChecked -> "Opening PayPal..."
                binding.rbPaypal.isChecked -> "Continue with PayPal"
                else -> "Continue with PayPal"
            }
        }

        bookingViewModel.payPalOrderResult.observe(viewLifecycleOwner) { result ->
            result.onSuccess { order ->
                val approveUrl = order.approveUrl
                if (approveUrl.isNullOrBlank()) {
                    resetPayPalState()
                    showError("PayPal approval link is missing. Please try again.")
                    return@onSuccess
                }

                TokenStore.savePendingPayPalOrder(requireContext(), order.orderId)
                startActivity(
                    android.content.Intent(requireContext(), PayPalCheckoutActivity::class.java)
                        .putExtra(PayPalCheckoutActivity.EXTRA_APPROVE_URL, approveUrl)
                )
            }

            result.onFailure { error ->
                resetPayPalState()
                showError(error.message ?: "Unable to start PayPal checkout.")
            }
        }

        bookingViewModel.payPalCaptureResult.observe(viewLifecycleOwner) { result ->
            isProcessingPayPalCallback = false

            result.onSuccess { capture ->
                if (capture.captureStatus.equals("COMPLETED", ignoreCase = true) ||
                    capture.status.equals("COMPLETED", ignoreCase = true)
                ) {
                    TokenStore.clearPendingPayPalOrder(requireContext())
                    TokenStore.clearPayPalCallback(requireContext())
                    Toast.makeText(requireContext(), "PayPal payment approved!", Toast.LENGTH_SHORT).show()
                    submitBooking("PayPal")
                } else {
                    resetPayPalState()
                    showError("PayPal payment was not completed.")
                }
            }

            result.onFailure { error ->
                resetPayPalState()
                showError(error.message ?: "Unable to capture PayPal payment.")
            }
        }
    }

    private fun styleBackButton() {
        binding.btnBack.apply {
            background = AppCompatResources.getDrawable(context, R.drawable.bg_back_button)
            setImageDrawable(AppCompatResources.getDrawable(context, R.drawable.ic_back_chevron))
            imageTintList = null
        }
    }

    override fun onResume() {
        super.onResume()
        processPayPalCallbackIfNeeded()
    }

    private fun selectPaypal() {
        binding.tvError.visibility = View.GONE
        binding.rbPaypal.isChecked = true
        binding.layoutPaypal.setBackgroundResource(R.drawable.bg_payment_selected)
        binding.btnConfirm.text = "Continue with PayPal"
    }

    private fun launchPayPalCheckout() {
        binding.tvError.visibility = View.GONE
        isProcessingPayPalCallback = false
        bookingViewModel.createPayPalOrder(
            context = requireContext(),
            amount = totalPrice.toDouble(),
            description = "The Platinum Haven - $roomName"
        )
    }

    private fun processPayPalCallbackIfNeeded() {
        if (isProcessingPayPalCallback) return

        val callback = TokenStore.getPayPalCallback(requireContext()) ?: return
        val pendingOrderId = TokenStore.getPendingPayPalOrder(requireContext()) ?: return
        val uri = Uri.parse(callback)

        if (uri.scheme != "platinumhavenpay" || uri.host != "checkout") return

        when (uri.path) {
            "/cancel" -> {
                TokenStore.clearPayPalCallback(requireContext())
                TokenStore.clearPendingPayPalOrder(requireContext())
                resetPayPalState()
                showError("PayPal payment cancelled.")
            }

            "/return" -> {
                val orderId = uri.getQueryParameter("token") ?: pendingOrderId
                if (orderId != pendingOrderId) return

                TokenStore.clearPayPalCallback(requireContext())
                isProcessingPayPalCallback = true
                bookingViewModel.capturePayPalOrder(requireContext(), orderId)
            }
        }
    }

    private fun submitBooking(paymentMethod: String) {
        binding.tvError.visibility = View.GONE
        val addonList = if (addonIds.isEmpty()) emptyList() else addonIds.split(",").filter { it.isNotEmpty() }
        bookingViewModel.selectedAddonIds.clear()
        bookingViewModel.selectedAddonIds.addAll(addonList)
        bookingViewModel.createBooking(
            context = requireContext(),
            roomId = roomId,
            checkIn = checkIn,
            checkOut = checkOut,
            guests = guests,
            adults = adults,
            children = children,
            specialRequests = specialRequests,
            paymentMethod = paymentMethod,
            roomName = roomName,
            totalAmount = totalPrice.toDouble()
        )
    }

    private fun resetPayPalState() {
        binding.btnConfirm.isEnabled = true
        isProcessingPayPalCallback = false
        selectPaypal()
    }

    private fun showError(message: String) {
        binding.tvError.text = message
        binding.tvError.visibility = View.VISIBLE
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
