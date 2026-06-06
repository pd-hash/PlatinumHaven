package com.platinumhaven.app.ui

import android.content.res.ColorStateList
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.content.res.AppCompatResources
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.bumptech.glide.Glide
import com.platinumhaven.app.R
import com.platinumhaven.app.data.TokenStore
import com.platinumhaven.app.databinding.FragmentRoomDetailBinding
import com.platinumhaven.app.network.RetrofitClient
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.concurrent.TimeUnit

class RoomDetailFragment : Fragment() {
    companion object {
        private const val TIME_GRID_COLUMNS = 4
        private const val DEFAULT_CHECK_IN_TIME = "14:00"
        private const val DEFAULT_CHECK_OUT_TIME = "12:00"
    }

    private var _binding: FragmentRoomDetailBinding? = null
    private val binding get() = _binding!!

    private var roomId = ""
    private var roomName = ""
    private var roomPrice = 0f
    private var roomType = ""
    private var roomGuests = 2
    private var roomStatus = "Available"
    private var roomImage = ""
    private var roomAverageRating = 0.0
    private var roomRatingCount = 0

    private var currentYear = Calendar.getInstance().get(Calendar.YEAR)
    private var currentMonth = Calendar.getInstance().get(Calendar.MONTH)

    private val availabilityMap = mutableMapOf<String, String>()
    private val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    private val allDayTimeSlots = (0..23).map { hour -> String.format("%02d:00", hour) }

    private var selectedCheckInDate = ""
    private var selectedCheckOutDate = ""
    private var selectedCheckInTime = DEFAULT_CHECK_IN_TIME
    private var selectedCheckOutTime = DEFAULT_CHECK_OUT_TIME
    private var isCheckInTimeManuallySelected = false
    private var isCheckOutTimeManuallySelected = false
    private var isEditingCheckInTime = true
    private var totalAmount = 0.0
    private var activeToast: Toast? = null
    private val toastHandler = Handler(Looper.getMainLooper())
    private var hideToastRunnable: Runnable? = null

    private val colorAvailable = 0xFF16A34A.toInt()
    private val colorPartial = 0xFFEAB308.toInt()
    private val colorFullyBooked = 0xFFEF4444.toInt()
    private val colorUnavailable = 0xFF9CA3AF.toInt()
    private val colorMaintenance = 0xFF9A3412.toInt()
    private val colorDark = 0xFF1B3A2D.toInt()
    private val colorActiveChip = 0xFF1B3A2D.toInt()
    private val colorInactiveChip = 0xFFF0FDF4.toInt()
    private val colorTimeAvailableBg = 0xFFF8FFFA.toInt()
    private val colorTimeAvailableText = 0xFF166534.toInt()
    private val colorCheckInBg = 0xFF1B3A2D.toInt()
    private val colorCheckInText = android.graphics.Color.WHITE
    private val colorCheckOutBg = 0xFF1B3A2D.toInt()
    private val colorCheckOutText = android.graphics.Color.WHITE

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentRoomDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        roomId = arguments?.getString("roomId") ?: ""
        roomName = arguments?.getString("roomName") ?: ""
        roomPrice = arguments?.getFloat("roomPrice") ?: 0f
        roomType = arguments?.getString("roomType") ?: ""
        roomGuests = arguments?.getInt("roomGuests") ?: 2
        roomStatus = arguments?.getString("roomStatus") ?: "Available"
        roomImage = arguments?.getString("roomImage") ?: ""
        roomAverageRating = arguments?.getDouble("roomAverageRating") ?: 0.0
        roomRatingCount = arguments?.getInt("roomRatingCount") ?: 0

        val roomDesc = arguments?.getString("roomDesc").takeIf { !it.isNullOrEmpty() }
            ?: "Experience luxury and comfort in our beautifully designed $roomName. " +
            "Featuring premium amenities and serene surroundings at The Platinum Haven."

        binding.tvRoomName.text = roomName
        binding.tvRating.text = formatRoomRating()
        binding.tvDescription.text = roomDesc
        binding.tvPrice.text = "P${String.format("%,.0f", roomPrice)}/night"

