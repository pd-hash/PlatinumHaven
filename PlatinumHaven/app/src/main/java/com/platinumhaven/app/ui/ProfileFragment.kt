package com.platinumhaven.app.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import com.bumptech.glide.Glide
import com.platinumhaven.app.R
import com.platinumhaven.app.data.TokenStore
import com.platinumhaven.app.databinding.FragmentProfileBinding
import com.platinumhaven.app.viewmodel.ReservationsViewModel

class ProfileFragment : Fragment() {

    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ReservationsViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val name  = TokenStore.getUserName(requireContext()) ?: "Guest"
        val email = TokenStore.getUserEmail(requireContext()) ?: ""

        binding.tvName.text   = name
        binding.tvEmail.text  = email
        binding.tvAvatar.text = name.firstOrNull()?.uppercaseChar()?.toString() ?: "G"

        // View All bookings
        binding.tvViewAll.setOnClickListener {
            findNavController().navigate(R.id.bookingsFragment)
        }

        // Load recent bookings
        viewModel.reservations.observe(viewLifecycleOwner) { list ->
            binding.llRecentBookings.removeAllViews()
            list.take(3).forEach { r ->
                val item = layoutInflater.inflate(R.layout.item_booking_recent, binding.llRecentBookings, false)
                item.findViewById<TextView>(R.id.tvRoomName).text = r.room_name
                item.findViewById<TextView>(R.id.tvDates).text =
                    "${r.check_in.take(10)} - ${r.check_out.take(10)}"
                item.findViewById<TextView>(R.id.tvResNo).text = r.reservation_no

                val statusView = item.findViewById<TextView>(R.id.tvStatus)
                statusView.text = r.status
                val color = when (r.status) {
                    "Confirmed"  -> 0xFF1A7F4B.toInt()
                    "Pending"    -> 0xFFB87A00.toInt()
                    "Cancelled"  -> 0xFFC0392B.toInt()
                    "Completed"  -> 0xFF2563EB.toInt()
                    else         -> 0xFF6B7280.toInt()
                }
                statusView.backgroundTintList =
                    android.content.res.ColorStateList.valueOf(color)

                // Use local drawable mapping
                Glide.with(this)
                    .load(r.getDrawableRes())
                    .centerCrop()
                    .into(item.findViewById(R.id.ivRoom))

                binding.llRecentBookings.addView(item)
            }
        }
        viewModel.loadReservations(requireContext())

        // Logout
        binding.layoutLogout.setOnClickListener {
            TokenStore.clear(requireContext())
            findNavController().navigate(R.id.loginFragment)
        }

        binding.layoutPersonalInfo.setOnClickListener {
            findNavController().navigate(R.id.personalInfoFragment)
        }

    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
