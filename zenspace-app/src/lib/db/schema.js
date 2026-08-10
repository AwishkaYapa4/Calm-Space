import * as SQLite from 'expo-sqlite';

let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('calmsense_behavior.db').then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS behavior_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          package_name TEXT,
          timestamp INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_behavior_events_timestamp ON behavior_events(timestamp);

        CREATE TABLE IF NOT EXISTS behavior_observations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          window_start INTEGER NOT NULL,
          window_end INTEGER NOT NULL,
          screen_time_sec INTEGER NOT NULL DEFAULT 0,
          unlock_count INTEGER NOT NULL DEFAULT 0,
          notification_count INTEGER NOT NULL DEFAULT 0,
          social_media_sec INTEGER NOT NULL DEFAULT 0,
          session_count INTEGER NOT NULL DEFAULT 0,
          avg_session_sec REAL NOT NULL DEFAULT 0,
          night_usage_flag INTEGER NOT NULL DEFAULT 0,
          synced INTEGER NOT NULL DEFAULT 0
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_behavior_observations_window ON behavior_observations(window_start);

        -- One row per completed window: how many features deviated from the
        -- personal same-time-slot baseline. Looked back on by the temporal
        -- persistence check (3-of-last-4 rule) in temporalEngine.js.
        CREATE TABLE IF NOT EXISTS behavior_deviations (
          window_start INTEGER PRIMARY KEY,
          deviated_count INTEGER NOT NULL,
          details_json TEXT
        );

        -- User-reported stress level captured when the decision engine
        -- decides a behavioral change is worth asking about (EMA = ecological
        -- momentary assessment). This is the labeled dataset for later
        -- Python model training.
        CREATE TABLE IF NOT EXISTS behavior_ema_labels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          window_start INTEGER NOT NULL,
          stress_level INTEGER NOT NULL,
          mood TEXT,
          responded_at INTEGER NOT NULL,
          synced INTEGER NOT NULL DEFAULT 0
        );
      `);
      return db;
    });
  }
  return dbPromise;
}
