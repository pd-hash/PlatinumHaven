package com.platinumhaven.app.ui

import android.os.Bundle
import android.text.SpannableString
import android.text.Spanned
import android.text.Editable
import android.text.TextWatcher
import android.text.style.ForegroundColorSpan
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.platinumhaven.app.R
import com.platinumhaven.app.data.Room
import com.platinumhaven.app.data.TokenStore
import com.platinumhaven.app.databinding.FragmentHomeBinding
import com.platinumhaven.app.databinding.ItemRoomHomeBinding
import com.platinumhaven.app.viewmodel.RoomsViewModel
import java.util.Locale

class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!
    private val viewModel: RoomsViewModel by viewModels()
    private var selectedFilter = "All"

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // User info
        val name = TokenStore.getUserName(requireContext()) ?: "Guest"
        binding.tvUserName.text = name
        binding.tvAvatarInitial.text = name.firstOrNull()?.uppercaseChar()?.toString() ?: "G"

        // RecyclerView
        val adapter = RoomListAdapter { room -> navigateToDetail(room) }
        binding.rvRooms.layoutManager = LinearLayoutManager(requireContext())
        binding.rvRooms.adapter = adapter

        // Search
        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { loadRooms(search = s.toString()) }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        // Filter buttons
        val filterButtons = listOf(
            binding.btnAll to "All",
            binding.btnStandard to "Standard",
            binding.btnDeluxe to "Deluxe",
            binding.btnSuite to "Suite",
            binding.btnPresidential to "Presidential"
        )
        filterButtons.forEach { (btn, type) ->
            btn.setOnClickListener {
                selectedFilter = type
                updateFilterUI(filterButtons, btn)
                loadRooms()
            }
        }

        // Observe rooms
        viewModel.rooms.observe(viewLifecycleOwner) { rooms ->
            adapter.submitList(rooms)
            binding.tvError.visibility = if (rooms.isEmpty()) View.VISIBLE else View.GONE
            binding.tvError.text = "No rooms available"
        }

        viewModel.featuredRooms.observe(viewLifecycleOwner) { featured ->
            loadFeaturedRooms(featured)
        }

        viewModel.roomsLoading.observe(viewLifecycleOwner) { loading ->
            binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        }

        viewModel.roomsError.observe(viewLifecycleOwner) { error ->
            if (error != null) {
                binding.tvError.text = error
                binding.tvError.visibility = View.VISIBLE
            }
        }

        binding.tvSeeAll.setOnClickListener { loadRooms() }

        loadRooms()
    }

    override fun onResume() {
        super.onResume()
        if (_binding != null) {
            loadRooms()
        }
    }

        private fun loadRooms(search: String = "") {
        val type = when (selectedFilter) {
            "All"          -> null
            "Suite"        -> null  // Suite shows Suite + Family
            else           -> selectedFilter
        }
        // For Suite filter, load all then filter locally
        if (selectedFilter == "Suite") {
            viewModel.loadRoomsFiltered(requireContext(), null, search, listOf("Suite", "Family"))
        } else {
            viewModel.loadRooms(requireContext(), type, search)
        }
    }

    private fun loadFeaturedRooms(rooms: List<Room>) {
        binding.llFeatured.removeAllViews()
        rooms.forEach { room ->
            val item = layoutInflater.inflate(R.layout.item_room_featured, binding.llFeatured, false)
            item.findViewById<TextView>(R.id.tvFeaturedName).text = room.name
            item.findViewById<TextView>(R.id.tvFeaturedType).text = room.type
            item.findViewById<TextView>(R.id.tvFeaturedRating).text =
                buildRatingBadgeText(room.average_rating, room.rating_count)
            val iv = item.findViewById<ImageView>(R.id.ivFeatured)
            
            // Prioritize local drawable
            Glide.with(this)
                .load(room.getDrawableRes())
                .centerCrop()
                .into(iv)
                
            item.setOnClickListener { navigateToDetail(room) }
            binding.llFeatured.addView(item)
        }
    }

    private fun navigateToDetail(room: Room) {
        // Use image_url from backend if available, otherwise use local drawable
        val localImage = when {
            room.name.contains("Classic", ignoreCase = true)       -> R.drawable.room_classic
            room.name.contains("Standard", ignoreCase = true)      -> R.drawable.room_standard
            room.name.contains("Deluxe", ignoreCase = true)        -> R.drawable.room_deluxe1
            room.name.contains("Presidential", ignoreCase = true)  -> R.drawable.room_presidential1
            room.name.contains("Family", ignoreCase = true)        -> R.drawable.room_family1
            room.type == "Suite"                                    -> R.drawable.room_deluxe2
            else                                                    -> R.drawable.room_classic
        }
        val bundle = Bundle().apply {
            putString("roomId", room.id)
            putString("roomName", room.name)
            putFloat("roomPrice", room.price.toFloat())
            putString("roomType", room.type)
            putInt("roomBeds", room.beds)
            putInt("roomGuests", room.max_guests)
            putString("roomStatus", room.status)
            putString("roomImage", room.image_url ?: "")
            putInt("roomLocalImage", localImage)
            putString("roomDesc", room.description ?: "")
            putDouble("roomAverageRating", room.average_rating)
            putInt("roomRatingCount", room.rating_count)
        }
        findNavController().navigate(R.id.action_home_to_detail, bundle)
    }

    private fun updateFilterUI(buttons: List<Pair<Button, String>>, selected: Button) {
        buttons.forEach { (btn, _) ->
            btn.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (btn == selected) 0xFF74C69D.toInt() else 0xFF2D5A3D.toInt()
            )
            btn.setTextColor(
                if (btn == selected) 0xFF1B3A2D.toInt() else 0xFFA3C9A8.toInt()
            )
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun buildRatingBadgeText(averageRating: Double, ratingCount: Int): SpannableString {
        val label = if (ratingCount > 0) {
            String.format(Locale.US, "\u2605 %.1f", averageRating)
        } else {
            "\u2605 New"
        }
        val ratingText = SpannableString(label)
        ratingText.setSpan(
            ForegroundColorSpan(0xFFF59E0B.toInt()),
            0,
            1,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )
        ratingText.setSpan(
            ForegroundColorSpan(0xFF1B3A2D.toInt()),
            2,
            ratingText.length,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )
        return ratingText
    }
}

