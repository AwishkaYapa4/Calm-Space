import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from './schema';
import { syncBehaviorObservations } from '../api';

const BATCH_SIZE = 50;

/** Pushes unsynced 15-min aggregates to the backend; marks them synced on success.
 * Never sends behavior_events (raw rows) — only the aggregated observations. */
export async function runSyncTick() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM behavior_observations WHERE synced = 0 ORDER BY window_start ASC LIMIT ?',
    [BATCH_SIZE]
  );
  if (!rows.length) return;

  const userIdRaw = await AsyncStorage.getItem('cs_user_id');
  const userId = userIdRaw ? Number(userIdRaw) : undefined;

  const payload = rows.map((r) => ({
    window_start: r.window_start,
    window_end: r.window_end,
    screen_time_sec: r.screen_time_sec,
    unlock_count: r.unlock_count,
    notification_count: r.notification_count,
    social_media_sec: r.social_media_sec,
    session_count: r.session_count,
    avg_session_sec: r.avg_session_sec,
    night_usage_flag: r.night_usage_flag,
  }));

  const result = await syncBehaviorObservations(payload, userId);
  if (!result) return; // offline — same rows retried next tick

  const ids = rows.map((r) => r.id);
  await db.runAsync(
    `UPDATE behavior_observations SET synced = 1 WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
}
