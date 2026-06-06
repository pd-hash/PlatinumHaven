package com.platinumhaven.app.viewmodel

import android.content.Context
import android.net.Uri
import android.webkit.MimeTypeMap
import com.platinumhaven.app.data.ForgotPasswordCodeRequest
import com.platinumhaven.app.data.ForgotPasswordVerifyRequest
import com.platinumhaven.app.data.ForgotPasswordConfirmRequest
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.platinumhaven.app.data.LoginRequest
import com.platinumhaven.app.data.RegisterRequest
import com.platinumhaven.app.data.TokenStore
import com.platinumhaven.app.data.User
import com.platinumhaven.app.network.RetrofitClient
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File

class AuthViewModel : ViewModel() {

    private val api = RetrofitClient.api

    // ── LOGIN ─────────────────────────────────────────────────
    private val _loginResult = MutableLiveData<Result<User>>()
    val loginResult: LiveData<Result<User>> = _loginResult

    fun login(context: Context, email: String, password: String) {
        viewModelScope.launch {
            try {
                val response = api.login(LoginRequest(email, password))
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    val user = body.user

                    // Check if customer account is approved
                    if (user.role == "customer" &&
                        user.approval_status != "Approved") {
                        when (user.approval_status) {
                            "Pending" -> _loginResult.value = Result.failure(
                                Exception("Your account is pending approval. Please wait for manager verification.")
                            )
                            "Rejected" -> _loginResult.value = Result.failure(
                                Exception("Your account was rejected. Please contact us for assistance.")
                            )
                            else -> _loginResult.value = Result.failure(
                                Exception("Your account is not yet approved.")
                            )
                        }
                        return@launch
                    }

                    TokenStore.saveToken(context, body.token)
                    TokenStore.saveUser(context, user)
                    _loginResult.value = Result.success(user)
                } else {
                    _loginResult.value = Result.failure(
                        Exception("Invalid email or password")
                    )
                }
            } catch (e: Exception) {
                _loginResult.value = Result.failure(
                    Exception("Cannot connect to server. Check your WiFi.")
                )
            }
        }
    }

    // ── REGISTER ──────────────────────────────────────────────
    private val _registerResult = MutableLiveData<Result<String>>()
    val registerResult: LiveData<Result<String>> = _registerResult

    private val _validIdUploadResult = MutableLiveData<Result<String>?>()
    val validIdUploadResult: LiveData<Result<String>?> = _validIdUploadResult

    private val _forgotPasswordCodeResult = MutableLiveData<Result<String>>()
    val forgotPasswordCodeResult: LiveData<Result<String>> = _forgotPasswordCodeResult

    private val _forgotPasswordConfirmResult = MutableLiveData<Result<String>>()
    val forgotPasswordConfirmResult: LiveData<Result<String>> = _forgotPasswordConfirmResult

    private val _forgotPasswordVerifyResult = MutableLiveData<Result<String>>()
    val forgotPasswordVerifyResult: LiveData<Result<String>> = _forgotPasswordVerifyResult

    fun register(
        firstName: String,
        lastName: String,
        middleName: String,
        email: String,
        password: String,
        phone: String,
        sex: String,
        validIdUrl: String
    ) {
        viewModelScope.launch {
            try {
                val fullName = "$firstName $middleName $lastName".trim()
                val request = RegisterRequest(
                    first_name  = firstName,
                    last_name   = lastName,
                    middle_name = middleName,
                    email       = email,
                    password    = password,
                    phone       = phone,
                    sex         = sex,
                    full_name   = fullName,
                    valid_id_url = validIdUrl
                )
                val response = api.register(request)
                if (response.isSuccessful && response.body() != null) {
                    // Don't save token because the account needs approval first.
                    _registerResult.value = Result.success(
                        "Registration successful! Please wait for manager approval before logging in."
                    )
                } else {
                    _registerResult.value = Result.failure(
                        Exception("Email already registered or invalid data")
                    )
                }
            } catch (e: Exception) {
                _registerResult.value = Result.failure(
                    Exception("Cannot connect to server. Check your WiFi.")
                )
            }
        }
    }

    fun uploadValidId(context: Context, validIdUri: Uri) {
        viewModelScope.launch {
            try {
                _validIdUploadResult.value = Result.success(performUploadValidId(context, validIdUri))
            } catch (e: Exception) {
                _validIdUploadResult.value = Result.failure(
                    Exception(e.message ?: "Unable to upload the selected ID image.")
                )
            }
        }
    }

    fun clearValidIdUploadResult() {
        _validIdUploadResult.value = null
    }

    private suspend fun performUploadValidId(context: Context, validIdUri: Uri): String {
        val resolver = context.contentResolver
        val mimeType = resolver.getType(validIdUri) ?: "image/jpeg"
        val fileExtension = MimeTypeMap.getSingleton()
            .getExtensionFromMimeType(mimeType)
            ?.let { ".$it" }
            ?: ".jpg"
        val tempFile = File.createTempFile("valid-id-", fileExtension, context.cacheDir)

        try {
            resolver.openInputStream(validIdUri)?.use { input ->
                tempFile.outputStream().use { output -> input.copyTo(output) }
            } ?: throw IllegalStateException("Unable to read the selected ID image.")

            val requestBody = tempFile.asRequestBody(mimeType.toMediaTypeOrNull())
            val filePart = MultipartBody.Part.createFormData("file", tempFile.name, requestBody)
            val response = api.uploadValidId(filePart)

            if (!response.isSuccessful || response.body() == null) {
                val message = response.errorBody()?.string()
                    ?.substringAfter("\"error\":\"")
                    ?.substringBefore("\"")
                    ?.replace("\\n", "\n")
                    ?: "Unable to upload the selected ID image."
                throw IllegalStateException(message)
            }

            return response.body()!!.url
        } finally {
            tempFile.delete()
        }
    }

    fun requestPasswordResetCode(email: String) {
        viewModelScope.launch {
            try {
                val response = api.requestPasswordResetCode(
                    ForgotPasswordCodeRequest(email = email)
                )
                if (response.isSuccessful && response.body() != null) {
                    _forgotPasswordCodeResult.value = Result.success(
                        response.body()!!.message
                    )
                } else {
                    val message = response.errorBody()?.string()
                        ?.substringAfter("\"error\":\"")
                        ?.substringBefore("\"")
                        ?.replace("\\n", "\n")
                        ?: "Unable to send the verification code."
                    _forgotPasswordCodeResult.value = Result.failure(Exception(message))
                }
            } catch (e: Exception) {
                _forgotPasswordCodeResult.value = Result.failure(
                    Exception("Cannot connect to server. Check your WiFi.")
                )
            }
        }
    }

    fun confirmPasswordReset(email: String, code: String, newPassword: String) {
        viewModelScope.launch {
            try {
                val response = api.confirmPasswordReset(
                    ForgotPasswordConfirmRequest(
                        email = email,
                        code = code,
                        new_password = newPassword
                    )
                )
                if (response.isSuccessful && response.body() != null) {
                    _forgotPasswordConfirmResult.value = Result.success(
                        response.body()!!.message
                    )
                } else {
                    val message = response.errorBody()?.string()
                        ?.substringAfter("\"error\":\"")
                        ?.substringBefore("\"")
                        ?.replace("\\n", "\n")
                        ?: "Unable to reset password."
                    _forgotPasswordConfirmResult.value = Result.failure(Exception(message))
                }
            } catch (e: Exception) {
                _forgotPasswordConfirmResult.value = Result.failure(
                    Exception("Cannot connect to server. Check your WiFi.")
                )
            }
        }
    }

    fun verifyPasswordResetCode(email: String, code: String) {
        viewModelScope.launch {
            try {
                val response = api.verifyPasswordResetCode(
                    ForgotPasswordVerifyRequest(
                        email = email,
                        code = code
                    )
                )
                if (response.isSuccessful && response.body() != null) {
                    _forgotPasswordVerifyResult.value = Result.success(
                        response.body()!!.message
                    )
                } else {
                    val message = response.errorBody()?.string()
                        ?.substringAfter("\"error\":\"")
                        ?.substringBefore("\"")
                        ?.replace("\\n", "\n")
                        ?: "Unable to verify the code."
                    _forgotPasswordVerifyResult.value = Result.failure(Exception(message))
                }
            } catch (e: Exception) {
                _forgotPasswordVerifyResult.value = Result.failure(
                    Exception("Cannot connect to server. Check your WiFi.")
                )
            }
        }
    }

    // ── LOGOUT ────────────────────────────────────────────────
    fun logout(context: Context) {
        TokenStore.clear(context)
    }
}
