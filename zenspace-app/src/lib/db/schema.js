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
          synced INTEGER NOT NULL DEFAULT 0,
          analyzed INTEGER NOT NULL DEFAULT 0
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

        -- The single most recent unresolved EMA trigger. Most 15-min ticks run
        -- headless (BehaviorHeadlessTaskService, see headlessCaptureTask.js) with
        -- no app UI mounted, so the live emitEmaTrigger() DeviceEventEmitter event
        -- has nobody listening yet — it fires into a void the instant it's raised.
        -- Persisting it here means _layout.jsx can pick it up the next time the
        -- app is actually opened, instead of silently losing every trigger that
        -- doesn't land while the user happens to already be in the app.
        CREATE TABLE IF NOT EXISTS pending_ema_trigger (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          window_start INTEGER NOT NULL,
          deviated_count INTEGER NOT NULL,
          details_json TEXT
        );
      `);

      // Lightweight migration for installs from before the `analyzed` column
      // existed — CREATE TABLE IF NOT EXISTS above is a no-op on an existing
      // table, so older installs need it added explicitly. Safe to run every
      // open: SQLite rejects a duplicate column, which we just swallow.
      try {
        await db.execAsync('ALTER TABLE behavior_observations ADD COLUMN analyzed INTEGER NOT NULL DEFAULT 0');
      } catch {
        // column already exists
      }

      return db;
    });
  }
  return dbPromise;
}
