package com.calmsense.app.behavior

import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class AppNotificationListenerService : NotificationListenerService() {
  private val screenStateReceiver = ScreenStateReceiver()
  private var receiverRegistered = false

  override fun onListenerConnected() {
    super.onListenerConnected()
    if (!receiverRegistered) {
      registerReceiver(screenStateReceiver, IntentFilter(Intent.ACTION_USER_PRESENT))
      receiverRegistered = true
    }
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    if (receiverRegistered) {
      try {
        unregisterReceiver(screenStateReceiver)
      } catch (_: IllegalArgumentException) {
        // Already unregistered (e.g. process is tearing down) — nothing to do.
      }
      receiverRegistered = false
    }
    // Self-heal: Android dropped the binding (OS memory pressure, app update, etc.) —
    // ask to be reconnected instead of silently going dark.
    try {
      requestRebind(ComponentName(this, AppNotificationListenerService::class.java))
    } catch (_: Exception) {
      // Best-effort.
    }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (sbn.packageName == packageName) return // ignore our own foreground-service notification
    BehaviorEventEmitter.emit(this, "NOTIFICATION", sbn.packageName)
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification) {
    // No-op: only the posted event is part of the captured feature set.
  }
}
