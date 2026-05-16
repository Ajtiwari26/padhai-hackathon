package com.padhai.modules

import android.app.DownloadManager
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Environment
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import kotlinx.coroutines.*

class PadhModelDownloaderModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val downloadManager: DownloadManager = reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun getName(): String {
        return "PadhModelDownloader"
    }

    @ReactMethod
    fun getDownloadStatus(downloadIdStr: String, promise: Promise) {
        try {
            val downloadId = downloadIdStr.toLong()
            val query = DownloadManager.Query().setFilterById(downloadId)
            val cursor = downloadManager.query(query)

            if (cursor != null && cursor.moveToFirst()) {
                val statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
                val bytesDownloadedIndex = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
                val bytesTotalIndex = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)

                if (statusIndex >= 0 && bytesDownloadedIndex >= 0 && bytesTotalIndex >= 0) {
                    val status = cursor.getInt(statusIndex)
                    val bytesDownloaded = cursor.getLong(bytesDownloadedIndex)
                    val bytesTotal = cursor.getLong(bytesTotalIndex)

                    val map = Arguments.createMap()
                    map.putInt("status", status)
                    map.putDouble("bytesDownloaded", bytesDownloaded.toDouble())
                    map.putDouble("bytesTotal", bytesTotal.toDouble())
                    promise.resolve(map)
                } else {
                    promise.reject("CURSOR_ERROR", "Could not get columns")
                }
                cursor.close()
            } else {
                promise.reject("NOT_FOUND", "Download not found")
                cursor?.close()
            }
        } catch (e: Exception) {
            promise.reject("STATUS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun checkModelExists(filename: String, promise: Promise) {
        try {
            val modelsDir = reactApplicationContext.getExternalFilesDir("models")
            val file = File(modelsDir, filename)
            promise.resolve(file.exists())
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getModelPath(filename: String, promise: Promise) {
        try {
            val modelsDir = reactApplicationContext.getExternalFilesDir("models")
            promise.resolve(File(modelsDir, filename).absolutePath)
        } catch (e: Exception) {
            promise.reject("PATH_ERROR", e.message)
        }
    }

    @ReactMethod
    fun startDownload(url: String, filename: String, promise: Promise) {
        try {
            val modelsDir = reactApplicationContext.getExternalFilesDir("models")
            val file = File(modelsDir, filename)
            if (file.exists()) file.delete()

            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle("Downloading $filename")
                .setDescription("Padh.ai Local AI Model")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalFilesDir(reactApplicationContext, "models", filename)

            val downloadId = downloadManager.enqueue(request)
            promise.resolve(downloadId.toString())
        } catch (e: Exception) {
            promise.reject("DOWNLOAD_ERROR", e.message)
        }
    }
}
