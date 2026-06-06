package com.platinumhaven.app.ui

import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.core.view.setPadding
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.platinumhaven.app.R
import com.platinumhaven.app.data.AddOn
import com.platinumhaven.app.data.Reservation
import com.platinumhaven.app.data.Room
import com.platinumhaven.app.data.TokenStore
import com.platinumhaven.app.databinding.FragmentChatBinding
import com.platinumhaven.app.network.RetrofitClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ChatFragment : Fragment() {

    private var _binding: FragmentChatBinding? = null
    private val binding get() = _binding!!

    private val tawkChatUrl = "https://tawk.to/chat/69e19b572293ae1c33360960/1jmcke13m"

    private var knowledge = ChatKnowledge()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentChatBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.btnSend.setOnClickListener { submitPrompt() }
        binding.etChatMessage.setOnEditorActionListener { _, _, _ ->
            submitPrompt()
            true
        }

        renderQuickActions(
            listOf(
                "Room Options",
                "Reservation Status",
                "Payment and Invoice",
                "Stay Enhancements"
            )
        )

        val guestName = TokenStore.getUserFirstName(requireContext())
            ?: TokenStore.getUserName(requireContext())?.substringBefore(" ")
            ?: "there"

        addBotMessage(
            "Good day, $guestName.\n\n" +
                "Welcome to The Platinum Haven guest concierge. I can assist with room options, reservation updates, PayPal payment guidance, add-ons, and general stay support."
        )
        addBotMessage(
            "Please let me know how I may assist you today, or choose one of the quick options below for a faster response."
        )

        loadKnowledge()
    }

    private fun submitPrompt() {
        val prompt = binding.etChatMessage.text?.toString()?.trim().orEmpty()
        if (prompt.isBlank()) return

        binding.etChatMessage.setText("")
        addUserMessage(prompt)

        val response = buildResponse(prompt)
        addBotMessage(response)
    }

    private fun loadKnowledge() {
        lifecycleScope.launch {
            binding.progressKnowledge.visibility = View.VISIBLE

            val snapshot = withContext(Dispatchers.IO) {
                val token = TokenStore.getBearerToken(requireContext())

                val roomsDeferred = async { runCatching { RetrofitClient.api.getRooms(token).body().orEmpty() } }
                val reservationsDeferred = async {
                    runCatching { RetrofitClient.api.getMyReservations(token).body().orEmpty() }
                }
                val addonsDeferred = async { runCatching { RetrofitClient.api.getAddons(token).body().orEmpty() } }

                val roomsResult = roomsDeferred.await()
                val reservationsResult = reservationsDeferred.await()
                val addonsResult = addonsDeferred.await()

                ChatKnowledge(
                    rooms = roomsResult.getOrDefault(emptyList()),
                    reservations = reservationsResult.getOrDefault(emptyList()),
                    addons = addonsResult.getOrDefault(emptyList()),
                    loadError = listOf(
                        roomsResult.exceptionOrNull()?.message,
                        reservationsResult.exceptionOrNull()?.message,
                        addonsResult.exceptionOrNull()?.message
                    ).firstOrNull { !it.isNullOrBlank() }
                )
            }

            knowledge = snapshot
            binding.progressKnowledge.visibility = View.GONE

            val availableCount = snapshot.rooms.count { it.status.equals("Available", true) }
            val bookingCount = snapshot.reservations.count { it.status !in listOf("Cancelled", "Completed") }
            val addonCount = snapshot.addons.count { it.status.equals("Active", true) && it.stock > 0 }

            if (!snapshot.loadError.isNullOrBlank()) {
                addBotMessage(
                    "Some live information is limited at the moment, but I can still assist with common reservation, payment, and stay questions."
                )
            } else {
                addBotMessage(
                    "I am connected to the latest hotel information.\n\n" +
                        "Current snapshot:\n" +
                        "Available rooms: $availableCount\n" +
                        "Active reservations: $bookingCount\n" +
                        "Available add-ons: $addonCount"
                )
            }
        }
    }

    private fun buildResponse(prompt: String): String {
        val text = prompt.lowercase()
        return when {
            text.contains("live support") || text.contains("human") || text.contains("agent") || text.contains("tawk") -> {
                openLiveSupport()
                "I am opening live guest support now so a Platinum Haven representative can assist you directly."
            }

            text.contains("available room") || text.contains("room") || text.contains("price") || text.contains("suite") -> {
                buildRoomsAnswer()
            }

            text.contains("my booking") || text.contains("booking") || text.contains("reservation") -> {
                buildBookingsAnswer()
            }

            text.contains("pay") || text.contains("payment") || text.contains("paypal") || text.contains("invoice") -> {
                buildPaymentAnswer()
            }

            text.contains("addon") || text.contains("add-on") || text.contains("extra") -> {
                buildAddonsAnswer()
            }

            text.contains("cancel") -> {
                "Cancellation guidance:\n" +
                    "Reservations may be cancelled from the Bookings tab while their status is Pending or Confirmed.\n" +
                    "Completed or Cancelled stays can no longer be cancelled in the app.\n" +
                    "For special cases, please contact guest services."
            }

            text.contains("review") || text.contains("feedback") || text.contains("rate") -> {
                "Review guidance:\n" +
                    "You may leave feedback once a stay is marked Completed.\n" +
                    "In the Bookings tab, the Review button appears only for completed stays that have not yet been reviewed."
            }

            text.contains("receipt") || text.contains("email") || text.contains("sms") || text.contains("notification") -> {
                "Notification guidance:\n" +
                    "After a reservation is created, the system can send booking details to your registered contact information.\n" +
                    "Confirmed PayPal reservations are recorded together with your payment details and booking summary."
            }

            text.contains("special request") || text.contains("request") -> {
                "Yes. During booking, you can add a special request before payment, and it will be saved with your reservation."
            }

            text.contains("status") && (text.contains("confirmed") || text.contains("pending") || text.contains("holding")) -> {
                "Reservation status guide:\n" +
                    "Pending: the booking was created but not fully completed.\n" +
                    "Confirmed: payment is secured or the reservation has been confirmed.\n" +
                    "Holding: the booking is temporarily reserved.\n" +
                    "Completed: the stay has finished.\n" +
                    "Cancelled: the reservation was cancelled."
            }

            text.contains("help") || text.contains("what can you do") || text.contains("what do you know") -> {
                "I can help with room availability, room rates, reservations, add-ons, PayPal payments, cancellations, receipts, and reviews.\n\n" +
                    "If you prefer direct assistance, tap Live Support and we will connect you with guest services."
            }

            else -> {
                "I can best assist with room availability, reservation status, PayPal payments, add-ons, cancellations, receipts, and reviews.\n\n" +
                    "You may ask:\n" +
                    "What rooms are available?\n" +
                    "What is my latest reservation status?\n" +
                    "How do I pay with PayPal?"
            }
        }
    }

    private fun buildRoomsAnswer(): String {
        val rooms = knowledge.rooms
        if (rooms.isEmpty()) {
            return "I could not load the live room list right now, but you can still browse our room options in the Home tab."
        }

        val availableRooms = rooms.filter { it.status.equals("Available", true) }
        if (availableRooms.isEmpty()) {
            return "At the moment, I do not see any rooms marked Available. You may still check the Home tab or contact guest support for the next opening."
        }

        val summary = availableRooms.take(4).joinToString("\n") {
            "${it.name} (${it.type})\n" +
                "Rate: P${String.format("%,.0f", it.price)}/night\n" +
                "Capacity: up to ${it.max_guests} guest(s)"
        }

        return "Here are the rooms currently available:\n\n$summary\n\n" +
            "You may open any room from the Home tab to review full details, choose your dates, and continue your reservation."
    }

    private fun buildBookingsAnswer(): String {
        val reservations = knowledge.reservations
        if (reservations.isEmpty()) {
            return "I do not see any reservations on your account right now. Once you make one, it will appear in the Bookings tab where you can track status, cancel eligible stays, and leave a review after completion."
        }

        val active = reservations.filter { it.status !in listOf("Cancelled", "Completed") }
        val latest = reservations.first()
        val activeSummary = if (active.isEmpty()) {
            "You currently have no active reservations."
        } else {
            "You currently have ${active.size} active reservation(s)."
        }

        return "$activeSummary\n\n" +
            "Latest reservation:\n" +
            "Reference: ${latest.reservation_no}\n" +
            "Room: ${latest.room_name}\n" +
            "Status: ${latest.status}\n" +
            "Payment: ${latest.payment_status}"
    }

    private fun buildPaymentAnswer(): String {
        return "Payment guidance:\n" +
            "The Platinum Haven currently accepts PayPal for guest reservations.\n" +
            "Once your PayPal payment is approved, the reservation proceeds to confirmation.\n" +
            "Your booking and payment details are then available in your account."
    }

    private fun buildAddonsAnswer(): String {
        val addons = knowledge.addons.filter { it.status.equals("Active", true) && it.stock > 0 }
        if (addons.isEmpty()) {
            return "I do not see any active add-ons available right now. If you would like extras for your stay, guest support can confirm the latest offers for you."
        }

        val summary = addons.take(5).joinToString("\n") {
            "${it.name} - P${String.format("%,.0f", it.price)}"
        }

        return "These stay enhancements are currently available during booking:\n\n$summary\n\n" +
            "You can select them in Step 2 before proceeding to PayPal payment."
    }

    private fun renderQuickActions(actions: List<String>) {
        binding.quickActions.removeAllViews()
        actions.forEach { label ->
            val card = CardView(requireContext()).apply {
                radius = dp(18).toFloat()
                cardElevation = dp(1).toFloat()
                setCardBackgroundColor(0xFFFFFFFF.toInt())
                layoutParams = LinearLayout.LayoutParams(
                    dp(160),
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    marginEnd = dp(10)
                }
            }

            val chip = TextView(requireContext()).apply {
                text = label
                setTextColor(0xFF1B3A2D.toInt())
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
                background = requireContext().getDrawable(R.drawable.bg_chat_quick_action)
                minHeight = dp(48)
                setPadding(dp(18), dp(12), dp(18), dp(12))
                isSingleLine = true
                setOnClickListener {
                    addUserMessage(label)
                    addBotMessage(buildResponse(label))
                }
            }
            card.addView(chip)
            binding.quickActions.addView(card)
        }
    }

    private fun addBotMessage(message: String) {
        val item = layoutInflater.inflate(R.layout.item_chat_bot, binding.chatMessages, false)
        item.findViewById<TextView>(R.id.tvMessage).text = message
        binding.chatMessages.addView(item)
        scrollToBottom()
    }

    private fun addUserMessage(message: String) {
        val item = layoutInflater.inflate(R.layout.item_chat_user, binding.chatMessages, false)
        item.findViewById<TextView>(R.id.tvMessage).text = message
        binding.chatMessages.addView(item)
        scrollToBottom()
    }

    private fun scrollToBottom() {
        binding.chatScroll.post {
            binding.chatScroll.fullScroll(View.FOCUS_DOWN)
        }
    }

    private fun openLiveSupport() {
        runCatching {
            startActivity(
                Intent(requireContext(), LiveSupportActivity::class.java).apply {
                    putExtra(LiveSupportActivity.EXTRA_URL, tawkChatUrl)
                }
            )
        }
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }

    private data class ChatKnowledge(
        val rooms: List<Room> = emptyList(),
        val reservations: List<Reservation> = emptyList(),
        val addons: List<AddOn> = emptyList(),
        val loadError: String? = null
    )
}
