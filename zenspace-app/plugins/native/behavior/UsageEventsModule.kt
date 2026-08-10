package com.calmsense.app.behavior

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Process
import android.provider.Settings
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.service.notification.NotificationListenerService
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

// Bridges Android's UsageStatsManager (app foreground/background) and the two
// permission surfaces (usage access, notification access) into JS. Raw events
// are read here on-demand; captureService.js is the one that decides polling
// cadence and writes them into SQLite.
class UsageEventsModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "UsageEventsModule"

  @ReactMethod
  fun hasUsageAccess(promise: Promise) {
    val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      reactContext.packageName
    )
    promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
  }

  @ReactMethod
  fun hasNotificationAccess(promise: Promise) {
    val enabled = Settings.Secure.getString(reactContext.contentResolver, "enabled_notification_listeners")
    val ownComponent = ComponentName(reactContext, AppNotificationListenerService::class.java).flattenToString()
    promise.resolve(enabled?.contains(ownComponent) == true)
  }

  // `since` is a JS Date.now()-style epoch-ms timestamp (the last time this was polled).
  @ReactMethod
  fun queryUsageEvents(since: Double, promise: Promise) {
    try {
      val usageStatsManager = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val events = usageStatsManager.queryEvents(since.toLong(), System.currentTimeMillis())
      val result: WritableArray = Arguments.createArray()
      val event = UsageEvents.Event()

      while (events.hasNextEvent()) {
        events.getNextEvent(event)
        val eventType = when (event.eventType) {
          UsageEvents.Event.MOVE_TO_FOREGROUND -> "APP_FOREGROUND"
          UsageEvents.Event.MOVE_TO_BACKGROUND -> "APP_BACKGROUND"
          else -> null
        } ?: continue

        val map: WritableMap = Arguments.createMap()
        map.putString("eventType", eventType)
        map.putString("packageName", event.packageName)
        map.putDouble("timestamp", event.timeStamp.toDouble())
        result.pushMap(map)
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("usage_events_error", e)
    }
  }

  // Cheap no-op if already bound — forces Android to reattempt the NotificationListenerService
  // connection, since reinstalling the app severs it without revoking the permission.
  @ReactMethod
  fun requestNotificationRebind() {
    try {
      NotificationListenerService.requestRebind(
        ComponentName(reactContext, AppNotificationListenerService::class.java)
      )
    } catch (_: Exception) {
      // Listener was never enabled yet — nothing to rebind.
    }
  }

  @ReactMethod
  fun openUsageAccessSettings() {
    val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      .setData(Uri.parse("package:${reactContext.packageName}"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactContext.startActivity(intent)
  }

  @ReactMethod
  fun openNotificationAccessSettings() {
    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactContext.startActivity(intent)
  }
}
