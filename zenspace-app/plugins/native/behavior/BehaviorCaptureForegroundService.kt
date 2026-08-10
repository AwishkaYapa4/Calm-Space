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
  }

  private fun alarmPendingIntent(): PendingIntent {
    val intent = Intent(this, BehaviorHeadlessTaskService::class.java)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getService(this, 0, intent, flags)
  }

  override fun onCreate() {
    super.onCreate()
    startForeground(NOTIFICATION_ID, buildNotification())
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
    // Inexact is fine — this is best-effort background aggregation, not a timer the
    // user is watching, and it avoids needing the exact-alarm permission.
    alarmManager.setInexactRepeating(
      AlarmManager.ELAPSED_REALTIME,
      SystemClock.elapsedRealtime() + TICK_INTERVAL_MS,
      TICK_INTERVAL_MS,
      alarmPendingIntent()
    )
    return START_STICKY
  }

  override fun onDestroy() {
    val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(alarmPendingIntent())
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
