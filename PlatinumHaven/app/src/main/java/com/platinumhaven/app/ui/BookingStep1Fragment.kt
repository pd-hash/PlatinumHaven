package com.platinumhaven.app.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.content.res.AppCompatResources
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.bumptech.glide.Glide
import com.platinumhaven.app.R
import com.platinumhaven.app.data.TokenStore
import com.platinumhaven.app.databinding.FragmentBookingStep1Binding
import java.text.SimpleDateFormat
import java.util.Locale

class BookingStep1Fragment : Fragment() {

    private var _binding: FragmentBookingStep1Binding? = null
    private val binding get() = _binding!!

    private var roomId = ""
    private var roomName = ""
    private var roomPrice = 0f
    private var roomImage = ""
    private var maxGuests = 2
    private var checkIn = ""
    private var checkOut = ""
    private var totalPrice = 0f

    private val inputDateTimeFormat = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
    private val outputDateTimeFormat = SimpleDateFormat("MMMM d, yyyy 'at' h:mm a", Locale.getDefault())

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentBookingStep1Binding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        roomId = arguments?.getString("roomId") ?: ""
        roomName = arguments?.getString("roomName") ?: ""
        roomPrice = arguments?.getFloat("roomPrice") ?: 0f
        roomImage = arguments?.getString("roomImage") ?: ""
        maxGuests = arguments?.getInt("roomGuests") ?: 2
        checkIn = arguments?.getString("checkIn") ?: ""
        checkOut = arguments?.getString("checkOut") ?: ""
        totalPrice = arguments?.getFloat("totalPrice") ?: 0f

        binding.tvRoomName.text = roomName
        binding.tvRoomPrice.text = "P${String.format("%,.0f", roomPrice)}/night"

        val localImage = getLocalImage(roomName)
        if (roomImage.isNotEmpty()) {
            Glide.with(this).load(roomImage)
                .placeholder(localImage).error(localImage)
                .centerCrop().into(binding.ivRoom)
        } else {
            binding.ivRoom.setImageResource(localImage)
        }

        binding.tvCheckIn.text = formatBookingDateTime(checkIn)
        binding.tvCheckOut.text = formatBookingDateTime(checkOut)
        binding.tvTotal.text = "P${String.format("%,.0f", totalPrice)}"

        binding.etFullName.setText(TokenStore.getUserName(requireContext()) ?: "")
        binding.etAdults.setText("1")
        binding.etChildren.setText("0")

        styleBackButton()
        binding.btnBack.setOnClickListener { findNavController().popBackStack() }

        binding.btnContinue.setOnClickListener {
            val fullName = binding.etFullName.text.toString().trim()
            val adults = binding.etAdults.text.toString().trim().toIntOrNull()
            val children = binding.etChildren.text.toString().trim().toIntOrNull()
            val special = binding.etSpecialRequests.text.toString().trim()

            when {
                checkIn.isEmpty() -> showError("No check-in date selected. Go back and select dates.")
                checkOut.isEmpty() -> showError("No check-out date selected. Go back and select dates.")
                fullName.isEmpty() -> showError("Please enter your full name")
                adults == null -> showError("Please enter the number of adults")
                children == null -> showError("Please enter the number of children")
                adults < 1 -> showError("At least 1 adult is required")
                children < 0 -> showError("Children cannot be negative")
                adults + children > maxGuests ->
                    showError("This room allows up to $maxGuests guest${if (maxGuests > 1) "s" else ""}")
                else -> {
                    binding.tvError.visibility = View.GONE
                    val bundle = Bundle().apply {
                        putString("roomId", roomId)
                        putString("roomName", roomName)
                        putFloat("roomPrice", roomPrice)
                        putString("roomImage", roomImage)
                        putString("checkIn", checkIn)
                        putString("checkOut", checkOut)
                        putInt("guests", adults + children)
                        putInt("adults", adults)
                        putInt("children", children)
                        putString("specialRequests", special)
                        putFloat("totalPrice", totalPrice)
                    }
                    findNavController().navigate(R.id.action_step1_to_step2, bundle)
                }
            }
        }
    }

    private fun showError(msg: String) {
        binding.tvError.text = msg
        binding.tvError.visibility = View.VISIBLE
    }

    private fun styleBackButton() {
        binding.btnBack.apply {
            background = AppCompatResources.getDrawable(context, R.drawable.bg_back_button)
            setImageDrawable(AppCompatResources.getDrawable(context, R.drawable.ic_back_chevron))
            imageTintList = null
        }
    }

    private fun formatBookingDateTime(value: String): String {
        if (value.isBlank()) return "Not selected"
        return try {
            val parsed = inputDateTimeFormat.parse(value)
            if (parsed != null) outputDateTimeFormat.format(parsed) else value
        } catch (_: Exception) {
            value
        }
    }

    private fun getLocalImage(name: String): Int = when {
        name.contains("Classic", ignoreCase = true) -> R.drawable.room_classic
        name.contains("Standard", ignoreCase = true) -> R.drawable.room_standard
        name.contains("Deluxe", ignoreCase = true) -> R.drawable.room_deluxe1
        name.contains("Presidential", ignoreCase = true) -> R.drawable.room_presidential1
        name.contains("Family", ignoreCase = true) -> R.drawable.room_family1
        else -> R.drawable.room_classic
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