        val localImage = getLocalImage(roomName, roomType)
        if (roomImage.isNotEmpty()) {
            Glide.with(this).load(roomImage)
                .placeholder(localImage).error(localImage)
                .centerCrop().into(binding.ivRoom)
        } else {
            binding.ivRoom.setImageResource(localImage)
        }

        styleBackButton()
        binding.btnBack.setOnClickListener { findNavController().popBackStack() }
        binding.btnSelectCheckInTime.setOnClickListener {
            isEditingCheckInTime = true
            updateTimeEditorState()
        }
        binding.btnSelectCheckOutTime.setOnClickListener {
            isEditingCheckInTime = false
            updateTimeEditorState()
        }

        buildTimeGrid()
        updateBookingPanelsVisibility()

        binding.btnBookNow.setOnClickListener {
            when {
                !isRoomBookable() ->
                    showInstantToast("This room is not available for booking.")

                selectedCheckInDate.isEmpty() ->
                    showInstantToast("Please select your arrival date.")

                selectedCheckOutDate.isEmpty() ->
                    showInstantToast("Please select your departure date.")

                selectedCheckInDate >= selectedCheckOutDate ->
                    showInstantToast("Departure must be after arrival.")

                availabilityMap[selectedCheckInDate] == "fully_booked" ->
                    showInstantToast(
                        "Your arrival date is fully booked. Please choose another date.",
                        Toast.LENGTH_LONG
                    )

                else -> {
                    val bundle = Bundle().apply {
                        putString("roomId", roomId)
                        putString("roomName", roomName)
                        putFloat("roomPrice", roomPrice)
                        putString("roomImage", roomImage)
                        putInt("roomGuests", roomGuests)
                        putString("checkIn", "$selectedCheckInDate $selectedCheckInTime")
                        putString("checkOut", "$selectedCheckOutDate $selectedCheckOutTime")
                        putFloat("totalPrice", totalAmount.toFloat())
                    }
                    findNavController().navigate(R.id.action_detail_to_booking_step1, bundle)
                }
            }
        }

