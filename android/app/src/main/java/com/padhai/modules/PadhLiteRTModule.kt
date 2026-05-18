package com.padhai.modules

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.padhai.modules.llm.InferenceEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import com.padhai.modules.llm.MediaPipeInference
import com.padhai.modules.llm.LiteRTInference
import com.padhai.modules.llm.ServerLifecycleService
import com.padhai.CoreSelector

class PadhLiteRTModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var serverService: ServerLifecycleService? = null
    private var isBound = false
    private var initPromise: Promise? = null

    // Dual-engine support
    private val mediaPipeEngine = MediaPipeInference(reactContext)
    private val liteRTEngine = LiteRTInference(reactContext)
    private var activeEngine: InferenceEngine? = null
    private val coreSelector = CoreSelector(reactContext)

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(className: ComponentName, service: IBinder) {
            val binder = service as ServerLifecycleService.LocalBinder
            serverService = binder.getService()
            isBound = true
            initPromise?.resolve("Service bound and initialized")
            initPromise = null
        }

        override fun onServiceDisconnected(arg0: ComponentName) {
            isBound = false
            serverService = null
        }
    }

    override fun getName(): String {
        return "PadhLocalServer"
    }

    @ReactMethod
    fun initializeService(promise: Promise) {
        if (isBound) {
            promise.resolve("Service already bound")
            return
        }
        initPromise = promise
        val intent = Intent(reactContext, ServerLifecycleService::class.java)
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            reactContext.bindService(intent, connection, Context.BIND_AUTO_CREATE)
        } catch (e: Exception) {
            Log.e("PadhLiteRT", "Failed to start/bind service", e)
            promise.reject("BIND_ERROR", e.message)
        }
    }

    @ReactMethod
    fun startServer(port: Int, modelPath: String, maxTokens: Int, temp: Double, runtime: String, useGpu: Boolean, serverMode: String, promise: Promise) {
        if (!isBound || serverService == null) {
            promise.reject("SERVER_ERROR", "ServerLifecycleService is not bound. Call initializeService first.")
            return
        }
        try {
            // Select engine based on runtime (litert or mediapipe)
            activeEngine = if (runtime == "litert" || modelPath.endsWith(".litertlm")) liteRTEngine else mediaPipeEngine
            serverService?.startModel(activeEngine!!, port, modelPath, maxTokens, temp.toFloat(), useGpu, serverMode, promise)
        } catch (e: Exception) {
            Log.e("PadhLiteRT", "StartServer failed", e)
            promise.reject("START_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopServer(promise: Promise) {
        if (!isBound || serverService == null) {
            promise.reject("SERVER_ERROR", "ServerLifecycleService is not bound.")
            return
        }
        try {
            serverService?.stopModel()
            activeEngine = null
            promise.resolve("Server stopped and RAM cleared.")
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getServerStatus(promise: Promise) {
        if (!isBound || serverService == null) {
            promise.resolve(false)
        } else {
            promise.resolve(serverService?.isServerActive ?: false)
        }
    }

    @ReactMethod
    fun resetCache(promise: Promise) {
        try {
            val cacheDir = java.io.File(reactContext.cacheDir, "litert_cache")
            if (cacheDir.exists()) {
                cacheDir.deleteRecursively()
                promise.resolve("Cache cleared")
            } else {
                promise.resolve("Cache already empty")
            }
        } catch (e: Exception) {
            promise.reject("CACHE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setCorePriority(mode: String, promise: Promise) {
        try {
            val strategy = when (mode) {
                "foreground" -> com.padhai.CoreStrategy.FOREGROUND
                "background" -> com.padhai.CoreStrategy.BACKGROUND
                "efficiency" -> com.padhai.CoreStrategy.EFFICIENCY
                else -> com.padhai.CoreStrategy.BALANCED
            }
            coreSelector.setCoreAffinity(strategy)
            promise.resolve("Priority set to $mode")
        } catch (e: Exception) {
            promise.reject("PRIORITY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Keep: Required for RN built in Event Emitter Calls.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep: Required for RN built in Event Emitter Calls.
    }

    @ReactMethod
    fun loadEngineDirect(modelPath: String, maxTokens: Int, temp: Double, useGpu: Boolean, promise: Promise) {
        try {
            // If the engine was already loaded by startServer(), reuse it.
            // This prevents the #1 crash: double-loading wastes ~1.5GB RAM
            // and corrupts native state (causing 0-token responses).
            if (liteRTEngine.isModelLoaded()) {
                Log.i("PadhLiteRT", "Engine already loaded (reusing from server). Skipping double-load.")
                activeEngine = liteRTEngine
                promise.resolve("Engine already loaded (reused from server)")
                return
            }
            liteRTEngine.loadModel(modelPath, maxTokens, temp.toFloat(), 40, useGpu)
            activeEngine = liteRTEngine
            promise.resolve("Engine loaded directly")
        } catch (e: Exception) {
            promise.reject("LOAD_ERROR", e.message)
        }
    }

    @ReactMethod
    fun generateResponseDirect(prompt: String, promise: Promise) {
        if (activeEngine == null) {
            promise.reject("ERROR", "No engine loaded. Call loadEngineDirect first.")
            return
        }
        try {
            val response = activeEngine!!.generateResponseSync(prompt)
            promise.resolve(response)
        } catch (e: Exception) {
            promise.reject("GEN_ERROR", e.message)
        }
    }

    @ReactMethod
    fun generateResponseStreamDirect(prompt: String) {
        if (activeEngine == null) {
            Log.e("PadhLiteRT", "No engine loaded for streaming")
            // Emit error event so JS side doesn't wait 15s for timeout
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("generation_error", "No engine loaded")
            return
        }
        CoroutineScope(Dispatchers.Main).launch {
            try {
                activeEngine!!.generateResponseAsync(prompt).collect { chunk ->
                    reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("onToken", chunk)
                }
                // Signal completion to JS — this was MISSING before,
                // causing the JS side to always wait for the 15s timeout.
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("generation_complete", "")
                Log.d("PadhLiteRT", "Stream generation completed successfully")
            } catch (e: Exception) {
                Log.e("PadhLiteRT", "Streaming failed", e)
                // Signal error to JS — this was MISSING before.
                // Without this, JS waits the full 15s timeout on every error.
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("generation_error", e.message ?: "Unknown streaming error")
            }
        }
    }
}
