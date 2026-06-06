package com.platinumhaven.app.data

import com.platinumhaven.app.R

data class LoginRequest(val email: String, val password: String)

data class ForgotPasswordCodeRequest(
    val email: String
)

data class ForgotPasswordVerifyRequest(
    val email: String,
    val code: String
)

data class ForgotPasswordConfirmRequest(
    val email: String,
    val code: String,
    val new_password: String
)

data class RegisterRequest(
    val first_name: String,
    val last_name: String,
    val middle_name: String,
    val email: String,
    val password: String,
    val phone: String,
    val sex: String,
    val full_name: String,
    val valid_id_url: String? = null
)

data class AuthResponse(val token: String, val user: User)

data class User(
    val id: String,
    val full_name: String,
    val first_name: String?,
    val last_name: String?,
    val middle_name: String?,
    val email: String,
    val phone: String?,
    val sex: String?,
    val role: String,
    val approval_status: String?,
    val is_approved: Boolean?
)

data class Room(
    val id: String,
    val room_number: String,
    val name: String,
    val type: String,
    val price: Double,
    val beds: Int,
    val max_guests: Int,
    val status: String,
    val description: String?,
    val image_url: String?,
    val icon: String?,
    val average_rating: Double = 0.0,
    val rating_count: Int = 0,
    val monthly_availability_status: String? = null,
    val available_days_this_month: Int? = null,
    val bookable_days_this_month: Int? = null
) {
    fun getDrawableRes(): Int {
        return when {
            name.contains("Presidential", true) || type.contains("Presidential", true) -> R.drawable.room_presidential1
            name.contains("Deluxe", true) || type.contains("Deluxe", true) -> R.drawable.room_deluxe1
            name.contains("Family", true) || type.contains("Family", true) -> R.drawable.room_family1
            name.contains("Suite", true) || type.contains("Suite", true) -> R.drawable.room_deluxe2
            name.contains("Classic", true) || type.contains("Classic", true) -> R.drawable.room_classic
            else -> R.drawable.room_standard
        }
    }
}

data class AddOn(
    val id: String,
    val name: String,
    val price: Double,
    val icon: String?,
    val category: String,
    val stock: Int,
    val status: String
)

data class Reservation(
    val id: String,
    val reservation_no: String,
    val room_name: String,
    val room_number: String?,
    val room_image_url: String?,
    val check_in: String,
    val check_out: String,
    val status: String,
    val payment_status: String,
    val payment_method: String?,
    val total_amount: Double,
    val guest_name: String?,
    val guests_adults: Int?,
    val guests_children: Int?,
    val special_request: String?,
    val has_reviewed: Boolean? = false
) {
    fun getDrawableRes(): Int {
        return when {
            room_name.contains("Presidential", true) -> R.drawable.room_presidential1
            room_name.contains("Deluxe", true) -> R.drawable.room_deluxe1
            room_name.contains("Family", true) -> R.drawable.room_family1
            room_name.contains("Suite", true) -> R.drawable.room_deluxe2
            room_name.contains("Classic", true) -> R.drawable.room_classic
            else -> R.drawable.room_standard
        }
    }
}

data class CreateReservationRequest(
    val room_id: String,
    val check_in: String,
    val check_out: String,
    val guests: Int,
    val guests_adults: Int,
    val guests_children: Int,
    val special_request: String,
    val payment_method: String,
    val total_amount: Double,
    val addon_ids: List<String> = emptyList()
)

data class CreateReservationResponse(
    val id: String,
    val reservation_no: String,
    val total_amount: Double,
    val status: String
)

data class PayPalCreateOrderRequest(
    val amount: Double,
    val currency: String = "PHP",
    val description: String
)

data class PayPalCreateOrderResponse(
    val orderId: String,
    val status: String,
    val approveUrl: String?
)

data class PayPalCaptureOrderRequest(
    val orderId: String
)

data class PayPalCaptureOrderResponse(
    val orderId: String,
    val status: String,
    val captureId: String?,
    val captureStatus: String?
)

data class FeedbackRequest(
    val reservation_id: String,
    val rating: Int,
    val comment: String
)

data class ApiMessage(val message: String)

data class UploadIdResponse(
    val message: String,
    val url: String
)

data class Availability(
    val date: String,
    val is_available: Boolean
)

data class DayAvailability(
    val date: String,
    val status: String  // "available", "partially_booked", "fully_booked"
)
