package com.calmsense.app.behavior

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ForegroundServiceModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "ForegroundServiceModule"

  @ReactMethod
  fun start() {
    BehaviorCaptureForegroundService.start(reactContext)
  }

  @ReactMethod
  fun stop() {
    BehaviorCaptureForegroundService.stop(reactContext)
  }
}
