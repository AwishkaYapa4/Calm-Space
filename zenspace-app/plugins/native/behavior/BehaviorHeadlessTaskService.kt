package com.calmsense.app.behavior

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

// Started every 15 min by BehaviorCaptureForegroundService's alarm. Runs the JS task
// registered as 'BehaviorCaptureTask' in index.js (runBackgroundCaptureTask), which
// re-binds the notification listener, polls usage events, aggregates, and syncs —
// the same pipeline the foreground timers in captureService.js call.
class BehaviorHeadlessTaskService : HeadlessJsTaskService() {
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // The alarm that started us is one-shot (setExactAndAllowWhileIdle, see
    // BehaviorCaptureForegroundService) -- keeping the 15-min chain going is
    // this service's job, done as early as possible so a slow/killed JS task
    // below still leaves the next tick scheduled.
    BehaviorCaptureForegroundService.scheduleNextExactAlarm(this)
    return super.onStartCommand(intent, flags, startId)
  }

  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
    return HeadlessJsTaskConfig(
      "BehaviorCaptureTask",
      Arguments.createMap(),
      60_000L,
      true
    )
  }
}
