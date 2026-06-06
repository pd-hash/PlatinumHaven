package com.platinumhaven.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

object SmsService {

    // ⚠️ Replace with your TextBee credentials from textbee.dev/dashboard
    private const val API_KEY   = "f37d98a5-dbb0-4678-ac5d-44180a289763"
    private const val DEVICE_ID = "69d8453cb5cd3ce4c710ed6f"
    private const val SMS_URL   = "https://api.textbee.dev/api/v1/gateway/devices/$DEVICE_ID/send-sms"

    private val client = OkHttpClient()

    suspend fun sendSms(phone: String, message: String): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val json = JSONObject().apply {
                    put("recipients", JSONArray().put(formatPhone(phone)))
                    put("message", message)
                }

                val body = json.toString()
                    .toRequestBody("application/json".toMediaType())

                val request = Request.Builder()
                    .url(SMS_URL)
                    .addHeader("x-api-key", API_KEY)
                    .addHeader("Content-Type", "application/json")
                    .post(body)
                    .build()

                val response = client.newCall(request).execute()
                response.isSuccessful
            } catch (e: Exception) {
                e.printStackTrace()
                false
            }
        }
    }

    private fun formatPhone(phone: String): String {
        val cleaned = phone.replace(Regex("[^0-9]"), "")
        return when {
            cleaned.startsWith("0")  -> "+63${cleaned.substring(1)}"
            cleaned.startsWith("63") -> "+$cleaned"
            cleaned.startsWith("+")  -> phone
            else                     -> "+63$cleaned"
        }
    }

    // ── SMS TEMPLATES ──────────────────────────────────────────

    suspend fun sendBookingConfirmed(
        phone: String, guestName: String,
        reservationNo: String, roomName: String,
        checkIn: String, checkOut: String
    ) {
        val message = """
            Hi $guestName! Your booking at The Platinum Haven is CONFIRMED.
            Reservation: $reservationNo
            Room: $roomName
            Check-in: $checkIn
            Check-out: $checkOut
            Thank you for choosing us!
        """.trimIndent()
        sendSms(phone, message)
    }

    suspend fun sendPaymentReceived(
        phone: String, guestName: String,
        reservationNo: String, amount: String
    ) {
        val message = """
            Hi $guestName! Payment RECEIVED for your Platinum Haven booking.
            Reservation: $reservationNo
            Amount Paid: PHP $amount
            We look forward to your stay!
        """.trimIndent()
        sendSms(phone, message)
    }

    suspend fun sendAccountApproved(phone: String, guestName: String) {
        val message = """
            Hi $guestName! Your account at The Platinum Haven has been APPROVED.
            You can now login and start booking your stay.
            Welcome aboard!
        """.trimIndent()
        sendSms(phone, message)
    }

    suspend fun sendAccountRejected(phone: String, guestName: String) {
        val message = """
            Hi $guestName! We're sorry, your account at The Platinum Haven could not be verified.
            Please contact us for assistance.
        """.trimIndent()
        sendSms(phone, message)
    }

    suspend fun sendDigitalReceipt(
        phone: String, guestName: String,
        reservationNo: String, roomName: String,
        checkIn: String, checkOut: String,
        totalAmount: String, paymentMethod: String
    ) {
        val message = """
            DIGITAL RECEIPT - The Platinum Haven
            Hi $guestName! Your reservation is confirmed.
            
            Reservation: $reservationNo
            Room: $roomName
            Check-in: $checkIn
            Check-out: $checkOut
            Total: PHP $totalAmount
            Payment: $paymentMethod
            Status: CONFIRMED
            
            Thank you for choosing The Platinum Haven!
        """.trimIndent()
        sendSms(phone, message)
    }

    suspend fun sendCheckInReminder(
        phone: String, guestName: String,
        roomName: String, checkIn: String
    ) {
        val message = """
            Hi $guestName! Reminder: Your check-in at The Platinum Haven is TOMORROW.
            Room: $roomName
            Check-in Date: $checkIn
            We look forward to welcoming you!
        """.trimIndent()
        sendSms(phone, message)
    }
}