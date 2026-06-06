package com.platinumhaven.app.viewmodel

import android.content.Context
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.platinumhaven.app.data.AddOn
import com.platinumhaven.app.data.Room
import com.platinumhaven.app.data.TokenStore
import com.platinumhaven.app.network.RetrofitClient
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class RoomsViewModel : ViewModel() {

    private val api = RetrofitClient.api

    private val _rooms = MutableLiveData<List<Room>>()
    val rooms: LiveData<List<Room>> = _rooms

    private val _featuredRooms = MutableLiveData<List<Room>>()
    val featuredRooms: LiveData<List<Room>> = _featuredRooms

    private val _roomsLoading = MutableLiveData<Boolean>()
    val roomsLoading: LiveData<Boolean> = _roomsLoading

    private val _roomsError = MutableLiveData<String?>()
    val roomsError: LiveData<String?> = _roomsError

    private fun currentMonthKey(): String =
        SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(Date())

    private fun visibleMobileRooms(rooms: List<Room>): List<Room> =
        rooms.filter { it.monthly_availability_status != "fully_booked" }

    fun loadRooms(context: Context, type: String? = null, search: String? = null) {
        viewModelScope.launch {
            _roomsLoading.value = true
            _roomsError.value   = null
            try {
                val token = TokenStore.getBearerToken(context)
                val response = api.getRooms(
                    token = token,
                    type = type,
                    search = search,
                    status = null,
                    includeMonthlyAvailability = true,
                    month = currentMonthKey()
                )
                if (response.isSuccessful) {
                    val allRooms = visibleMobileRooms(response.body() ?: emptyList())
                    _rooms.value = allRooms
                    _featuredRooms.value = allRooms.take(5)
                } else {
                    _roomsError.value = "Failed to load rooms"
                }
            } catch (e: Exception) {
                _roomsError.value = "Cannot connect to server. Check your WiFi."
            } finally {
                _roomsLoading.value = false
            }
        }
    }

    fun loadRoomsFiltered(
        context: Context,
        type: String? = null,
        search: String? = null,
        includeTypes: List<String> = emptyList()
    ) {
        viewModelScope.launch {
            _roomsLoading.value = true
            _roomsError.value   = null
            try {
                val token    = TokenStore.getBearerToken(context)
                val response = api.getRooms(
                    token = token,
                    type = type,
                    search = search,
                    status = null,
                    includeMonthlyAvailability = true,
                    month = currentMonthKey()
                )
                if (response.isSuccessful) {
                    val allRooms = visibleMobileRooms(response.body() ?: emptyList())
                    val filtered = if (includeTypes.isEmpty()) allRooms
                    else allRooms.filter { it.type in includeTypes }
                    _rooms.value        = filtered
                    _featuredRooms.value = allRooms.take(5)
                } else {
                    _roomsError.value = "Failed to load rooms"
                }
            } catch (e: Exception) {
                _roomsError.value = "Cannot connect to server. Check your WiFi."
            } finally {
                _roomsLoading.value = false
            }
        }
    }

    private val _addons = MutableLiveData<List<AddOn>>()
    val addons: LiveData<List<AddOn>> = _addons

    private val _addonsLoading = MutableLiveData<Boolean>()
    val addonsLoading: LiveData<Boolean> = _addonsLoading

    fun loadAddons(context: Context) {
        viewModelScope.launch {
            _addonsLoading.value = true
            try {
                val token    = TokenStore.getBearerToken(context)
                val response = api.getAddons(token)
                if (response.isSuccessful) {
                    _addons.value = response.body() ?: emptyList()
                }
            } catch (_: Exception) {}
            finally {
                _addonsLoading.value = false
            }
        }
    }
}
