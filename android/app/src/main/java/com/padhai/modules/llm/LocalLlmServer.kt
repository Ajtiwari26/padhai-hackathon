package com.padhai.modules.llm

import android.util.Log
import com.padhai.modules.llm.InferenceEngine
import fi.iki.elonen.NanoHTTPD
import org.json.JSONArray
import org.json.JSONObject
import java.io.PipedInputStream
import java.io.PipedOutputStream
import java.nio.charset.StandardCharsets
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collect
import java.util.UUID

import java.util.concurrent.atomic.AtomicLong

class LocalLlmServer(
    port: Int,
    private val inferenceEngine: InferenceEngine,
    private val lifecycleService: ServerLifecycleService? = null
) : NanoHTTPD("127.0.0.1", port) {

    val lastRequestTime = AtomicLong(System.currentTimeMillis())

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun serve(session: IHTTPSession): Response {
        lastRequestTime.set(System.currentTimeMillis())
        
        Log.d("LocalLlmServer", "Received request: ${session.method} ${session.uri}")
        
        if (session.uri == "/v1/chat/completions" && session.method == Method.POST) {
            lifecycleService?.wakeEngineIfNeeded()
            try {
                val map = HashMap<String, String>()
                session.parseBody(map)
                val bodyStr = map["postData"] ?: "{}"
                val jsonBody = JSONObject(bodyStr)
                
                val messages = jsonBody.optJSONArray("messages") ?: JSONArray()
                val isStreaming = jsonBody.optBoolean("stream", false)
                
                val messagesJson = messages.toString()
                
                if (isStreaming) {
                    return handleStreamingResponse(messagesJson)
                } else {
                    // Convert sync to a flow collection for simplicity
                    return handleSyncResponse(messagesJson)
                }

            } catch (e: Exception) {
                Log.e("LocalLlmServer", "Error processing request", e)
                val errorJson = JSONObject()
                errorJson.put("error", e.message ?: "Unknown server error")
                errorJson.put("type", "server_error")
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "application/json", errorJson.toString())
            }
        }
        
        if (session.uri == "/v1/models" && session.method == Method.GET) {
            val response = """
                {
                  "object": "list",
                  "data": [
                    {
                      "id": "local-model",
                      "object": "model",
                      "created": 1686935002,
                      "owned_by": "padhai"
                    }
                  ]
                }
            """.trimIndent()
            return newFixedLengthResponse(Response.Status.OK, "application/json", response)
        }

        return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "Not Found")
    }

    private fun handleSyncResponse(messagesJson: String): Response {
        // Simple implementation: collect from flow until done
        var resultText = ""
        runBlocking {
            inferenceEngine.chatStream(messagesJson).collect { chunk ->
                if (!chunk.startsWith("@@TOOL_CALL@@")) {
                    resultText += chunk
                }
            }
        }
        val responseJson = JSONObject()
        responseJson.put("id", "chatcmpl-" + UUID.randomUUID().toString())
        responseJson.put("object", "chat.completion")
        responseJson.put("created", System.currentTimeMillis() / 1000)
        
        val choice = JSONObject()
        choice.put("index", 0)
        val message = JSONObject()
        message.put("role", "assistant")
        message.put("content", resultText)
        choice.put("message", message)
        choice.put("finish_reason", "stop")
        
        val choices = JSONArray()
        choices.put(choice)
        responseJson.put("choices", choices)
        
        return newFixedLengthResponse(Response.Status.OK, "application/json", responseJson.toString())
    }

    private fun handleStreamingResponse(messagesJson: String): Response {
        val pipedIn = PipedInputStream()
        val pipedOut = PipedOutputStream(pipedIn)
        val chatId = "chatcmpl-" + UUID.randomUUID().toString()
        val created = System.currentTimeMillis() / 1000

        scope.launch {
            try {
                inferenceEngine.chatStream(messagesJson).collect { chunk ->
                    if (chunk.isNotEmpty()) {
                        if (chunk.startsWith("@@TOOL_CALL@@")) {
                            val toolJson = chunk.substring("@@TOOL_CALL@@".length)
                            val ssePayload = createToolCallSsePayload(chatId, created, toolJson)
                            pipedOut.write(ssePayload.toByteArray(StandardCharsets.UTF_8))
                        } else {
                            val ssePayload = createSsePayload(chatId, created, chunk)
                            pipedOut.write(ssePayload.toByteArray(StandardCharsets.UTF_8))
                        }
                        pipedOut.flush()
                    }
                }
                // Send stop sequence
                val finalPayload = createSsePayload(chatId, created, "", "stop")
                pipedOut.write(finalPayload.toByteArray(StandardCharsets.UTF_8))
                pipedOut.write("data: [DONE]\n\n".toByteArray(StandardCharsets.UTF_8))
                pipedOut.flush()
            } catch (e: Exception) {
                Log.e("LocalLlmServer", "Streaming error", e)
                try {
                    val errorPayload = createSsePayload(chatId, created, "\n\n[⚠️ Engine Crash: ${e.message}]", "error")
                    pipedOut.write(errorPayload.toByteArray(StandardCharsets.UTF_8))
                    pipedOut.write("data: [DONE]\n\n".toByteArray(StandardCharsets.UTF_8))
                    pipedOut.flush()
                } catch (e2: Exception) {}
            } finally {
                withContext(Dispatchers.IO) {
                    pipedOut.close()
                }
            }
        }
        
        val response = newChunkedResponse(Response.Status.OK, "text/event-stream", pipedIn)
        response.addHeader("Cache-Control", "no-cache")
        response.addHeader("Connection", "keep-alive")
        response.addHeader("Access-Control-Allow-Origin", "*")
        return response
    }

    private fun createToolCallSsePayload(chatId: String, created: Long, toolJson: String): String {
        val toolData = JSONObject(toolJson)
        val calls = toolData.getJSONArray("calls")
        
        val root = JSONObject()
        root.put("id", chatId)
        root.put("object", "chat.completion.chunk")
        root.put("created", created)
        root.put("model", "local-model")
        
        val choice = JSONObject()
        choice.put("index", 0)
        val delta = JSONObject()
        
        val toolCalls = JSONArray()
        for (i in 0 until calls.length()) {
            val call = calls.getJSONObject(i)
            val tc = JSONObject()
            tc.put("index", i)
            tc.put("id", call.getString("id"))
            tc.put("type", "function")
            val fn = JSONObject()
            fn.put("name", call.getString("name"))
            fn.put("arguments", call.getString("args"))
            tc.put("function", fn)
            toolCalls.put(tc)
        }
        
        delta.put("tool_calls", toolCalls)
        choice.put("delta", delta)
        choice.put("finish_reason", "tool_calls")
        
        val choices = JSONArray()
        choices.put(choice)
        root.put("choices", choices)
        
        return "data: ${root.toString()}\n\n"
    }

    private fun createSsePayload(chatId: String, created: Long, content: String, finishReason: String? = null): String {
        val root = JSONObject()
        root.put("id", chatId)
        root.put("object", "chat.completion.chunk")
        root.put("created", created)
        root.put("model", "local-model")
        
        val choice = JSONObject()
        choice.put("index", 0)
        val delta = JSONObject()
        if (content.isNotEmpty()) {
            delta.put("content", content)
        } else {
            delta.put("role", "assistant")
        }
        choice.put("delta", delta)
        
        if (finishReason != null) {
            choice.put("finish_reason", finishReason)
        } else {
            choice.put("finish_reason", JSONObject.NULL)
        }
        
        val choices = JSONArray()
        choices.put(choice)
        root.put("choices", choices)
        
        return "data: ${root.toString()}\n\n"
    }
}
