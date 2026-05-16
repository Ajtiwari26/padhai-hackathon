package com.padhai.modules

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.*

class PadhNotificationModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "PadhNotificationManager"
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Study Reminders"
            val descriptionText = "Notifications for class schedules and assignments"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel("PADH_STUDY", name, importance).apply {
                description = descriptionText
            }
            val notificationManager: NotificationManager =
                reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    @ReactMethod
    fun scheduleReminder(title: String, message: String, delayMinutes: Int, promise: Promise) {
        // In a real implementation, we would use WorkManager to schedule this in the exact future.
        // For Phase 1, we simulate an immediate notification.
        createNotificationChannel()

        val notificationManager = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val builder = NotificationCompat.Builder(reactApplicationContext, "PADH_STUDY")
            .setSmallIcon(android.R.drawable.ic_dialog_info) // Fallback icon
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)

        notificationManager.notify(System.currentTimeMillis().toInt(), builder.build())
        promise.resolve(true)
    }

    @ReactMethod
    fun cancelAllReminders(promise: Promise) {
        val notificationManager = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancelAll()
        promise.resolve(true)
    }
}
