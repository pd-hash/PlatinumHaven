package com.platinumhaven.app.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.platinumhaven.app.R
import com.platinumhaven.app.databinding.FragmentConfirmationBinding
import java.text.SimpleDateFormat
import java.util.Locale

class ConfirmationFragment : Fragment() {

    private var _binding: FragmentConfirmationBinding? = null
    private val binding get() = _binding!!
    private val inputDateTimeFormat = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
    private val outputDateTimeFormat = SimpleDateFormat("MMMM d, yyyy 'at' h:mm a", Locale.getDefault())

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentConfirmationBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.tvReservationNo.text = arguments?.getString("reservationNo") ?: "-"
        binding.tvCheckIn.text = formatBookingDateTime(arguments?.getString("checkIn") ?: "")
        binding.tvCheckOut.text = formatBookingDateTime(arguments?.getString("checkOut") ?: "")
        binding.tvTotal.text = arguments?.getString("total") ?: "-"

        binding.btnDone.setOnClickListener {
            findNavController().navigate(R.id.action_confirmation_to_home)
        }

        binding.btnReceipt.setOnClickListener {
            findNavController().navigate(R.id.action_confirmation_to_bookings)
        }
    }

    private fun formatBookingDateTime(value: String): String {
        if (value.isBlank()) return "-"
        return try {
            val parsed = inputDateTimeFormat.parse(value)
            if (parsed != null) outputDateTimeFormat.format(parsed) else value
        } catch (_: Exception) {
            value
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
