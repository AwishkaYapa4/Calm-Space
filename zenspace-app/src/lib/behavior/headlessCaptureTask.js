// Runs inside Android's HeadlessJsTaskService (see BehaviorHeadlessTaskService.kt),
// triggered every 15 min by BehaviorCaptureForegroundService.kt regardless of
// whether the app UI is open. Reuses the exact same functions the foreground
// timers call — headless execution isn't a separate code path, just a
// different trigger for the same pipeline.
import { pollUsageEvents, requestNotificationRebind } from '../db/captureService';
import { runAggregationTick } from '../db/aggregationService';
import { runSyncTick } from '../db/syncService';

export default async function runBackgroundCaptureTask() {
  console.log('[CalmSenseBackgroundTask] starting');
  try {
    // Cheap no-op if already bound — self-heals the notification listener
    // connection if the OS severed it for any reason since the last tick.
    requestNotificationRebind();
    await pollUsageEvents();
    await runAggregationTick();
    await runSyncTick();
    console.log('[CalmSenseBackgroundTask] completed');
  } catch (e) {
    console.log('[CalmSenseBackgroundTask] failed', e);
  }
}
