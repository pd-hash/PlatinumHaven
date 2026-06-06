package com.platinumhaven.app.ui

import android.os.Bundle
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.platinumhaven.app.R
import com.platinumhaven.app.data.Reservation
import com.platinumhaven.app.databinding.FragmentBookingsBinding
import com.platinumhaven.app.databinding.ItemBookingBinding
import com.platinumhaven.app.viewmodel.ReservationsViewModel
import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class BookingsFragment : Fragment() {

    private var _binding: FragmentBookingsBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ReservationsViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentBookingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val adapter = BookingAdapter(
            onCancel = { reservation ->
                AlertDialog.Builder(requireContext())
                    .setTitle("Cancel Booking")
                    .setMessage("Are you sure you want to cancel ${reservation.reservation_no}?")
                    .setPositiveButton("Yes, Cancel") { _, _ ->
                        viewModel.cancelReservation(requireContext(), reservation.id)
                    }
                    .setNegativeButton("No", null)
                    .show()
            },
            onReview = { reservation ->
                try {
                    val bundle = Bundle().apply {
                        putString("reservationId", reservation.id)
                    }
                    findNavController().navigate(R.id.action_bookings_to_feedback, bundle)
                } catch (e: Exception) {
                    Toast.makeText(requireContext(),
                        "Error opening review: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        )

        binding.rvBookings.layoutManager = LinearLayoutManager(requireContext())
        binding.rvBookings.adapter = adapter

        viewModel.reservations.observe(viewLifecycleOwner) { list ->
            adapter.submitList(list)
            binding.layoutEmpty.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
            binding.rvBookings.visibility  = if (list.isEmpty()) View.GONE   else View.VISIBLE
        }

        viewModel.loading.observe(viewLifecycleOwner) { loading ->
            binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        }

        viewModel.cancelResult.observe(viewLifecycleOwner) { result ->
            result ?: return@observe
            result.onSuccess {
                Toast.makeText(requireContext(),
                    "Booking cancelled successfully", Toast.LENGTH_SHORT).show()
            }
            result.onFailure { e ->
                Toast.makeText(requireContext(), e.message, Toast.LENGTH_SHORT).show()
            }
            viewModel.clearCancelResult()
        }

        viewModel.loadReservations(requireContext())
    }

    override fun onResume() {
        super.onResume()
        // Reload when returning from feedback screen
        viewModel.clearCancelResult()
        viewModel.loadReservations(requireContext())
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

// ── Booking Adapter ───────────────────────────────────────────
class BookingAdapter(
    private val onCancel: (Reservation) -> Unit,
    private val onReview: (Reservation) -> Unit
) : RecyclerView.Adapter<BookingAdapter.BookingViewHolder>() {

    private val reservationDateFormats = listOf(
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        },
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        },
        SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()),
        SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()),
        SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    )

    private var list = listOf<Reservation>()

    fun submitList(newList: List<Reservation>) {
        list = newList
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): BookingViewHolder {
        val binding = ItemBookingBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return BookingViewHolder(binding)
    }

    override fun onBindViewHolder(holder: BookingViewHolder, position: Int) {
        holder.bind(list[position])
    }

    override fun getItemCount() = list.size

    inner class BookingViewHolder(private val binding: ItemBookingBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(r: Reservation) {
            binding.tvRoomName.text      = r.room_name
            binding.tvDates.text         = "${r.check_in.take(10)} → ${r.check_out.take(10)}"
            binding.tvReservationNo.text = r.reservation_no
            binding.tvStatus.text        = r.status

            // Status badge color
            val badgeColor = when (r.status) {
                "Confirmed"  -> 0xFF1A7F4B.toInt()
                "Pending"    -> 0xFFB87A00.toInt()
                "Cancelled"  -> 0xFFC0392B.toInt()
                "Completed"  -> 0xFF2563EB.toInt()
                "Holding"    -> 0xFF7C3AED.toInt()
                else         -> 0xFF6B7280.toInt()
            }
            binding.tvStatus.backgroundTintList =
                android.content.res.ColorStateList.valueOf(badgeColor)

            // Room image
            val localImage = when {
                r.room_name.contains("Classic", ignoreCase = true)      -> R.drawable.room_classic
                r.room_name.contains("Standard", ignoreCase = true)     -> R.drawable.room_standard
                r.room_name.contains("Deluxe", ignoreCase = true)       -> R.drawable.room_deluxe1
                r.room_name.contains("Presidential", ignoreCase = true) -> R.drawable.room_presidential1
                r.room_name.contains("Family", ignoreCase = true)       -> R.drawable.room_family1
                else                                                     -> R.drawable.room_classic
            }
            if (!r.room_image_url.isNullOrEmpty()) {
                Glide.with(binding.root.context)
                    .load(r.room_image_url)
                    .placeholder(localImage)
                    .error(localImage)
                    .centerCrop()
                    .into(binding.ivRoom)
            } else {
                binding.ivRoom.setImageResource(localImage)
            }

            // Cancel button — only for Pending or Confirmed
            val canCancel = r.status in listOf("Pending", "Confirmed")
            binding.btnCancel.visibility = if (canCancel) View.VISIBLE else View.GONE
            binding.btnCancel.setOnClickListener { onCancel(r) }

            // Review button — only for Completed AND not yet reviewed
            val canReview = canLeaveReview(r)
            binding.btnReview.visibility = if (canReview) View.VISIBLE else View.GONE
            binding.btnReview.isEnabled  = canReview
            binding.btnReview.text = buildReviewButtonText()
            binding.btnReview.setOnClickListener {
                if (canReview) onReview(r)
            }
        }

        private fun buildReviewButtonText(): SpannableString {
            val text = SpannableString("\u2605 Review")
            text.setSpan(
                ForegroundColorSpan(0xFFF59E0B.toInt()),
                0,
                1,
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )
            text.setSpan(
                ForegroundColorSpan(0xFF2D6A4F.toInt()),
                2,
                text.length,
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )
            return text
        }

        private fun canLeaveReview(reservation: Reservation): Boolean {
            if (reservation.has_reviewed == true) return false
            if (reservation.status == "Completed") return true

            val checkOut = parseReservationDate(reservation.check_out) ?: return false
            val now = Calendar.getInstance().time
            return !checkOut.after(now) && reservation.status != "Cancelled"
        }

        private fun parseReservationDate(value: String): Date? {
            for (format in reservationDateFormats) {
                try {
                    return format.parse(value)
                } catch (_: ParseException) {
                }
            }
            return null
        }
    }
}
