package com.padhai.modules.llm

import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Binder
import android.os.IBinder
import android.util.Log
import com.facebook.react.bridge.Promise
import com.padhai.modules.llm.InferenceEngine
import kotlinx.coroutines.*

class ServerLifecycleService : Service() {

    private val binder = LocalBinder()
    private var localLlmServer: LocalLlmServer? = null
    private var activeEngine: InferenceEngine? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    var isServerActive = false
        private set

    private var currentServerMode: String = "kill_on_close"
    private var watchdogJob: Job? = null
    
    private var lastUseGpu: Boolean = true
    private var lastModelPath: String? = null
    private var lastMaxTokens: Int = 512
    private var lastTemp: Float = 0.7f
    
    private val NOTIFICATION_ID = 888
    private val CHANNEL_ID = "padhai_server_channel"

    inner class LocalBinder : Binder() {
        fun getService(): ServerLifecycleService = this@ServerLifecycleService
    }

    override fun onCreate() {
        super.onCreate()
        Log.i("ServerLifecycle", "Service onCreate - initializing foreground state")
        createNotificationChannel()
        startForegroundCompat()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i("ServerLifecycle", "Service onStartCommand - ensuring foreground state")
        startForegroundCompat()
        return if (currentServerMode == "kill_on_close") START_NOT_STICKY else START_STICKY
    }

    private fun createNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val serviceChannel = android.app.NotificationChannel(
                CHANNEL_ID,
                "Padh.ai LLM Daemon",
                android.app.NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps the local AI engine running in the background"
                setShowBadge(false)
            }
            val manager = getSystemService(android.app.NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private fun startForegroundCompat() {
        try {
            val notificationIntent = Intent(this, com.padhai.MainActivity::class.java)
            val pendingIntent = android.app.PendingIntent.getActivity(
                this, 0, notificationIntent,
                android.app.PendingIntent.FLAG_IMMUTABLE
            )

            val notification = androidx.core.app.NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Padh.ai Local Engine")
                .setContentText("Intelligent assistant is ready to help")
                .setSmallIcon(android.R.drawable.ic_menu_info_details)
                .setPriority(androidx.core.app.NotificationCompat.PRIORITY_LOW)
                .setCategory(androidx.core.app.NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build()

            if (android.os.Build.VERSION.SDK_INT >= 34) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            Log.e("ServerLifecycle", "Failed to start foreground service: ${e.message}")
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        if (currentServerMode == "kill_on_close") {
            Log.i("ServerLifecycle", "Task removed, instant kill active. Shredding server.")
            stopModel()
            stopSelf()
        }
    }

    override fun onDestroy() {
        Log.i("ServerLifecycle", "Service onDestroy - stopping server and foreground state")
        stopModel()
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            stopForeground(true)
        }
        watchdogJob?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder {
        return binder
    }

    /**
     * Start the server. Accepts any InferenceEngine (MediaPipe or LiteRT-LM).
     *
     * Model loading (engine.initialize() for LiteRT-LM) runs on a background
     * thread because it takes 5-10 seconds for large models like Gemma 4.
     * The NanoHTTPD server starts AFTER the model is ready.
     */
    fun startModel(inferenceEngine: InferenceEngine, port: Int, modelPath: String, maxTokens: Int, temp: Float, useGpu: Boolean, serverMode: String, promise: Promise? = null) {
        if (activeEngine != null && activeEngine !== inferenceEngine) {
            Log.w("ServerLifecycle", "New engine instance provided. Unloading old engine to prevent OOM memory leak!")
            activeEngine?.unloadModel()
        }
        activeEngine = inferenceEngine
        currentServerMode = serverMode
        
        lastModelPath = modelPath
        lastMaxTokens = maxTokens
        lastTemp = temp
        lastUseGpu = useGpu
        
        scope.launch {
            try {
                // CRITICAL: Load the model FIRST before starting the server
                if (!inferenceEngine.isModelLoaded()) {
                    Log.i("ServerLifecycle", "Loading model on background thread (this may take 5-10s)...")
                    inferenceEngine.loadModel(modelPath, maxTokens, temp, 1, useGpu)
                    Log.i("ServerLifecycle", "Model loaded successfully")
                }
                
                // Only start the server AFTER the model is fully loaded
                if (localLlmServer == null || !localLlmServer!!.isAlive) {
                    localLlmServer = LocalLlmServer(port, inferenceEngine, this@ServerLifecycleService)
                    localLlmServer?.start()
                    isServerActive = true
                    Log.i("ServerLifecycle", "Local LLM Server started on port $port")
                }
                
                // Resolve promise on Main thread after everything is ready
                withContext(Dispatchers.Main) {
                    promise?.resolve("Server started successfully")
                }
                
                manageWatchdog()
                
            } catch (e: Exception) {
                Log.e("ServerLifecycle", "Failed to start model/server", e)
                withContext(Dispatchers.Main) {
                    isServerActive = false
                    activeEngine = null
                    promise?.reject("START_ERROR", "Failed to start server: ${e.message}")
                }
            }
        }
    }

    private fun manageWatchdog() {
        watchdogJob?.cancel()
        if (currentServerMode == "auto_sleep") {
            watchdogJob = scope.launch {
                while (isActive) {
                    delay(60_000) // check every minute
                    localLlmServer?.let { server ->
                        val idleTime = System.currentTimeMillis() - server.lastRequestTime.get()
                        if (idleTime > 15 * 60 * 1000) { // 15 mins
                            activeEngine?.takeIf { it.isModelLoaded() }?.let { engine ->
                                Log.i("ServerLifecycle", "Watchdog: Server idle for >15m. Unloading model to save RAM.")
                                engine.unloadModel()
                                System.gc()
                            }
                        }
                    }
                }
            }
        }
    }

    fun wakeEngineIfNeeded() {
        // Called conditionally by LocalLlmServer if a request hits, 
        // to safely reload logic when in Auto-Sleep
        val engine = activeEngine
        val path = lastModelPath
        
        if (engine != null && path != null && !engine.isModelLoaded()) {
            Log.i("ServerLifecycle", "Cold Start triggered! Reloading model...")
            try {
                engine.loadModel(path, lastMaxTokens, lastTemp, 1, lastUseGpu)
                Log.i("ServerLifecycle", "Cold start complete.")
            } catch (e: Exception) {
                Log.e("ServerLifecycle", "Cold start failed", e)
            }
        }
    }

    /**
     * Stop the server and clear RAM.
     */
    fun stopModel() {
        if (localLlmServer != null && localLlmServer!!.isAlive) {
            localLlmServer?.stop()
            localLlmServer = null
        }
        activeEngine?.unloadModel()
        activeEngine = null
        isServerActive = false
        
        // Explicitly hint the GC to reclaim the ~3GB model weights NOW.
        // Without this, Android's memory manager might still see high RSS
        // and aggressively kill the app when the user switches away.
        System.gc()
        Log.i("ServerLifecycle", "Local LLM Server stopped, model unloaded, GC requested.")
    }
}
