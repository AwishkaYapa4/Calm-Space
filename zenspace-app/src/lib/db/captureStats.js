import { getDb } from './schema';

/** Local, always-available (no network needed) view into what's actually been
 * captured on this device — the raw evidence layer plus sync backlog. Powers
 * the "Capture Status" section of the analysis page. */
export async function getCaptureStats() {
  const db = await getDb();
  const [eventsRow, todayEventsRow, observationsRow, pendingRow, latestRow] = await Promise.all([
    db.getFirstAsync('SELECT COUNT(*) as n FROM behavior_events'),
    db.getFirstAsync('SELECT COUNT(*) as n FROM behavior_events WHERE timestamp >= ?', [
      new Date().setHours(0, 0, 0, 0),
    ]),
    db.getFirstAsync('SELECT COUNT(*) as n FROM behavior_observations'),
    db.getFirstAsync('SELECT COUNT(*) as n FROM behavior_observations WHERE synced = 0'),
    db.getFirstAsync('SELECT MAX(timestamp) as ts FROM behavior_events'),
  ]);

  return {
    totalEvents: eventsRow?.n ?? 0,
    todayEvents: todayEventsRow?.n ?? 0,
    totalWindows: observationsRow?.n ?? 0,
    pendingSync: pendingRow?.n ?? 0,
    lastEventAt: latestRow?.ts ?? null,
  };
}
