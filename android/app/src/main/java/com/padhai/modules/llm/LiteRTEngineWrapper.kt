package com.padhai.modules.llm

import android.content.Context
import android.util.Log
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.ai.edge.litertlm.tool
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.Role
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Content
import kotlinx.coroutines.flow.Flow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Direct Kotlin wrapper for the LiteRT-LM SDK.
 *
 * Replaces the old Java-reflection-based wrapper with the official API:
 *   1. Engine(EngineConfig) → engine.initialize() → engine.createConversation()
 *   2. conversation.sendMessage(text)        → sync
 *   3. conversation.sendMessageAsync(text)   → Flow<Message> streaming
 *
 * This matches exactly how Google AI Edge Gallery runs Gemma 4.
 */
class LiteRTEngineWrapper(private val context: Context) {

    companion object {
        private const val TAG = "LiteRTEngine"
    }

    private var engine: Engine? = null
    private var conversation: Conversation? = null

    fun loadModel(
        modelPath: String,
        maxTokens: Int = 2048,
        temperature: Float = 0.7f,
        topK: Int = 40,
        topP: Double = 0.95,
        useGpu: Boolean = true,
        visionBackend: Backend? = null,
        audioBackend: Backend? = null
    ) {
        try {
            val file = File(modelPath)
            if (!file.exists()) {
                Log.e(TAG, "Model file NOT FOUND at: $modelPath")
                throw Exception("Model file not found at $modelPath")
            }
            
            val fileSizeMB = file.length() / 1024 / 1024
            Log.d(TAG, "Loading model: $modelPath (${fileSizeMB}MB)")
            
            // Verify file is not empty or suspiciously small
            if (file.length() < 100 * 1024) { // Less than 100KB is definitely wrong
                Log.e(TAG, "Model file is too small (${file.length()} bytes). Likely corrupted or incomplete download.")
                throw Exception("Model file appears to be corrupted or incomplete. Please re-download the model.")
            }
            
            // Verify file is readable
            if (!file.canRead()) {
                Log.e(TAG, "Model file exists but cannot be read. Check permissions.")
                throw Exception("Cannot read model file. Check app permissions.")
            }

            val cacheDir = File(context.cacheDir, "litert_cache").apply { mkdirs() }
            Log.d(TAG, "Cache dir: ${cacheDir.absolutePath}")
            
            // Ensure model directory is accessible
            file.parentFile?.let { dir ->
                if (!dir.canWrite()) {
                    Log.w(TAG, "Model directory is NOT writable: ${dir.absolutePath}. This may interfere with delegate initialization.")
                    try {
                        dir.setWritable(true)
                        dir.setExecutable(true)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to fix model directory permissions", e)
                    }
                }
            }

            // Log device info for debugging native crashes
            Log.i(TAG, "Device: ${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL} (API ${android.os.Build.VERSION.SDK_INT})")
            Log.i(TAG, "ABI: ${android.os.Build.SUPPORTED_ABIS.joinToString()}")

            // Try GPU first if requested, then fallback to CPU if it fails
            var lastError: Throwable? = null
            var eng: Engine? = null
            
            // Re-order backends for better stability on heterogeneous devices
            val backendsToTry = if (useGpu) {
                listOf(
                    Pair("GPU", { Backend.GPU() }),
                    Pair("NPU", { Backend.NPU() }),
                    Pair("CPU", { Backend.CPU() })
                )
            } else {
                listOf(Pair("CPU", { Backend.CPU() }))
            }
            
            for ((backendName, backendFactory) in backendsToTry) {
                try {
                    Log.d(TAG, "Attempting $backendName backend...")
                    val backend = try {
                         backendFactory()
                    } catch (t: Throwable) {
                        Log.w(TAG, "Backend factory for $backendName failed: ${t.message}")
                        continue 
                    }
                    
                    val engineConfig = EngineConfig(
                        modelPath = modelPath,
                        backend = backend,
                        cacheDir = cacheDir.absolutePath,
                        visionBackend = visionBackend ?: backend,
                        audioBackend = audioBackend ?: Backend.CPU()
                    )
                    
                    Log.d(TAG, "EngineConfig created. Initializing engine with $backendName...")

                    val startTime = System.currentTimeMillis()
                    val tempEng = try {
                        Engine(engineConfig)
                    } catch (t: Throwable) {
                        Log.e(TAG, "Engine constructor failed for $backendName", t)
                        continue
                    }

                    try {
                        tempEng.initialize()
                    } catch (t: Throwable) {
                        Log.e(TAG, "$backendName initialize() failed. Clearing cache and retrying ONCE...", t)
                        // Clear cache and try initialize one more time for this backend
                        try {
                            cacheDir.deleteRecursively()
                            cacheDir.mkdirs()
                            tempEng.initialize()
                        } catch (t2: Throwable) {
                            Log.e(TAG, "$backendName initialize() failed again after cache clear.", t2)
                            tempEng.close()
                            throw t2
                        }
                    }
                    
                    val duration = System.currentTimeMillis() - startTime
                    Log.i(TAG, "✓ Engine initialized successfully with $backendName in ${duration}ms")
                    eng = tempEng
                    break // Success! Exit the loop
                } catch (t: Throwable) {
                    Log.e(TAG, "✗ $backendName backend failed: ${t.message}", t)
                    lastError = t
                    // Ensure we release any native resources if initialize failed but constructor didn't
                }
            }
            
            if (eng == null) {
                // All backends failed
                val errorMsg = when {
                    lastError?.message?.contains("INTERNAL") == true -> 
                        "Model initialization failed. This could be due to:\n" +
                        "1. Corrupted model file (try re-downloading)\n" +
                        "2. Insufficient RAM (need ~6GB for this model)\n" +
                        "3. Incompatible device architecture\n" +
                        "Original error: ${lastError.message}"
                    else -> "LiteRT-LM Engine init failed: ${lastError?.message}"
                }
                throw Exception(errorMsg, lastError)
            }
            
            engine = eng

            val convConfig = ConversationConfig(
                samplerConfig = SamplerConfig(
                    topK = topK,
                    topP = topP,
                    temperature = temperature.toDouble()
                ),
                // Register our pedagogical tools
                tools = listOf(tool(PadhToolSet())),
                // We handle execution manually to route to React Native
                automaticToolCalling = false 
            )
            try {
                conversation = eng.createConversation(convConfig)
                Log.d(TAG, "Conversation created with Tools. LiteRT-LM is ready.")
            } catch (t: Throwable) {
                Log.e(TAG, "createConversation failed. Engine might be in invalid state.", t)
                throw Exception("LiteRT createConversation failed: ${t.message}", t)
            }
        } catch (e: Exception) {
            Log.e(TAG, "loadModel failed", e)
            close()
            throw e
        } catch (t: Throwable) {
            Log.e(TAG, "loadModel fatal Throwable", t)
            close()
            throw Exception("LiteRT fatal error: ${t.message}", t)
        }
    }

