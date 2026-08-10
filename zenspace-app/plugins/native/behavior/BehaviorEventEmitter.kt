package com.calmsense.app.behavior

import android.content.Context
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

// Shared by AppNotificationListenerService and ScreenStateReceiver, both of which can run
// with no Activity on screen. Emits straight onto the JS engine kept alive by
// BehaviorCaptureForegroundService; captureService.js's `CalmSenseBehaviorEvent`
// listener is what actually writes these into SQLite. If the JS context isn't up yet
// (process freshly started by the OS for this component alone), the event is dropped —
// the next headless/foreground usage-stats poll will catch up via its `since` cursor.
object BehaviorEventEmitter {
  fun emit(context: Context, eventType: String, packageName: String?) {
    val reactContext = (context.applicationContext as? ReactApplication)
      ?.reactNativeHost
      ?.reactInstanceManager
      ?.currentReactContext
      ?: return

    val map = Arguments.createMap()
    map.putString("eventType", eventType)
    if (packageName != null) map.putString("packageName", packageName) else map.putNull("packageName")
    map.putDouble("timestamp", System.currentTimeMillis().toDouble())

    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("CalmSenseBehaviorEvent", map)
  }
}
