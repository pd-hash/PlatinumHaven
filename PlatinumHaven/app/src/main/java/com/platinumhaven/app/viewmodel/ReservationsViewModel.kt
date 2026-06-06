package com.platinumhaven.app.viewmodel

import android.content.Context
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.platinumhaven.app.data.FeedbackRequest
import com.platinumhaven.app.data.Reservation
import com.platinumhaven.app.data.TokenStore
import com.platinumhaven.app.network.RetrofitClient
import com.platinumhaven.app.network.SmsService
import kotlinx.coroutines.launch
import org.json.JSONObject

class ReservationsViewModel : ViewModel() {

    private val api = RetrofitClient.api

    // ── RESERVATIONS ──────────────────────────────────────────
    private val _reservations = MutableLiveData<List<Reservation>>()
    val reservations: LiveData<List<Reservation>> = _reservations

    private val _loading = MutableLiveData<Boolean>()
    val loading: LiveData<Boolean> = _loading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    fun loadReservations(context: Context) {
        viewModelScope.launch {
            _loading.value = true
            _error.value = null
            try {
                val token = TokenStore.getBearerToken(context)
                val response = api.getMyReservations(token)
                if (response.isSuccessful) {
                    _reservations.value = response.body() ?: emptyList()
                } else {
                    _error.value = "Failed to load reservations"
                }
            } catch (e: Exception) {
                _error.value = "Cannot connect to server. Check your WiFi."
            } finally {
                _loading.value = false
            }
        }
    }

    // ── CANCEL RESERVATION ────────────────────────────────────
    private val _cancelResult = MutableLiveData<Result<Boolean>?>()
    val cancelResult: LiveData<Result<Boolean>?> = _cancelResult

    fun cancelReservation(context: Context, reservationId: String) {
        viewModelScope.launch {
            try {
                val token = TokenStore.getBearerToken(context)
                val response = api.updateReservation(
                    token, reservationId, mapOf("status" to "Cancelled")
                )
                if (response.isSuccessful) {
                    _cancelResult.value = Result.success(true)
                    loadReservations(context)
                } else {
                    _cancelResult.value = Result.failure(
                        Exception(parseErrorMessage(response.errorBody()?.string(), "Could not cancel reservation"))
                    )
                }
            } catch (e: Exception) {
                _cancelResult.value = Result.failure(
                    Exception("Cannot connect to server.")
                )
            }
        }
    }

    fun clearCancelResult() {
        _cancelResult.value = null
    }

    // ── FEEDBACK ──────────────────────────────────────────────
    private val _feedbackResult = MutableLiveData<Result<Boolean>?>()
    val feedbackResult: LiveData<Result<Boolean>?> = _feedbackResult

    fun submitFeedback(
        context: Context,
        reservationId: String,
        rating: Int,
        comment: String
    ) {
        viewModelScope.launch {
            try {
                val token = TokenStore.getBearerToken(context)
                val response = api.submitFeedback(
                    token, FeedbackRequest(reservationId, rating, comment)
                )
                if (response.isSuccessful) {
                    _feedbackResult.value = Result.success(true)
                    loadReservations(context)
                } else {
                    _feedbackResult.value = Result.failure(
                        Exception(parseErrorMessage(response.errorBody()?.string(), "Failed to submit feedback"))
                    )
                }
            } catch (e: Exception) {
                _feedbackResult.value = Result.failure(
                    Exception("Cannot connect to server.")
                )
            }
        }
    }

    fun clearFeedbackResult() {
        _feedbackResult.value = null
    }

    // ── CHECK-IN REMINDER SMS ─────────────────────────────────
    fun sendCheckInReminder(context: Context, roomName: String, checkIn: String) {
        viewModelScope.launch {
            try {
                val phone = TokenStore.getUserPhone(context)
                val name  = TokenStore.getUserName(context) ?: "Guest"
                if (!phone.isNullOrEmpty()) {
                    SmsService.sendCheckInReminder(
                        phone     = phone,
                        guestName = name,
                        roomName  = roomName,
                        checkIn   = checkIn
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun parseErrorMessage(rawBody: String?, fallback: String): String {
        if (rawBody.isNullOrBlank()) return fallback
        return try {
            JSONObject(rawBody).optString("error").ifBlank { fallback }
        } catch (_: Exception) {
            fallback
        }
    }
}