    fun sendMessageSync(prompt: String): String {
        val conv = conversation
            ?: throw IllegalStateException("Engine not initialized. Call loadModel() first.")

        return try {
            val response = conv.sendMessage(prompt)
            response.toString()
        } catch (t: Throwable) {
            Log.e(TAG, "sendMessage failed", t)
            throw Exception("LiteRT sendMessage failed: ${t.message}", t)
        }
    }

    /**
     * Resumes the conversation with a NATIVE tool result.
     * This uses the Message.tool role so the model knows it is an API response.
     */
    fun sendNativeToolResults(responses: List<Pair<String, String>>): Flow<String> {
        val conv = conversation ?: throw IllegalStateException("Not initialized")
        val toolResponses = responses.map { (name, result) ->
            Content.ToolResponse(name, result)
        }
        val toolMessage = Message.tool(Contents.of(toolResponses))
        return streamResponse(toolMessage)
    }

    /**
     * Internal helper to handle the streaming flow for any Message content.
     */
    private fun streamResponse(message: Any): Flow<String> {
        val conv = conversation ?: throw IllegalStateException("Not initialized")
        return kotlinx.coroutines.flow.flow {
            val buffer = StringBuilder()
            val flow = when (message) {
                is String -> conv.sendMessageAsync(message)
                is Message -> conv.sendMessageAsync(message)
                else -> throw IllegalArgumentException("Invalid message type")
            }

            flow.collect { response ->
                val toolCalls = response.toolCalls
                if (toolCalls.isNotEmpty()) {
                    val toolRequest = JSONObject().apply {
                        put("type", "tool_call")
                        put("calls", JSONArray().apply {
                            for (call in toolCalls) {
                                put(JSONObject().apply {
                                    put("name", call.name)
                                    put("args", JSONObject(call.arguments))
                                })
                            }
                        })
                    }
                    emit("@@TOOL_CALL@@" + toolRequest.toString())
                    return@collect
                }

                val text = response.toString()
                if (text.isNotEmpty()) {
                    buffer.append(text)
                    val lastChar = buffer.last()
                    if (lastChar.isWhitespace() || "\n\t.!?,".contains(lastChar)) {
                        emit(buffer.toString())
                        buffer.setLength(0)
                    }
                }
            }
            if (buffer.isNotEmpty()) emit(buffer.toString())
        }
    }

    fun sendMessageStream(prompt: String): Flow<String> = streamResponse(prompt)

    fun sendToolResult(callId: String, result: String): Flow<String> {
        // Legacy fallback - redirect to the new native results handler
        return sendNativeToolResults(listOf(Pair(callId, result)))
    }

    fun close() {
        Log.d(TAG, "Closing engine resources...")
        try { conversation?.close() } catch (t: Throwable) { Log.w(TAG, "Conv close error", t) }
        try { engine?.close() } catch (t: Throwable) { Log.w(TAG, "Engine close error", t) }
        conversation = null
        engine = null
        Log.d(TAG, "Resources released.")
    }

    val isLoaded: Boolean
        get() = engine != null && conversation != null
}
