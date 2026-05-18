package com.padhai.modules.llm

import android.os.Process
import android.util.Log

object CoreSelector {
    private const val TAG = "CoreSelector"

    enum class Priority {
        FOREGROUND,
        BACKGROUND,
        IDLE
    }

    fun setPriority(priority: Priority) {
        try {
            when (priority) {
                Priority.FOREGROUND -> {
                    Process.setThreadPriority(Process.THREAD_PRIORITY_FOREGROUND)
                    Log.d(TAG, "Set priority to FOREGROUND")
                }
                Priority.BACKGROUND -> {
                    Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
                    Log.d(TAG, "Set priority to BACKGROUND")
                }
                Priority.IDLE -> {
                    Process.setThreadPriority(Process.THREAD_PRIORITY_LOWEST)
                    Log.d(TAG, "Set priority to IDLE")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set priority", e)
        }
    }
}