// ── ROOM LIST ADAPTER ─────────────────────────────────────────────────────────
class RoomListAdapter(
    private val onRoomClick: (Room) -> Unit
) : RecyclerView.Adapter<RoomListAdapter.RoomViewHolder>() {

    private var rooms = listOf<Room>()

    fun submitList(newRooms: List<Room>) {
        rooms = newRooms
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RoomViewHolder {
        val binding = ItemRoomHomeBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return RoomViewHolder(binding)
    }

    override fun onBindViewHolder(holder: RoomViewHolder, position: Int) {
        holder.bind(rooms[position])
    }

    override fun getItemCount() = rooms.size

    inner class RoomViewHolder(private val binding: ItemRoomHomeBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(room: Room) {
            binding.tvRoomName.text = room.name
            binding.tvRoomType.text = "${room.type} - ${room.max_guests} Guests"
            binding.tvPrice.text = "P${String.format("%,.0f", room.price)}/night"
            binding.tvRoomStatus.text = room.status
            binding.tvRating.text = if (room.rating_count > 0) {
                String.format(Locale.US, "\u2605 %.1f", room.average_rating)
            } else {
                "\u2605 New"
            }

            // Status badge color
            val statusColor = when (room.status) {
                "Available" -> 0xFF1A7F4B.toInt()
                "Occupied" -> 0xFF2563EB.toInt()
                "Maintenance" -> 0xFF9A3412.toInt()
                else -> 0xFF6B7280.toInt()
            }
            binding.tvRoomStatus.backgroundTintList =
                android.content.res.ColorStateList.valueOf(statusColor)

            // Load image
            val localImage = when {
                room.name.contains("Classic", ignoreCase = true) -> R.drawable.room_classic
                room.name.contains("Standard", ignoreCase = true) -> R.drawable.room_standard
                room.name.contains("Deluxe", ignoreCase = true) -> R.drawable.room_deluxe1
                room.name.contains(
                    "Presidential",
                    ignoreCase = true
                ) -> R.drawable.room_presidential1

                room.name.contains("Family", ignoreCase = true) -> R.drawable.room_family1
                room.type == "Suite" -> R.drawable.room_deluxe2
                else -> R.drawable.room_classic
            }
            if (!room.image_url.isNullOrEmpty()) {
                Glide.with(binding.root.context).load(room.image_url)
                    .placeholder(localImage).error(localImage).centerCrop().into(binding.ivRoom)
            } else {
                binding.ivRoom.setImageResource(localImage)
            }

            // Book button
            val isAvailable = room.status == "Available"
            binding.btnBook.isEnabled = isAvailable
            binding.btnBook.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (isAvailable) 0xFFF0FDF4.toInt() else 0xFFF3F4F6.toInt()
            )
            binding.btnBook.setTextColor(
                if (isAvailable) 0xFF2D6A4F.toInt() else 0xFF9CA3AF.toInt()
            )
            binding.btnBook.text = when (room.status) {
                "Available" -> "Book"
                "Occupied" -> "Occupied"
                "Maintenance" -> "N/A"
                else -> "Book"
            }

            binding.root.setOnClickListener { onRoomClick(room) }
            binding.btnBook.setOnClickListener {
                if (isAvailable) onRoomClick(room)
            }
        }
    }
}
