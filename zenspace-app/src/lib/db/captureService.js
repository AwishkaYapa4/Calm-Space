import { DeviceEventEmitter, NativeModules } from 'react-native';
import { getDb } from './schema';
import { runAggregationTick } from './aggregationService';
import { runSyncTick } from './syncService';

const { UsageEventsModule, ForegroundServiceModule } = NativeModules;

const USAGE_POLL_MS = 30 * 1000; // continuous foreground/background capture while the app process is alive
const AGGREGATION_CHECK_MS = 60 * 1000; // checks for a completed 15-min window every minute
const SYNC_INTERVAL_MS = 15 * 60 * 1000; // batches aggregated (not raw) observations to the backend

let usagePollTimer = null;
let aggregationTimer = null;
let syncTimer = null;
let deviceEventSub = null;
let lastUsagePollAt = Date.now();
let started = false;

async function insertEvent(eventType, packageName, timestamp) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO behavior_events (event_type, package_name, timestamp) VALUES (?, ?, ?)',
    [eventType, packageName ?? null, Math.round(timestamp)]
  );
}

// Exported so the headless background task (see headlessCaptureTask.js) can
// reuse the exact same polling logic — module state (lastUsagePollAt) is
// shared across foreground and headless invocations within the same JS engine.
export async function pollUsageEvents() {
  if (!UsageEventsModule) return;
  try {
    const hasAccess = await UsageEventsModule.hasUsageAccess();
    if (!hasAccess) return;

    const since = lastUsagePollAt;
    lastUsagePollAt = Date.now();
    const events = await UsageEventsModule.queryUsageEvents(since);
    for (const e of events) {
      await insertEvent(e.eventType, e.packageName, e.timestamp);
    }
  } catch {
    // swallow — next poll will catch up via the `since` timestamp
  }
}

export function requestNotificationRebind() {
  UsageEventsModule?.requestNotificationRebind?.();
}

export function hasNativeCaptureSupport() {
  return !!UsageEventsModule;
}

export async function checkPermissions() {
  if (!UsageEventsModule) return { usageAccess: false, notificationAccess: false, exactAlarmAccess: false };
  const [usageAccess, notificationAccess, exactAlarmAccess] = await Promise.all([
    UsageEventsModule.hasUsageAccess(),
    UsageEventsModule.hasNotificationAccess(),
    UsageEventsModule.hasExactAlarmAccess(),
  ]);
  return { usageAccess, notificationAccess, exactAlarmAccess };
}

export function openUsageAccessSettings() {
  UsageEventsModule?.openUsageAccessSettings();
}

export function openNotificationAccessSettings() {
  UsageEventsModule?.openNotificationAccessSettings();
}

// Without this granted, the 15-min background alarm silently degrades from
// exact (survives Doze) to best-effort (Doze can defer it by hours) — see
// BehaviorCaptureForegroundService.scheduleNextExactAlarm.
export function openExactAlarmSettings() {
  UsageEventsModule?.openExactAlarmSettings();
}

export function startCapture() {
  if (started || !UsageEventsModule) return;
  started = true;

  // Reinstalling the app (every native rebuild) silently severs the live
  // NotificationListenerService connection without revoking the permission —
  // this forces Android to reattempt it so capture doesn't go quietly dark.
  requestNotificationRebind();

  deviceEventSub = DeviceEventEmitter.addListener('CalmSenseBehaviorEvent', (e) => {
    insertEvent(e.eventType, e.packageName, e.timestamp);
  });

  pollUsageEvents();
  usagePollTimer = setInterval(pollUsageEvents, USAGE_POLL_MS);
  aggregationTimer = setInterval(runAggregationTick, AGGREGATION_CHECK_MS);
  runAggregationTick();

  syncTimer = setInterval(runSyncTick, SYNC_INTERVAL_MS);
  runSyncTick();

  // Keeps capture/aggregation/sync running on a 15-min cycle even when the app
  // is closed or killed — the foreground-service notification is required by
  // Android for this to be reliable. Without it, usage-stats polling (this
  // file's setInterval calls above) only runs while the JS engine is alive.
  ForegroundServiceModule?.start();
}

export function stopCapture() {
  started = false;
  deviceEventSub?.remove();
  deviceEventSub = null;
  if (usagePollTimer) clearInterval(usagePollTimer);
  if (aggregationTimer) clearInterval(aggregationTimer);
  if (syncTimer) clearInterval(syncTimer);
  usagePollTimer = null;
  aggregationTimer = null;
  syncTimer = null;
  ForegroundServiceModule?.stop();
}
