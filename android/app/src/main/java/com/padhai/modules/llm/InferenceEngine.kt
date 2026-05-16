package com.padhai.modules.llm

import kotlinx.coroutines.flow.Flow

interface InferenceEngine {
    fun loadModel(modelPath: String, maxTokens: Int, temperature: Float, topK: Int, useGpu: Boolean)
    
    // Legacy raw prompt support
    fun generateResponseSync(prompt: String): String
    suspend fun generateResponseAsync(prompt: String): Flow<String>

    // New structured chat support for Tool Calling
    suspend fun chatStream(messagesJson: String): Flow<String>
    
    fun unloadModel()
    fun isModelLoaded(): Boolean
}
