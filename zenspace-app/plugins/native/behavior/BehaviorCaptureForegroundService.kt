package com.calmsense.app.behavior

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import androidx.core.app.NotificationCompat

// Keeps the app's process alive (and, via the repeating alarm below, keeps waking
// BehaviorHeadlessTaskService) so the 15-min capture/aggregation/sync cycle in
// captureService.js survives the app being backgrounded or its Activity being killed.
// Without this, Android reclaims the process and the JS setInterval timers with it.
class BehaviorCaptureForegroundService : Service() {

  companion object {
    private const val CHANNEL_ID = "calmsense_behavior_capture"
    private const val NOTIFICATION_ID = 4201
    private const val TICK_INTERVAL_MS = 15L * 60L * 1000L

    fun start(context: Context) {
      val intent = Intent(context, BehaviorCaptureForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, BehaviorCaptureForegroundService::class.java))
    }

    private fun alarmPendingIntent(context: Context): PendingIntent {
      val intent = Intent(context, BehaviorHeadlessTaskService::class.java)
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      return PendingIntent.getService(context, 0, intent, flags)
    }

    // Schedules exactly ONE alarm ~15 min out. setExactAndAllowWhileIdle is
    // one-shot by design -- unlike the setInexactRepeating this replaces,
    // which Doze mode is free to defer by hours once the device has been idle
    // a while. Confirmed in production: hours of windows landed in a single
    // burst the moment the app was reopened, instead of trickling in every 15
    // min, and the EMA notification (only ever fired from inside that same
    // tick) never got a chance to run while genuinely backgrounded because of
    // it. Whoever's alarm fires (BehaviorHeadlessTaskService) is responsible
    // for calling this again to keep the chain going -- see it for why.
    fun scheduleNextExactAlarm(context: Context) {
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val triggerAt = SystemClock.elapsedRealtime() + TICK_INTERVAL_MS
      val pendingIntent = alarmPendingIntent(context)
      val canBeExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()
      if (canBeExact) {
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME, triggerAt, pendingIntent)
      } else {
        // "Alarms & reminders" special access not granted (Settings ->
        // UsageEventsModule.openExactAlarmSettings() -- see settings.jsx).
        // Still Doze-aware (unlike plain setInexactRepeating), just not
        // exact-timed, so this degrades gracefully instead of going dark.
        alarmManager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME, triggerAt, pendingIntent)
      }
    }
  }

  override fun onCreate() {
    super.onCreate()
    startForeground(NOTIFICATION_ID, buildNotification())
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    scheduleNextExactAlarm(this)
    return START_STICKY
  }

  override fun onDestroy() {
    val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(alarmPendingIntent(this))
    super.onDestroy()
  }

  override fun onBind(intent: Intent?) = null

  private fun buildNotification(): android.app.Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (manager.getNotificationChannel(CHANNEL_ID) == null) {
        manager.createNotificationChannel(
          NotificationChannel(CHANNEL_ID, "Behavior capture", NotificationManager.IMPORTANCE_MIN)
        )
      }
    }
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("CalmSense")
      .setContentText("Tracking your digital wellbeing in the background")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .build()
  }
}
