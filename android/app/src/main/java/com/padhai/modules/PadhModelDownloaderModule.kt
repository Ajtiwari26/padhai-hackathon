package com.padhai.modules

import android.app.DownloadManager
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Environment
import android.os.Build
import android.provider.Settings
import android.content.Intent
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

    private fun copyToPublicStorageAsync(filename: String) {
        scope.launch {
            try {
                val privateDir = reactApplicationContext.getExternalFilesDir("models")
                val privateFile = File(privateDir, filename)
                if (!privateFile.exists()) return@launch

                val publicDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "PadhAI")
                if (!publicDir.exists()) {
                    publicDir.mkdirs()
                }
                val publicFile = File(publicDir, filename)
                
                // If it already exists and has the same size, skip copying
                if (publicFile.exists() && publicFile.length() == privateFile.length()) {
                    return@launch
                }

                privateFile.inputStream().use { input ->
                    publicFile.outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
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
                val localUriIndex = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI)

                if (statusIndex >= 0 && bytesDownloadedIndex >= 0 && bytesTotalIndex >= 0) {
                    val status = cursor.getInt(statusIndex)
                    val bytesDownloaded = cursor.getLong(bytesDownloadedIndex)
                    val bytesTotal = cursor.getLong(bytesTotalIndex)

                    // If download completed successfully, trigger copy to public storage
                    if (status == DownloadManager.STATUS_SUCCESSFUL) {
                        var filename: String? = null
                        if (localUriIndex >= 0) {
                            val localUriStr = cursor.getString(localUriIndex)
                            if (localUriStr != null) {
                                val uri = Uri.parse(localUriStr)
                                filename = uri.lastPathSegment
                            }
                        }
                        if (filename != null) {
                            copyToPublicStorageAsync(filename)
                        }
                    }

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
            // Check private storage first
            val privateDir = reactApplicationContext.getExternalFilesDir("models")
            val privateFile = File(privateDir, filename)
            if (privateFile.exists()) {
                promise.resolve(true)
                return
            }

            // Check public persistent storage
            val publicDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "PadhAI")
            val publicFile = File(publicDir, filename)
            promise.resolve(publicFile.exists())
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getModelPath(filename: String, promise: Promise) {
        try {
            // Check private storage first
            val privateDir = reactApplicationContext.getExternalFilesDir("models")
            val privateFile = File(privateDir, filename)
            if (privateFile.exists()) {
                promise.resolve(privateFile.absolutePath)
                return
            }

            // Check public persistent storage
            val publicDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "PadhAI")
            val publicFile = File(publicDir, filename)
            if (publicFile.exists()) {
                promise.resolve(publicFile.absolutePath)
                return
            }

            // Default to private path
            promise.resolve(privateFile.absolutePath)
        } catch (e: Exception) {
            promise.reject("PATH_ERROR", e.message)
        }
    }

    @ReactMethod
    fun listLocalModels(promise: Promise) {
        try {
            val list = Arguments.createArray()
            val seen = mutableSetOf<String>()

            // 1. Scan private storage
            val privateDir = reactApplicationContext.getExternalFilesDir("models")
            if (privateDir != null && privateDir.exists()) {
                privateDir.listFiles()?.forEach { file ->
                    if (file.isFile && (file.name.endsWith(".task") || file.name.endsWith(".litertlm"))) {
                        list.pushString(file.name)
                        seen.add(file.name)
                    }
                }
            }

            // 2. Scan public persistent storage
            val publicDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "PadhAI")
            if (publicDir.exists()) {
                publicDir.listFiles()?.forEach { file ->
                    if (file.isFile && (file.name.endsWith(".task") || file.name.endsWith(".litertlm"))) {
                        if (!seen.contains(file.name)) {
                            list.pushString(file.name)
                        }
                    }
                }
            }

            promise.resolve(list)
        } catch (e: Exception) {
            promise.reject("LIST_ERROR", e.message)
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

    @ReactMethod
    fun hasManageExternalStoragePermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            promise.resolve(Environment.isExternalStorageManager())
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun requestManageExternalStoragePermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                intent.data = Uri.parse("package:" + reactApplicationContext.packageName)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactApplicationContext.startActivity(intent)
                    promise.resolve(true)
                } else {
                    promise.resolve(true)
                }
            } catch (ex: Exception) {
                promise.reject("PERMISSION_ERROR", ex.message)
            }
        }
    }
}
