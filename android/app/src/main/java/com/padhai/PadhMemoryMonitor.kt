package com.padhai

import android.app.ActivityManager
import android.content.Context
import com.facebook.react.bridge.*

class PadhMemoryMonitor(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String = "PadhMemoryMonitor"
    
    @ReactMethod
    fun getMemoryInfo(promise: Promise) {
        try {
            val activityManager = reactApplicationContext
                .getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            
            val memoryInfo = ActivityManager.MemoryInfo()
            activityManager.getMemoryInfo(memoryInfo)
            
            val runtime = Runtime.getRuntime()
            val usedMemory = runtime.totalMemory() - runtime.freeMemory()
            val totalMemory = runtime.maxMemory()
            val availableMemory = memoryInfo.availMem
            
            val result = Arguments.createMap().apply {
                putDouble("usedMemory", usedMemory.toDouble())
                putDouble("totalMemory", totalMemory.toDouble())
                putDouble("availableMemory", availableMemory.toDouble())
                putDouble("threshold", memoryInfo.threshold.toDouble())
                putBoolean("lowMemory", memoryInfo.lowMemory)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("MEMORY_ERROR", "Failed to get memory info", e)
        }
    }
}
