package com.padhai.modules

import android.net.Uri
import com.facebook.react.bridge.*
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.IOException

class PadhVisionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "PadhVision"
    }

    @ReactMethod
    fun recognizeText(imageUri: String, promise: Promise) {
        try {
            val uri = Uri.parse(imageUri)
            val image = InputImage.fromFilePath(reactApplicationContext, uri)
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

            recognizer.process(image)
                .addOnSuccessListener { visionText ->
                    val resultMap = Arguments.createMap()
                    resultMap.putString("text", visionText.text)
                    resultMap.putDouble("confidence", 0.95)
                    promise.resolve(resultMap)
                }
                .addOnFailureListener { e ->
                    promise.reject("OCR_ERROR", e.message, e)
                }
        } catch (e: Exception) {
            promise.reject("FILE_ERROR", "Failed to load image: ${e.message}", e)
        }
    }

    @ReactMethod
    fun analyzeEquation(imageUri: String, promise: Promise) {
        // For Math parsing, ML Kit just returns text. 
        // We use recognizeText logic and let the LLM handle the interpretation of the equation.
        recognizeText(imageUri, promise)
    }
}
