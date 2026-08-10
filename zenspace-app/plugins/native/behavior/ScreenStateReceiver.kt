package com.calmsense.app.behavior

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Registered dynamically (not manifest-declared) from AppNotificationListenerService.onListenerConnected() —
// SCREEN_ON/SCREEN_OFF/USER_PRESENT are implicit broadcasts and cannot be caught by a
// manifest <receiver> since Android 8. Only USER_PRESENT (unlock) is fed into aggregation.
class ScreenStateReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_USER_PRESENT) {
      BehaviorEventEmitter.emit(context, "UNLOCK", null)
    }
  }
}
