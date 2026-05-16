package com.padhai.modules

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class PadhPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            PadhLiteRTModule(reactContext),
            PadhModelDownloaderModule(reactContext),
            PadhVectorDBModule(reactContext),
            PadhKioskManagerModule(reactContext),
            PadhVisionModule(reactContext),
            PadhNotificationModule(reactContext)
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
