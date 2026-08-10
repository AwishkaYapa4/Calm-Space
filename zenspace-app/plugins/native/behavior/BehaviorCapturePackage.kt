package com.calmsense.app.behavior

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

// Registered manually in MainApplication.kt's getPackages() by withBehaviorCapture.js
// (not autolinked — these two modules live outside node_modules).
class BehaviorCapturePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(UsageEventsModule(reactContext), ForegroundServiceModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
