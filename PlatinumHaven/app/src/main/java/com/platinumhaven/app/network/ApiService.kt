package com.platinumhaven.app.network

import com.platinumhaven.app.data.*
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // ── AUTH ──────────────────────────────────────────────────
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    @POST("auth/forgot-password/request")
    suspend fun requestPasswordResetCode(@Body request: ForgotPasswordCodeRequest): Response<ApiMessage>

    @POST("auth/forgot-password/verify")
    suspend fun verifyPasswordResetCode(@Body request: ForgotPasswordVerifyRequest): Response<ApiMessage>

    @POST("auth/forgot-password/confirm")
    suspend fun confirmPasswordReset(@Body request: ForgotPasswordConfirmRequest): Response<ApiMessage>

    @GET("auth/me")
    suspend fun getMe(@Header("Authorization") token: String): Response<User>

    // ── ROOMS ─────────────────────────────────────────────────
    @GET("rooms")
    suspend fun getRooms(
        @Header("Authorization") token: String,
        @Query("type") type: String? = null,
        @Query("search") search: String? = null,
        @Query("status") status: String? = null,
        @Query("include_monthly_availability") includeMonthlyAvailability: Boolean? = null,
        @Query("month") month: String? = null
    ): Response<List<Room>>

    // ── ADD-ONS ───────────────────────────────────────────────
    @GET("addons")
    suspend fun getAddons(
        @Header("Authorization") token: String
    ): Response<List<AddOn>>

    // ── RESERVATIONS ──────────────────────────────────────────
    @GET("reservations")
    suspend fun getMyReservations(
        @Header("Authorization") token: String
    ): Response<List<Reservation>>

    @POST("reservations")
    suspend fun createReservation(
        @Header("Authorization") token: String,
        @Body request: CreateReservationRequest
    ): Response<CreateReservationResponse>

    @POST("paypal/create-order")
    suspend fun createPayPalOrder(
        @Header("Authorization") token: String,
        @Body request: PayPalCreateOrderRequest
    ): Response<PayPalCreateOrderResponse>

    @POST("paypal/capture-order")
    suspend fun capturePayPalOrder(
        @Header("Authorization") token: String,
        @Body request: PayPalCaptureOrderRequest
    ): Response<PayPalCaptureOrderResponse>

    @PUT("reservations/{id}")
    suspend fun updateReservation(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body updates: Map<String, String>
    ): Response<Reservation>

    // ── FEEDBACK ──────────────────────────────────────────────
    @POST("feedback")
    suspend fun submitFeedback(
        @Header("Authorization") token: String,
        @Body request: FeedbackRequest
    ): Response<ApiMessage>

    // ── UPLOAD VALID ID ───────────────────────────────────────
    @Multipart
    @POST("auth/upload-id")
    suspend fun uploadValidId(
        @Part file: MultipartBody.Part
    ): Response<UploadIdResponse>

    // ── AVAILABILITY ──────────────────────────────────────────
    @GET("rooms/{id}/availability")
    suspend fun getRoomAvailability(
        @Header("Authorization") token: String,
        @Path("id") roomId: String,
        @Query("month") month: String
    ): Response<List<DayAvailability>>
}
