import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from './schema';
import { isSocialMediaPackage } from './packageCategories';
import { analyzeBehaviorWindow } from '../api';
import { emitEmaTrigger } from '../behavior/emaBus';

const WINDOW_MS = 15 * 60 * 1000;

function windowStartFor(timestamp) {
  return Math.floor(timestamp / WINDOW_MS) * WINDOW_MS;
}

/** Aggregates every 15-minute window that has fully elapsed and has no observation row yet. */
export async function runAggregationTick() {
  const db = await getDb();
  const now = Date.now();
  const currentWindowStart = windowStartFor(now);

  const oldest = await db.getFirstAsync(
    'SELECT MIN(timestamp) as ts FROM behavior_events WHERE timestamp < ?',
    [currentWindowStart]
  );
  if (!oldest?.ts) return;

  let windowStart = windowStartFor(oldest.ts);
  while (windowStart < currentWindowStart) {
    const windowEnd = windowStart + WINDOW_MS;
    const already = await db.getFirstAsync(
      'SELECT id FROM behavior_observations WHERE window_start = ?',
      [windowStart]
    );
    if (!already) {
      await aggregateWindow(db, windowStart, windowEnd);
    }
    windowStart = windowEnd;
  }
}

async function aggregateWindow(db, windowStart, windowEnd) {
  const events = await db.getAllAsync(
    'SELECT event_type, package_name, timestamp FROM behavior_events WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC',
    [windowStart, windowEnd]
  );

  const unlockCount = events.filter((e) => e.event_type === 'UNLOCK').length;
  const notificationCount = events.filter((e) => e.event_type === 'NOTIFICATION').length;

  // Reconstruct app sessions from FOREGROUND/BACKGROUND pairs to derive screen time,
  // session count, and social-media time.
  const openSessions = new Map(); // packageName -> foregroundedAt
  let screenTimeSec = 0;
  let socialMediaSec = 0;
  let sessionCount = 0;
  let sessionDurationsSec = [];

  for (const e of events) {
    if (e.event_type === 'APP_FOREGROUND') {
      openSessions.set(e.package_name, e.timestamp);
    } else if (e.event_type === 'APP_BACKGROUND') {
      const start = openSessions.get(e.package_name);
      if (start != null) {
        const durationSec = Math.max(0, (e.timestamp - start) / 1000);
        screenTimeSec += durationSec;
        sessionDurationsSec.push(durationSec);
        sessionCount += 1;
        if (isSocialMediaPackage(e.package_name)) {
          socialMediaSec += durationSec;
        }
        openSessions.delete(e.package_name);
      }
    }
  }
  // Sessions still open at window end count toward screen time up to windowEnd.
  for (const [pkg, start] of openSessions) {
    const durationSec = Math.max(0, (windowEnd - start) / 1000);
    screenTimeSec += durationSec;
    sessionDurationsSec.push(durationSec);
    sessionCount += 1;
    if (isSocialMediaPackage(pkg)) socialMediaSec += durationSec;
  }

  const avgSessionSec = sessionDurationsSec.length
    ? sessionDurationsSec.reduce((a, b) => a + b, 0) / sessionDurationsSec.length
    : 0;

  const windowHour = new Date(windowStart).getHours();
  const nightUsageFlag = (windowHour >= 23 || windowHour < 6) && screenTimeSec > 0 ? 1 : 0;

  const observation = {
    window_start: windowStart,
    window_end: windowEnd,
    screen_time_sec: Math.round(screenTimeSec),
    unlock_count: unlockCount,
    notification_count: notificationCount,
    social_media_sec: Math.round(socialMediaSec),
    session_count: sessionCount,
    avg_session_sec: avgSessionSec,
    night_usage_flag: nightUsageFlag,
  };

  await db.runAsync(
    `INSERT OR IGNORE INTO behavior_observations
      (window_start, window_end, screen_time_sec, unlock_count, notification_count, social_media_sec, session_count, avg_session_sec, night_usage_flag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      observation.window_start,
      observation.window_end,
      observation.screen_time_sec,
      observation.unlock_count,
      observation.notification_count,
      observation.social_media_sec,
      observation.session_count,
      observation.avg_session_sec,
      observation.night_usage_flag,
    ]
  );

  // Only run deviation/EMA-trigger analysis once we have a couple of days of
  // history — otherwise every early window looks "anomalous" against nothing,
  // and it saves a pointless network round-trip for the first ~2 days.
  // 192 = 2 days x 96 windows/day (15-minute windows).
  const MIN_HISTORY_WINDOWS = 192;
  const historyCheck = await db.getFirstAsync(
    'SELECT COUNT(*) as n FROM behavior_observations WHERE window_start < ?',
    [windowStart]
  );
  if ((historyCheck?.n ?? 0) < MIN_HISTORY_WINDOWS) return;

  const userIdRaw = await AsyncStorage.getItem('cs_user_id');
  const userId = userIdRaw ? Number(userIdRaw) : undefined;

  // The Python deviation/temporal/decision pipeline runs server-side against this
  // user's real history (see calmspace-backend/app/decision_engine.py) — this also
  // inserts the row on the backend, so mark it synced to skip the redundant batch sync.
  const result = await analyzeBehaviorWindow(observation, userId);
  if (!result) return; // offline — syncService's batch sync will pick this window up later

  await db.runAsync('UPDATE behavior_observations SET synced = 1 WHERE window_start = ?', [windowStart]);

  if (result.trigger) {
    emitEmaTrigger({
      windowStart: observation.window_start,
      deviatedCount: result.deviated_count,
      perFeature: result.per_feature,
    });
  }
}
