package com.padhai.modules

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.padhai.CoreSelector
import com.padhai.CoreStrategy
import com.padhai.ThermalState

/**
 * React Native bridge for CoreSelector
 * 
 * Exposes adaptive core selection functionality to JavaScript
 */
class CoreSelectorModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private val coreSelector: CoreSelector by lazy {
        CoreSelector(reactContext)
    }
    
    override fun getName(): String {
        return "CoreSelectorModule"
    }
    
    /**
     * Set CPU core affinity
     * 
     * @param strategy "foreground" | "background" | "balanced" | "efficiency"
     * @param promise Promise that resolves with success status
     */
    @ReactMethod
    fun setCoreAffinity(strategy: String, promise: Promise) {
        try {
            val coreStrategy = when (strategy.lowercase()) {
                "foreground" -> CoreStrategy.FOREGROUND
                "background" -> CoreStrategy.BACKGROUND
                "balanced" -> CoreStrategy.BALANCED
                "efficiency" -> CoreStrategy.EFFICIENCY
                else -> {
                    promise.reject("INVALID_STRATEGY", "Invalid strategy: $strategy")
                    return
                }
            }
            
            val success = coreSelector.setCoreAffinity(coreStrategy)
            
            if (success) {
                promise.resolve(true)
            } else {
                promise.reject("AFFINITY_FAILED", "Failed to set core affinity")
            }
            
        } catch (e: Exception) {
            promise.reject("ERROR", "Error setting core affinity: ${e.message}", e)
        }
    }
    
    /**
     * Select optimal core strategy based on context
     * 
     * @param priority "foreground" | "background"
     * @param batteryLevel Battery level (0-100)
     * @param promise Promise that resolves with recommended strategy
     */
    @ReactMethod
    fun selectOptimalStrategy(priority: String, batteryLevel: Int, promise: Promise) {
        try {
            val strategy = coreSelector.selectOptimalStrategy(priority, batteryLevel)
            promise.resolve(strategy.name.lowercase())
        } catch (e: Exception) {
            promise.reject("ERROR", "Error selecting strategy: ${e.message}", e)
        }
    }
    
    /**
     * Apply inference strategy
     * 
     * @param priority "foreground" | "background"
     * @param batteryLevel Battery level (0-100)
     * @param estimatedDuration Estimated duration in seconds
     * @param promise Promise that resolves when strategy is applied
     */
    @ReactMethod
    fun applyInferenceStrategy(
        priority: String,
        batteryLevel: Int,
        estimatedDuration: Int,
        promise: Promise
    ) {
        try {
            coreSelector.applyInferenceStrategy(priority, batteryLevel, estimatedDuration)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Error applying strategy: ${e.message}", e)
        }
    }
    
    /**
     * Get current core strategy
     * 
     * @param promise Promise that resolves with current strategy
     */
    @ReactMethod
    fun getCurrentStrategy(promise: Promise) {
        try {
            val strategy = coreSelector.getCurrentStrategy()
            promise.resolve(strategy.name.lowercase())
        } catch (e: Exception) {
            promise.reject("ERROR", "Error getting strategy: ${e.message}", e)
        }
    }
    
    /**
     * Get thermal state
     * 
     * @param promise Promise that resolves with thermal state
     */
    @ReactMethod
    fun getThermalState(promise: Promise) {
        try {
            val state = coreSelector.getThermalState()
            promise.resolve(state.name.lowercase())
        } catch (e: Exception) {
            promise.reject("ERROR", "Error getting thermal state: ${e.message}", e)
        }
    }
    
    /**
     * Get core topology information
     * 
     * @param promise Promise that resolves with topology info
     */
    @ReactMethod
    fun getCoreTopology(promise: Promise) {
        try {
            val topology = coreSelector.getCoreTopology()
            
            val result = Arguments.createMap().apply {
                putInt("totalCores", topology["totalCores"] as Int)
                putArray("bigCores", Arguments.fromList(topology["bigCores"] as List<*>))
                putArray("littleCores", Arguments.fromList(topology["littleCores"] as List<*>))
                putString("currentStrategy", topology["currentStrategy"] as String)
                putString("thermalState", topology["thermalState"] as String)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", "Error getting topology: ${e.message}", e)
        }
    }
    
    /**
     * Get power efficiency estimate
     * 
     * @param promise Promise that resolves with efficiency estimate (0.0 - 1.0)
     */
    @ReactMethod
    fun getPowerEfficiencyEstimate(promise: Promise) {
        try {
            val efficiency = coreSelector.getPowerEfficiencyEstimate()
            promise.resolve(efficiency)
        } catch (e: Exception) {
            promise.reject("ERROR", "Error getting efficiency: ${e.message}", e)
        }
    }
}
