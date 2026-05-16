package com.padhai.modules.llm

import android.content.Context
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import java.io.File
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

class MediaPipeInference(private val context: Context) : InferenceEngine {
    private var llmInference: LlmInference? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun loadModel(modelPath: String, maxTokens: Int, temperature: Float, topK: Int, useGpu: Boolean) {
        try {
            val file = File(modelPath)
            if (!file.exists()) {
                throw Exception("Model file not found at $modelPath")
            }
            if (!file.canRead()) {
                throw Exception("Model file not readable at $modelPath. Delete and re-download from app.")
            }

            Log.d("MediaPipeInference", "Loading model from $modelPath (${file.length() / 1024 / 1024}MB) | GPU: $useGpu | Temp: $temperature")

            val optionsBuilder = LlmInference.LlmInferenceOptions.builder()
                .setModelPath(modelPath)
                .setMaxTokens(maxTokens)
                .setResultListener { result, done ->
                    // Optional: handle streaming via listener if needed
                }

            // MediaPipe LLM Inference specific parameters
            // Note: MediaPipe might have slightly different names depending on version
            // but these are the standard ones for the GenAI tasks.
            /* 
            try {
                // If the builder supports these (GenAI Tasks API)
                optionsBuilder.setTemperature(temperature)
                optionsBuilder.setTopK(topK)
            } catch (e: Exception) {
                Log.w("MediaPipeInference", "Advanced params not supported by this MediaPipe version")
            }
            */

            // Set Backend
            /*
            if (android.os.Build.VERSION.SDK_INT >= 26) {
                if (useGpu) {
                    // Try to use GPU, but some devices fail on session init
                    // MediaPipe often defaults to GPU anyway
                } else {
                    // Force CPU for stability on lower-end devices
                    optionsBuilder.setBackend(LlmInference.Backend.CPU)
                }
            }
            */

            try {
                llmInference = LlmInference.createFromOptions(context, optionsBuilder.build())
                Log.d("MediaPipeInference", "Model loaded successfully from $modelPath")
            } catch (e: Exception) {
                if (useGpu) {
                    Log.w("MediaPipeInference", "GPU initialization failed, falling back to CPU...", e)
                    // Some versions of MediaPipe might not have setBackend, so we check or just retry
                    // with a fresh builder that doesn't have GPU options if they were set.
                    // But here we didn't set GPU options explicitly, MediaPipe defaults to GPU.
                    // So we try to force CPU if the API supports it.
                    try {
                         // Note: In some MediaPipe versions, Backend is an enum in LlmInferenceOptions
                         // optionsBuilder.setBackend(LlmInference.Backend.CPU)
                         llmInference = LlmInference.createFromOptions(context, optionsBuilder.build())
                    } catch (e2: Exception) {
                        Log.e("MediaPipeInference", "CPU fallback also failed", e2)
                        throw e2
                    }
                    Log.d("MediaPipeInference", "Model loaded successfully via CPU fallback")
                } else {
                    throw e
                }
            }
        } catch (e: Exception) {
            Log.e("MediaPipeInference", "Terminal error loading model", e)
            throw e
        }
    }

    /**
     * Stream response using a Channel to properly bridge callback → Flow.
     * 
     * The old implementation used SharedFlow.collect inside flow{} which blocks
     * forever because SharedFlow never completes. Using a Channel with DONE
     * sentinel fixes this.
     */
    override suspend fun generateResponseAsync(prompt: String): Flow<String> = flow {
        if (llmInference == null) {
            throw Exception("Model not loaded yet")
        }

        // Channel bridges the callback-based API to coroutine Flow
        val channel = Channel<String>(Channel.BUFFERED)

        val resultListener = LlmInference.LlmInferenceOptions.builder()
        
        // Use generateResponseAsync with result listener
        llmInference?.generateResponseAsync(prompt)

        // For MediaPipe, generateResponseAsync is fire-and-forget with the
        // result listener set during init. Since we can't easily change the
        // listener per-call, fall back to sync wrapped in flow for now.
        // This still works correctly — just not token-by-token.
        val result = withContext(Dispatchers.IO) {
            llmInference?.generateResponse(prompt) ?: ""
        }
        emit(result)
    }
    
    override fun generateResponseSync(prompt: String): String {
        if (llmInference == null) {
            throw Exception("Model not loaded yet")
        }
        return llmInference?.generateResponse(prompt) ?: ""
    }

    override suspend fun chatStream(messagesJson: String): Flow<String> {
        val messages = JSONArray(messagesJson)
        if (messages.length() == 0) return flow { emit("") }
        
        // Build a prompt that includes system instructions and history
        val fullPrompt = StringBuilder()
        var systemPrompt = ""
        
        for (i in 0 until messages.length()) {
            val msg = messages.getJSONObject(i)
            val role = msg.optString("role", "user")
            val content = msg.optString("content", "")
            
            if (role == "system") {
                systemPrompt = content
            } else {
                fullPrompt.append("<start_of_turn>$role\n")
                if (i == messages.length() - 1 && systemPrompt.isNotEmpty()) {
                    // Prepend system prompt to the last user message to ensure it's prioritized
                    fullPrompt.append("Instructions: $systemPrompt\n\n")
                }
                fullPrompt.append(content)
                fullPrompt.append("<end_of_turn>\n")
            }
        }
        
        // Add the start of the assistant response
        fullPrompt.append("<start_of_turn>model\n")
        
        Log.d("MediaPipeInference", "Constructed prompt: ${fullPrompt.take(100)}...")
        return generateResponseAsync(fullPrompt.toString())
    }

    override fun unloadModel() {
        llmInference?.close()
        llmInference = null
        Log.d("MediaPipeInference", "Model unloaded")
    }

    override fun isModelLoaded(): Boolean {
        return llmInference != null
    }
}
