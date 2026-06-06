package com.platinumhaven.app.viewmodel

import android.content.Context
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.platinumhaven.app.data.CreateReservationRequest
import com.platinumhaven.app.data.CreateReservationResponse
import com.platinumhaven.app.data.PayPalCaptureOrderRequest
import com.platinumhaven.app.data.PayPalCaptureOrderResponse
import com.platinumhaven.app.data.PayPalCreateOrderRequest
import com.platinumhaven.app.data.PayPalCreateOrderResponse
import com.platinumhaven.app.data.TokenStore
import com.platinumhaven.app.network.RetrofitClient
import com.platinumhaven.app.network.SmsService
import kotlinx.coroutines.launch

class BookingViewModel : ViewModel() {

    private val api = RetrofitClient.api

    private val _bookingResult = MutableLiveData<Result<CreateReservationResponse>>()
    val bookingResult: LiveData<Result<CreateReservationResponse>> = _bookingResult

    private val _loading = MutableLiveData<Boolean>()
    val loading: LiveData<Boolean> = _loading

    private val _payPalOrderResult = MutableLiveData<Result<PayPalCreateOrderResponse>>()
    val payPalOrderResult: LiveData<Result<PayPalCreateOrderResponse>> = _payPalOrderResult

    private val _payPalCaptureResult = MutableLiveData<Result<PayPalCaptureOrderResponse>>()
    val payPalCaptureResult: LiveData<Result<PayPalCaptureOrderResponse>> = _payPalCaptureResult

    val selectedAddonIds = mutableListOf<String>()

    fun toggleAddon(addonId: String) {
        if (selectedAddonIds.contains(addonId)) {
            selectedAddonIds.remove(addonId)
        } else {
            selectedAddonIds.add(addonId)
        }
    }

    fun createPayPalOrder(
        context: Context,
        amount: Double,
        description: String
    ) {
        viewModelScope.launch {
            _loading.value = true
            try {
                val token = TokenStore.getBearerToken(context)
                val response = api.createPayPalOrder(
                    token,
                    PayPalCreateOrderRequest(
                        amount = amount,
                        description = description
                    )
                )

                if (response.isSuccessful && response.body() != null) {
                    _payPalOrderResult.value = Result.success(response.body()!!)
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Unable to start PayPal checkout"
                    _payPalOrderResult.value = Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                _payPalOrderResult.value = Result.failure(
                    Exception("Cannot connect to PayPal. Check your WiFi.")
                )
            } finally {
                _loading.value = false
            }
        }
    }

    fun capturePayPalOrder(
        context: Context,
        orderId: String
    ) {
        viewModelScope.launch {
            _loading.value = true
            try {
                val token = TokenStore.getBearerToken(context)
                val response = api.capturePayPalOrder(
                    token,
                    PayPalCaptureOrderRequest(orderId = orderId)
                )

                if (response.isSuccessful && response.body() != null) {
                    _payPalCaptureResult.value = Result.success(response.body()!!)
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Unable to capture PayPal payment"
                    _payPalCaptureResult.value = Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                _payPalCaptureResult.value = Result.failure(
                    Exception("Cannot finalize PayPal payment. Check your WiFi.")
                )
            } finally {
                _loading.value = false
            }
        }
    }

    fun createBooking(
        context: Context,
        roomId: String,
        checkIn: String,
        checkOut: String,
        guests: Int,
        adults: Int,
        children: Int,
        specialRequests: String,
        paymentMethod: String,
        roomName: String,
        totalAmount: Double = 0.0
    ) {
        viewModelScope.launch {
            _loading.value = true
            try {
                val token = TokenStore.getBearerToken(context)
                val request = CreateReservationRequest(
                    room_id         = roomId,
                    check_in        = checkIn,
                    check_out       = checkOut,
                    guests          = guests,
                    guests_adults   = adults,
                    guests_children = children,
                    special_request = specialRequests,
                    payment_method  = paymentMethod,
                    total_amount    = totalAmount,
                    addon_ids       = selectedAddonIds.toList()
                )
                val response = api.createReservation(token, request)
                if (response.isSuccessful && response.body() != null) {
                    val booking = response.body()!!
                    _bookingResult.value = Result.success(booking)

                    val phone = TokenStore.getUserPhone(context)
                    val name  = TokenStore.getUserName(context) ?: "Guest"
                    if (!phone.isNullOrEmpty()) {
                        SmsService.sendBookingConfirmed(
                            phone         = phone,
                            guestName     = name,
                            reservationNo = booking.reservation_no,
                            roomName      = roomName,
                            checkIn       = checkIn,
                            checkOut      = checkOut
                        )
                    }
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Booking failed"
                    _bookingResult.value = Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                _bookingResult.value = Result.failure(
                    Exception("Cannot connect to server. Check your WiFi.")
                )
            } finally {
                _loading.value = false
            }
        }
    }

    fun onPaypalPaymentSuccess(
        context: Context,
        reservationNo: String,
        amount: String
    ) {
        viewModelScope.launch {
            try {
                val phone = TokenStore.getUserPhone(context)
                val name  = TokenStore.getUserName(context) ?: "Guest"
                if (!phone.isNullOrEmpty()) {
                    SmsService.sendPaymentReceived(
                        phone         = phone,
                        guestName     = name,
                        reservationNo = reservationNo,
                        amount        = amount
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
