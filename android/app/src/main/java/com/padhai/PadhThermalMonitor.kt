package com.padhai

import android.content.Context
import android.os.PowerManager
import com.facebook.react.bridge.*

class PadhThermalMonitor(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private val powerManager = reactApplicationContext
        .getSystemService(Context.POWER_SERVICE) as PowerManager
    
    override fun getName(): String = "PadhThermalMonitor"
    
    @ReactMethod
    fun getThermalState(promise: Promise) {
        try {
            val thermalStatus = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                powerManager.currentThermalStatus
            } else {
                PowerManager.THERMAL_STATUS_NONE
            }
            
            val thermalHeadroom = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                powerManager.getThermalHeadroom(10) // 10 second forecast
            } else {
                1.0f // Assume nominal on older devices
            }
            
            val state = when {
                thermalHeadroom >= 0.7 -> "nominal"
                thermalHeadroom >= 0.5 -> "light"
                thermalHeadroom >= 0.3 -> "moderate"
                thermalHeadroom >= 0.1 -> "severe"
                else -> "critical"
            }
            
            val result = Arguments.createMap().apply {
                putString("state", state)
                putDouble("headroom", thermalHeadroom.toDouble())
                putInt("status", thermalStatus)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("THERMAL_ERROR", "Failed to get thermal state", e)
        }
    }
}
