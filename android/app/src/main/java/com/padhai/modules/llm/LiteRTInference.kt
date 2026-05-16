package com.padhai.modules.llm

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn

import org.json.JSONArray
import org.json.JSONObject

/**
 * LiteRT-LM inference engine for .litertlm models (Gemma 4 etc.).
 */
class LiteRTInference(private val context: Context) : InferenceEngine {
    private val wrapper = LiteRTEngineWrapper(context)

    override fun loadModel(modelPath: String, maxTokens: Int, temperature: Float, topK: Int, useGpu: Boolean) {
        try {
            wrapper.loadModel(
                modelPath = modelPath,
                temperature = temperature,
                topK = topK,
                topP = 0.95, // Default topP
                maxTokens = maxTokens,
                useGpu = useGpu
            )
            Log.d("LiteRTInference", "Model loaded via LiteRT-LM SDK: $modelPath")
        } catch (e: Exception) {
            Log.e("LiteRTInference", "Error loading LiteRT model", e)
            throw e
        }
    }

    override fun generateResponseSync(prompt: String): String {
        if (!wrapper.isLoaded) {
            throw Exception("LiteRT Engine not loaded yet")
        }
        return wrapper.sendMessageSync(prompt)
    }

    override suspend fun generateResponseAsync(prompt: String): Flow<String> {
        if (!wrapper.isLoaded) {
            throw Exception("LiteRT Engine not loaded yet")
        }
        
        return flow {
            try {
                wrapper.sendMessageStream(prompt)
                    .flowOn(Dispatchers.IO)
                    .collect { chunk -> emit(chunk) }
            } catch (e: Exception) {
                Log.e("LiteRTInference", "Streaming failed mid-generation", e)
                emit("\n\n[⚠️ Generation interrupted: ${e.message}]")
            }
        }
    }

    override suspend fun chatStream(messagesJson: String): Flow<String> {
        if (!wrapper.isLoaded) throw Exception("LiteRT Engine not loaded")
        
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
            } else if (role == "assistant") {
                fullPrompt.append("<start_of_turn>model\n")
                fullPrompt.append(content)
                fullPrompt.append("<end_of_turn>\n")
            } else if (role == "user") {
                fullPrompt.append("<start_of_turn>user\n")
                if (i == messages.length() - 1 && systemPrompt.isNotEmpty()) {
                    // Prepend system prompt to the last user message
                    fullPrompt.append("Instructions: $systemPrompt\n\n")
                }
                fullPrompt.append(content)
                fullPrompt.append("<end_of_turn>\n")
            }
        }
        
        // Final turn marker
        fullPrompt.append("<start_of_turn>model\n")

        return flow {
            try {
                wrapper.sendMessageStream(fullPrompt.toString())
                    .flowOn(Dispatchers.IO)
                    .collect { emit(it) }
            } catch (e: Exception) {
                Log.e("LiteRTInference", "Chat stream failed", e)
                emit("\n\n[⚠️ Error: ${e.message}]")
            }
        }.flowOn(Dispatchers.IO)
    }

    override fun unloadModel() {
        wrapper.close()
        Log.d("LiteRTInference", "LiteRT Engine unloaded")
    }

    override fun isModelLoaded(): Boolean {
        return wrapper.isLoaded
    }
}