        updateDateTimeDisplay()
        fetchAvailability()
    }

    override fun onResume() {
        super.onResume()
        if (_binding != null && roomId.isNotBlank()) {
            fetchAvailability()
        }
    }

    private fun buildTimeGrid() {
        binding.gridBookingTimes.removeAllViews()

        allDayTimeSlots.forEachIndexed { index, time ->
            val button = Button(requireContext()).apply {
                tag = time
                textSize = 10f
                isAllCaps = false
                stateListAnimator = null
                minHeight = 0
                minimumHeight = 0
                elevation = 0f
                setPadding(6.dp, 4.dp, 6.dp, 4.dp)
                layoutParams = GridLayout.LayoutParams().apply {
                    width = 0
                    height = 64.dp
                    columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
                    setMargins(
                        if (index % TIME_GRID_COLUMNS == 0) 0 else 6.dp,
                        0,
                        if (index % TIME_GRID_COLUMNS == TIME_GRID_COLUMNS - 1) 0 else 6.dp,
                        8.dp
                    )
                }
                setOnClickListener {
                    if (isEditingCheckInTime) {
                        if (isCheckInTimeManuallySelected && selectedCheckInTime == time) {
                            selectedCheckInTime = DEFAULT_CHECK_IN_TIME
                            isCheckInTimeManuallySelected = false
                        } else {
                            selectedCheckInTime = time
                            isCheckInTimeManuallySelected = true
                        }
                    } else {
                        if (isCheckOutTimeManuallySelected && selectedCheckOutTime == time) {
                            selectedCheckOutTime = DEFAULT_CHECK_OUT_TIME
                            isCheckOutTimeManuallySelected = false
                        } else {
                            selectedCheckOutTime = time
                            isCheckOutTimeManuallySelected = true
                        }
                    }
                    updateDateTimeDisplay()
                }
            }
            binding.gridBookingTimes.addView(button)
        }

        updateTimeEditorState()
        updateTimeGridSelection()
    }

    private fun formatRoomRating(): String {
        return if (roomRatingCount > 0) {
            String.format(
                Locale.US,
                "\u2605 %.1f (%d %s)",
                roomAverageRating,
                roomRatingCount,
                if (roomRatingCount == 1) "review" else "reviews"
            )
        } else {
            "\u2605 New"
        }
    }

    private fun updateTimeEditorState() {
        binding.btnSelectCheckInTime.backgroundTintList = ColorStateList.valueOf(
            if (isEditingCheckInTime) colorActiveChip else colorInactiveChip
        )
        binding.btnSelectCheckOutTime.backgroundTintList = ColorStateList.valueOf(
            if (isEditingCheckInTime) colorInactiveChip else colorActiveChip
        )
        binding.btnSelectCheckInTime.setTextColor(
            if (isEditingCheckInTime) android.graphics.Color.WHITE else colorTimeAvailableText
        )
        binding.btnSelectCheckOutTime.setTextColor(
            if (isEditingCheckInTime) colorTimeAvailableText else android.graphics.Color.WHITE
        )
        binding.tvTimeGridLabel.text = if (isEditingCheckInTime) {
            "Choose check-in time"
        } else {
            "Choose check-out time"
        }
        updateTimeGridSelection()
    }

    private fun updateTimeGridSelection() {
        for (i in 0 until binding.gridBookingTimes.childCount) {
            val button = binding.gridBookingTimes.getChildAt(i) as? Button ?: continue
            val buttonTime = button.tag.toString()
            val isCheckInSelected = isCheckInTimeManuallySelected && buttonTime == selectedCheckInTime
            val isCheckOutSelected = isCheckOutTimeManuallySelected && buttonTime == selectedCheckOutTime
            val selectedLabels = mutableListOf<String>().apply {
                if (isCheckInSelected) add("Check-in")
                if (isCheckOutSelected) add("Check-out")
            }

            val backgroundColor = when {
                isCheckInSelected -> colorCheckInBg
                isCheckOutSelected -> colorCheckOutBg
                else -> colorTimeAvailableBg
            }
            val textColor = when {
                isCheckInSelected -> colorCheckInText
                isCheckOutSelected -> colorCheckOutText
                else -> colorTimeAvailableText
            }

            button.backgroundTintList = ColorStateList.valueOf(backgroundColor)
            button.setTextColor(textColor)
            button.text = formatHourBlock(buttonTime, selectedLabels)
        }
    }

    private fun isRoomBookable(): Boolean {
        return !roomStatus.equals("Maintenance", ignoreCase = true) &&
            !roomStatus.equals("Unavailable", ignoreCase = true)
    }

    private fun isBlockedStatus(status: String?): Boolean {
        return status == "fully_booked" || status == "maintenance" || status == "unavailable"
    }

    private fun hasBlockedDatesInRange(startDate: String, endDate: String): Boolean {
        val start = sdf.parse(startDate) ?: return true
        val end = sdf.parse(endDate) ?: return true
        val cursor = Calendar.getInstance().apply { time = start }
        val last = Calendar.getInstance().apply { time = end }

        while (!cursor.after(last)) {
            val key = sdf.format(cursor.time)
            val status = when {
                roomStatus.equals("Maintenance", ignoreCase = true) -> "maintenance"
                else -> availabilityMap[key]
            }
            if (isBlockedStatus(status)) return true
            cursor.add(Calendar.DAY_OF_MONTH, 1)
        }

        return false
    }

    private fun updateBookingPanelsVisibility() {
        val roomBookable = isRoomBookable()
        val hasValidCheckIn = selectedCheckInDate.isNotEmpty() &&
            !isBlockedStatus(availabilityMap[selectedCheckInDate])
        val hasValidRange = hasValidCheckIn &&
            selectedCheckOutDate.isNotEmpty() &&
            !hasBlockedDatesInRange(selectedCheckInDate, selectedCheckOutDate)

        binding.cardSelectedDates.visibility = if (roomBookable) View.VISIBLE else View.GONE
        binding.cardSelectTime.visibility = if (roomBookable && hasValidCheckIn) View.VISIBLE else View.GONE
        binding.btnBookNow.isEnabled = roomBookable && hasValidRange
        binding.btnBookNow.alpha = if (binding.btnBookNow.isEnabled) 1f else 0.55f
    }

    private fun formatTimeForDisplay(value: String): String {
        val hour = value.substringBefore(":").toInt()
        val minute = value.substringAfter(":")
        val hour12 = when {
            hour == 0 -> 12
            hour > 12 -> hour - 12
            else -> hour
        }
        val amPm = if (hour < 12) "AM" else "PM"
        return "$hour12:$minute $amPm"
    }

    private fun formatHourBlock(value: String, labels: List<String> = emptyList()): String {
        val hour = value.substringBefore(":").toInt()
        val minute = value.substringAfter(":")
        val hour12 = when {
            hour == 0 -> 12
            hour > 12 -> hour - 12
            else -> hour
        }
        val amPm = if (hour < 12) "AM" else "PM"
        return buildString {
            append("$hour12:$minute $amPm")
            if (labels.isNotEmpty()) {
                append('\n')
                append(labels.joinToString(" / "))
            }
        }
    }

    private fun updateDateTimeDisplay() {
        val checkInDisplay = if (selectedCheckInDate.isEmpty()) {
            "Choose arrival date"
        } else {
            formatBookingDateTime("$selectedCheckInDate $selectedCheckInTime")
        }
        val checkOutDisplay = if (selectedCheckOutDate.isEmpty()) {
            "Choose departure date"
        } else {
            formatBookingDateTime("$selectedCheckOutDate $selectedCheckOutTime")
        }

        binding.tvSelectedCheckIn.text = checkInDisplay
        binding.tvSelectedCheckOut.text = checkOutDisplay
        updateTimeGridSelection()
        updateBookingPanelsVisibility()
    }

    private fun formatBookingDateTime(value: String): String {
        return try {
            val parsed = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).parse(value)
            if (parsed != null) {
                SimpleDateFormat("MMMM d, yyyy 'at' h:mm a", Locale.getDefault()).format(parsed)
            } else {
                value
            }
        } catch (_: Exception) {
            value
        }
    }

    private fun updateTotal() {
        if (selectedCheckInDate.isEmpty() || selectedCheckOutDate.isEmpty()) {
            updateBookingPanelsVisibility()
            return
        }
        if (hasBlockedDatesInRange(selectedCheckInDate, selectedCheckOutDate)) {
            totalAmount = 0.0
            binding.tvPrice.text = "P${String.format("%,.0f", roomPrice)}/night"
            binding.btnBookNow.isEnabled = false
            updateBookingPanelsVisibility()
            return
        }
        val inDate = sdf.parse(selectedCheckInDate) ?: return
        val outDate = sdf.parse(selectedCheckOutDate) ?: return
        val nights = TimeUnit.MILLISECONDS.toDays(outDate.time - inDate.time)
        if (nights <= 0) {
            updateBookingPanelsVisibility()
            return
        }
        totalAmount = (roomPrice * nights).toDouble()
        binding.tvPrice.text = "P${String.format("%,.0f", totalAmount)} ($nights night${if (nights > 1) "s" else ""})"
        updateBookingPanelsVisibility()
    }

    private fun fetchAvailability() {
        val monthStr = String.format("%04d-%02d", currentYear, currentMonth + 1)
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val token = TokenStore.getBearerToken(requireContext())
                val response = RetrofitClient.api.getRoomAvailability(token, roomId, monthStr)
                if (response.isSuccessful) {
                    availabilityMap.clear()
                    response.body()?.forEach { day -> availabilityMap[day.date] = day.status }
                }
            } catch (_: Exception) {
            } finally {
                if (_binding != null) buildCalendar()
            }
        }
    }

    private fun buildCalendar() {
        val container = binding.calendarContainer
        container.removeAllViews()
        val monthNames = arrayOf(
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        )

        val header = LinearLayout(requireContext()).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER_VERTICAL
            layoutParams = rowParams(marginBottom = 12)
        }
        val btnPrev = makeNavBtn("<") {
            val c = Calendar.getInstance().apply { set(currentYear, currentMonth, 1) }
            c.add(Calendar.MONTH, -1)
            val todayCal = Calendar.getInstance().apply { set(Calendar.DAY_OF_MONTH, 1) }
            if (!c.before(todayCal)) {
                currentMonth = c.get(Calendar.MONTH)
                currentYear = c.get(Calendar.YEAR)
                fetchAvailability()
            }
        }
        val btnNext = makeNavBtn(">") {
            val c = Calendar.getInstance().apply { set(currentYear, currentMonth, 1) }
            c.add(Calendar.MONTH, 1)
            currentMonth = c.get(Calendar.MONTH)
            currentYear = c.get(Calendar.YEAR)
            fetchAvailability()
        }
        val tvMonth = TextView(requireContext()).apply {
            text = "${monthNames[currentMonth]} $currentYear"
            textSize = 15f
            setTextColor(colorDark)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = android.view.Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        header.addView(btnPrev)
        header.addView(tvMonth)
        header.addView(btnNext)
        container.addView(header)

        val dayRow = LinearLayout(requireContext()).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = rowParams(marginBottom = 4)
        }
        listOf("Su", "Mo", "Tu", "We", "Th", "Fr", "Sa").forEach { day ->
            dayRow.addView(TextView(requireContext()).apply {
                text = day
                textSize = 10f
                setTextColor(colorUnavailable)
                gravity = android.view.Gravity.CENTER
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })
        }
        container.addView(dayRow)

        val cal = Calendar.getInstance().apply { set(currentYear, currentMonth, 1) }
        val firstDay = cal.get(Calendar.DAY_OF_WEEK) - 1
        val daysInMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
        val todayCal = Calendar.getInstance()
        var week = newWeekRow()
        var col = 0

        repeat(firstDay) {
            week.addView(emptyCell())
            col++
        }

        for (day in 1..daysInMonth) {
            val dateStr = String.format("%04d-%02d-%02d", currentYear, currentMonth + 1, day)
            val dayCal = Calendar.getInstance().apply { set(currentYear, currentMonth, day) }
            val isPast = dayCal.before(todayCal.apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            })
            val isToday = day == Calendar.getInstance().get(Calendar.DAY_OF_MONTH) &&
                currentMonth == Calendar.getInstance().get(Calendar.MONTH) &&
                currentYear == Calendar.getInstance().get(Calendar.YEAR)
            val isCheckIn = dateStr == selectedCheckInDate
            val isCheckOut = dateStr == selectedCheckOutDate
            val isInRange = selectedCheckInDate.isNotEmpty() &&
                selectedCheckOutDate.isNotEmpty() &&
                dateStr > selectedCheckInDate &&
                dateStr < selectedCheckOutDate

            val status = when {
                isPast -> "past"
                roomStatus.equals("Maintenance", ignoreCase = true) ||
                    roomStatus.equals("Unavailable", ignoreCase = true) -> "unavailable"
                else -> availabilityMap[dateStr] ?: "available"
            }

            week.addView(makeDayCell(day, dateStr, status, isToday, isCheckIn, isCheckOut, isInRange, isPast))
            col++
            if (col == 7) {
                container.addView(week)
                week = newWeekRow()
                col = 0
            }
        }

        if (col > 0) {
            while (col < 7) {
                week.addView(emptyCell())
                col++
            }
            container.addView(week)
        }

        val legend = LinearLayout(requireContext()).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER
            layoutParams = rowParams(marginTop = 12, marginBottom = 4)
        }
        listOf(
            "Available" to colorAvailable,
            "Partial" to colorPartial,
            "Full" to colorFullyBooked,
            "Unavailable" to colorMaintenance
        ).forEach { (label, color) ->
            legend.addView(TextView(requireContext()).apply {
                text = label
                textSize = 10f
                setTextColor(color)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    gravity = android.view.Gravity.CENTER
                }
            })
        }
        container.addView(legend)
    }

    private fun makeDayCell(
        day: Int,
        dateStr: String,
        status: String,
        isToday: Boolean,
        isCheckIn: Boolean,
        isCheckOut: Boolean,
        isInRange: Boolean,
        isPast: Boolean
    ): LinearLayout {
        val canSelect = !isPast && !isBlockedStatus(status)

        val bgColor = when {
            isCheckIn || isCheckOut -> colorDark
            isInRange -> 0x221B3A2D
            isToday -> 0x221B3A2D
            else -> android.graphics.Color.TRANSPARENT
        }

        val cell = LinearLayout(requireContext()).apply {
            orientation = LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(0, 52.dp, 1f).apply { setMargins(1, 1, 1, 1) }
            alpha = if (isPast) 0.35f else 1.0f
            if (bgColor != android.graphics.Color.TRANSPARENT) {
                background = android.graphics.drawable.GradientDrawable().apply {
                    shape = android.graphics.drawable.GradientDrawable.RECTANGLE
                    setColor(bgColor)
                    cornerRadius = 8.dp.toFloat()
                }
            }
        }

        val tvDay = TextView(requireContext()).apply {
            text = day.toString()
            textSize = 13f
            gravity = android.view.Gravity.CENTER
            setTextColor(
                when {
                    isCheckIn || isCheckOut -> android.graphics.Color.WHITE
                    isPast -> colorUnavailable
                    status == "fully_booked" -> colorFullyBooked
                    status == "maintenance" || status == "unavailable" -> colorMaintenance
                    else -> colorDark
                }
            )
            if (isCheckIn || isCheckOut || isToday) {
                typeface = android.graphics.Typeface.DEFAULT_BOLD
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        val tvDot = TextView(requireContext()).apply {
            textSize = 7f
            gravity = android.view.Gravity.CENTER
            text = when (status) {
                "maintenance", "unavailable" -> "*"
                "past" -> ""
                else -> "*"
            }
            setTextColor(
                when (status) {
                    "available" -> colorAvailable
                    "partially_booked" -> colorPartial
                    "fully_booked" -> colorFullyBooked
                    "maintenance", "unavailable" -> colorMaintenance
                    else -> colorUnavailable
                }
            )
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        cell.addView(tvDay)
        cell.addView(tvDot)

        if (canSelect) {
            cell.isClickable = true
            cell.isFocusable = true
            cell.setOnClickListener { handleDateTap(dateStr) }
        } else if (status == "fully_booked" || status == "maintenance" || status == "unavailable") {
            cell.isClickable = true
            cell.setOnClickListener {
                val message = when (status) {
                    "fully_booked" -> "$dateStr is already booked"
                    else -> "$dateStr is not available"
                }
                showInstantToast(message)
            }
        }

        return cell
    }

    private fun handleDateTap(dateStr: String) {
        var feedbackMessage: String?

        if (dateStr == selectedCheckInDate && selectedCheckOutDate.isEmpty()) {
            selectedCheckInDate = ""
            totalAmount = 0.0
            binding.tvPrice.text = "P${String.format("%,.0f", roomPrice)}/night"
            feedbackMessage = "Arrival date cleared."
        } else if (dateStr == selectedCheckInDate && selectedCheckOutDate.isNotEmpty()) {
            selectedCheckOutDate = ""
            totalAmount = 0.0
            binding.tvPrice.text = "P${String.format("%,.0f", roomPrice)}/night"
            feedbackMessage = "Departure date cleared. Choose a new departure date."
        } else if (dateStr == selectedCheckOutDate) {
            selectedCheckOutDate = ""
            totalAmount = 0.0
            binding.tvPrice.text = "P${String.format("%,.0f", roomPrice)}/night"
            feedbackMessage = "Departure date cleared."
        } else if (selectedCheckInDate.isEmpty() || (!selectedCheckOutDate.isEmpty() && dateStr <= selectedCheckInDate)) {
            selectedCheckInDate = dateStr
            selectedCheckOutDate = ""
            totalAmount = 0.0
            binding.tvPrice.text = "P${String.format("%,.0f", roomPrice)}/night"
            feedbackMessage = "Arrival set to $dateStr. Now choose your departure date."
        } else if (selectedCheckOutDate.isEmpty()) {
            if (dateStr <= selectedCheckInDate) {
                showInstantToast("Departure must be after arrival.")
                return
            }
            if (hasBlockedDatesInRange(selectedCheckInDate, dateStr)) {
                showInstantToast(
                    "The selected stay includes dates that are already booked or unavailable.",
                    Toast.LENGTH_LONG
                )
                selectedCheckOutDate = ""
                updateDateTimeDisplay()
                buildCalendar()
                return
            }
            selectedCheckOutDate = dateStr
            feedbackMessage = "Departure set to $dateStr. You can continue now."
        } else {
            selectedCheckInDate = dateStr
            selectedCheckOutDate = ""
            totalAmount = 0.0
            binding.tvPrice.text = "P${String.format("%,.0f", roomPrice)}/night"
            feedbackMessage = "Arrival changed to $dateStr. Choose a new departure date."
        }

        feedbackMessage.let {
            showInstantToast(it)
        }

        binding.root.post {
            if (_binding == null) return@post
            if (selectedCheckOutDate.isNotEmpty()) {
                updateTotal()
            } else {
                updateDateTimeDisplay()
                buildCalendar()
            }
            if (selectedCheckOutDate.isNotEmpty()) {
                updateDateTimeDisplay()
                buildCalendar()
            }
        }
    }

    private fun showInstantToast(message: String, duration: Int = Toast.LENGTH_SHORT) {
        activeToast?.cancel()
        activeToast = null

        hideToastRunnable?.let(toastHandler::removeCallbacks)

        val feedbackCard = binding.cardFeedbackToast
        val feedbackText = binding.tvFeedbackToast
        feedbackText.text = message
        feedbackCard.visibility = View.VISIBLE
        feedbackCard.animate().cancel()
        feedbackCard.translationY = 12.dp.toFloat()
        feedbackCard.alpha = 0f
        feedbackCard.animate()
            .alpha(1f)
            .translationY(0f)
            .setDuration(120)
            .start()

        val dismissDelay = if (duration == Toast.LENGTH_LONG) 2400L else 1400L
        hideToastRunnable = Runnable {
            if (_binding == null) return@Runnable
            binding.cardFeedbackToast.animate()
                .alpha(0f)
                .translationY(8.dp.toFloat())
                .setDuration(120)
                .withEndAction {
                    if (_binding == null) return@withEndAction
                    binding.cardFeedbackToast.visibility = View.GONE
                }
                .start()
        }
        toastHandler.postDelayed(hideToastRunnable!!, dismissDelay)
    }

    private fun styleBackButton() {
        binding.btnBack.apply {
            background = AppCompatResources.getDrawable(context, R.drawable.bg_back_button)
            setImageDrawable(AppCompatResources.getDrawable(context, R.drawable.ic_back_chevron))
            imageTintList = null
        }
    }

    private fun makeNavBtn(label: String, onClick: () -> Unit) =
        Button(requireContext()).apply {
            text = label
            textSize = 20f
            setBackgroundColor(android.graphics.Color.TRANSPARENT)
            setTextColor(colorDark)
            layoutParams = LinearLayout.LayoutParams(44.dp, 44.dp)
            setOnClickListener { onClick() }
        }

    private fun rowParams(marginTop: Int = 0, marginBottom: Int = 0) =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(0, marginTop.dp, 0, marginBottom.dp)
        }

    private fun newWeekRow() = LinearLayout(requireContext()).apply {
        orientation = LinearLayout.HORIZONTAL
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        )
    }

    private fun emptyCell() = LinearLayout(requireContext()).apply {
        layoutParams = LinearLayout.LayoutParams(0, 52.dp, 1f)
    }

    private fun getLocalImage(name: String, type: String): Int = when {
        name.contains("Classic", ignoreCase = true) -> R.drawable.room_classic
        name.contains("Standard", ignoreCase = true) -> R.drawable.room_standard
        name.contains("Deluxe", ignoreCase = true) -> R.drawable.room_deluxe1
        name.contains("Presidential", ignoreCase = true) -> R.drawable.room_presidential1
        name.contains("Family", ignoreCase = true) -> R.drawable.room_family1
        type.contains("Suite", ignoreCase = true) -> R.drawable.room_deluxe2
        else -> R.drawable.room_classic
    }

    private val Int.dp: Int
        get() = (this * resources.displayMetrics.density).toInt()

    override fun onDestroyView() {
        activeToast?.cancel()
        activeToast = null
        hideToastRunnable?.let(toastHandler::removeCallbacks)
        hideToastRunnable = null
        super.onDestroyView()
        _binding = null
    }
}
