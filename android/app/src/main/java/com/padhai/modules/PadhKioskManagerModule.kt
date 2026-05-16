package com.padhai.modules

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import com.facebook.react.bridge.*

class PadhKioskManagerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "PadhKioskManager"
    }

    @ReactMethod
    fun startKioskMode(promise: Promise) {
        val activity = getCurrentActivity()
        if (activity != null) {
            try {
                activity.startLockTask()
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("KIOSK_ERROR", "Failed to enter kiosk mode: ${e.message}")
            }
        } else {
            promise.reject("KIOSK_ERROR", "Current activity is null")
        }
    }

    @ReactMethod
    fun stopKioskMode(promise: Promise) {
        val activity = getCurrentActivity()
        if (activity != null) {
            try {
                activity.stopLockTask()
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("KIOSK_ERROR", "Failed to exit kiosk mode: ${e.message}")
            }
        } else {
            promise.reject("KIOSK_ERROR", "Current activity is null")
        }
    }

    @ReactMethod
    fun isKioskModeActive(promise: Promise) {
        try {
            val activityManager = reactApplicationContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val lockTaskModeState = activityManager.lockTaskModeState
            promise.resolve(lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE)
        } catch (e: Exception) {
            promise.reject("KIOSK_ERROR", "Failed to check kiosk status: ${e.message}")
        }
    }
}
