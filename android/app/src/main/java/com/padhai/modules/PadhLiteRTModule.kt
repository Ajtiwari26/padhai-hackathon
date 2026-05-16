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
import com.padhai.modules.llm.InferenceEngine
import com.padhai.modules.llm.MediaPipeInference
import com.padhai.modules.llm.LiteRTInference
import com.padhai.modules.llm.ServerLifecycleService

class PadhLiteRTModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var serverService: ServerLifecycleService? = null
    private var isBound = false
    private var initPromise: Promise? = null

    // Dual-engine support
    private val mediaPipeEngine = MediaPipeInference(reactContext)
    private val liteRTEngine = LiteRTInference(reactContext)
    private var activeEngine: InferenceEngine? = null

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
    fun addListener(eventName: String) {
        // Keep: Required for RN built in Event Emitter Calls.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep: Required for RN built in Event Emitter Calls.
    }
}
