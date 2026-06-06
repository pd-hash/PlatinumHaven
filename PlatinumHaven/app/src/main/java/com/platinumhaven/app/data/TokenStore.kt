package com.platinumhaven.app.data

import android.content.Context

object TokenStore {
    private const val PREF_NAME = "platinum_prefs"
    private const val KEY_TOKEN = "auth_token"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_USER_NAME = "user_name"
    private const val KEY_USER_EMAIL = "user_email"
    private const val KEY_USER_PHONE = "user_phone"
    private const val KEY_USER_FIRST = "user_first"
    private const val KEY_USER_MIDDLE = "user_middle"
    private const val KEY_USER_LAST = "user_last"
    private const val KEY_USER_SEX = "user_sex"
    private const val KEY_APPROVAL = "approval_status"
    private const val KEY_PAYPAL_PENDING_ORDER = "paypal_pending_order"
    private const val KEY_PAYPAL_CALLBACK_URI = "paypal_callback_uri"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    fun saveToken(context: Context, token: String) {
        prefs(context).edit().putString(KEY_TOKEN, token).apply()
    }

    fun getToken(context: Context): String? =
        prefs(context).getString(KEY_TOKEN, null)

    fun getBearerToken(context: Context): String =
        "Bearer ${getToken(context)}"

    fun saveUser(context: Context, user: User) {
        prefs(context).edit()
            .putString(KEY_USER_ID, user.id)
            .putString(KEY_USER_NAME, user.full_name)
            .putString(KEY_USER_EMAIL, user.email)
            .putString(KEY_USER_PHONE, user.phone)
            .putString(KEY_USER_FIRST, user.first_name)
            .putString(KEY_USER_MIDDLE, user.middle_name)
            .putString(KEY_USER_LAST, user.last_name)
            .putString(KEY_USER_SEX, user.sex)
            .putString(KEY_APPROVAL, user.approval_status)
            .apply()
    }

    fun getUserName(context: Context): String? =
        prefs(context).getString(KEY_USER_NAME, null)

    fun getUserEmail(context: Context): String? =
        prefs(context).getString(KEY_USER_EMAIL, null)

    fun getUserPhone(context: Context): String? =
        prefs(context).getString(KEY_USER_PHONE, null)

    fun getUserFirstName(context: Context): String? =
        prefs(context).getString(KEY_USER_FIRST, null)

    fun getUserMiddleName(context: Context): String? =
        prefs(context).getString(KEY_USER_MIDDLE, null)

    fun getUserLastName(context: Context): String? =
        prefs(context).getString(KEY_USER_LAST, null)

    fun getUserSex(context: Context): String? =
        prefs(context).getString(KEY_USER_SEX, null)

    fun getApprovalStatus(context: Context): String? =
        prefs(context).getString(KEY_APPROVAL, null)

    fun savePendingPayPalOrder(context: Context, orderId: String) {
        prefs(context).edit().putString(KEY_PAYPAL_PENDING_ORDER, orderId).apply()
    }

    fun getPendingPayPalOrder(context: Context): String? =
        prefs(context).getString(KEY_PAYPAL_PENDING_ORDER, null)

    fun clearPendingPayPalOrder(context: Context) {
        prefs(context).edit().remove(KEY_PAYPAL_PENDING_ORDER).apply()
    }

    fun savePayPalCallback(context: Context, callbackUri: String) {
        prefs(context).edit().putString(KEY_PAYPAL_CALLBACK_URI, callbackUri).apply()
    }

    fun getPayPalCallback(context: Context): String? =
        prefs(context).getString(KEY_PAYPAL_CALLBACK_URI, null)

    fun clearPayPalCallback(context: Context) {
        prefs(context).edit().remove(KEY_PAYPAL_CALLBACK_URI).apply()
    }

    fun isLoggedIn(context: Context): Boolean =
        getToken(context) != null

    fun isApproved(context: Context): Boolean =
        getApprovalStatus(context) == "Approved"

    fun clear(context: Context) {
        prefs(context).edit().clear().apply()
    }
}
