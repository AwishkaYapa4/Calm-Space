import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const devHost =
  Constants.expoConfig?.hostUri?.split(':')?.[0] ||
  Constants.manifest2?.extra?.expoGo?.debuggerHost?.split(':')?.[0] ||
  '172.20.10.3';

const BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  `http://${devHost}:8000`;

const MOCK_TELEMETRY = {
  device_hours_per_day: 6.7,
  phone_unlocks: 143,
  notifications_per_day: 88,
  social_media_mins: 74,
  sleep_hours: 6.5,
  sleep_quality: 62,
  focus_score: 44,
  study_or_work_mins: 210,
};

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

export async function registerUser(profile) {
  try {
    return await post('/user/register', profile);
  } catch {
    return null;
  }
}

export async function fetchTelemetry(userId) {
  try {
    return await get(userId ? `/telemetry?user_id=${userId}` : '/telemetry');
  } catch {
    return { ...MOCK_TELEMETRY, offline: true };
  }
}

export async function fetchProfile(userId) {
  try {
    return await get(userId ? `/user/profile?user_id=${userId}` : '/user/profile');
  } catch {
    const stored = await AsyncStorage.getItem('zs_profile');
    if (stored) return { ...JSON.parse(stored), local_threshold: 5.5, offline: true };
    return { name: 'User', age: 0, gender: '', daily_role: '', local_threshold: 5.5, offline: true };
  }
}

// Syncs on-device-aggregated behavior windows only — raw events never leave the phone.
export async function syncBehaviorObservations(observations, userId) {
  try {
    return await post('/behavior/sync', { user_id: userId, observations });
  } catch {
    return null; // stays unsynced in SQLite; syncService retries next tick
  }
}

// Runs the Python deviation/temporal/decision pipeline server-side against this
// user's real history and returns whether to show the EMA prompt right now.
// Requires connectivity — unlike raw capture/aggregation, this can't run offline.
export async function analyzeBehaviorWindow(observation, userId) {
  try {
    return await post('/behavior/analyze', { user_id: userId, observation });
  } catch {
    return null; // offline — this window stays unanalyzed until the next batch sync
  }
}

export async function submitEmaLabel(payload, userId) {
  try {
    return await post('/behavior/ema', { ...payload, user_id: userId });
  } catch {
    return null; // best-effort — the label always stays in behavior_ema_labels on-device
  }
}

// Real recent windows + deviation results — no fallback, an empty array here
// genuinely means "nothing captured yet," which the UI should show honestly.
export async function fetchBehaviorHistory(userId, limit = 12) {
  if (!userId) return [];
  try {
    return await get(`/behavior/history?user_id=${userId}&limit=${limit}`);
  } catch {
    return [];
  }
}

export async function fetchDailySummary(userId, days = 7) {
  if (!userId) return [];
  try {
    return await get(`/behavior/daily-summary?user_id=${userId}&days=${days}`);
  } catch {
    return [];
  }
}

export async function fetchInteractionEvents(userId, limit = 20) {
  if (!userId) return [];
  try {
    return await get(`/insights/events?user_id=${userId}&limit=${limit}`);
  } catch {
    return [];
  }
}

// TimeSeriesContextBuilder result for the most recent window — recent intervals,
// previous-day same time, same-slot last 14 days, same-weekday same-time, today so far.
export async function fetchBehaviorContext(userId) {
  if (!userId) return null;
  try {
    return await get(`/behavior/context?user_id=${userId}`);
  } catch {
    return null;
  }
}

export async function fetchBehaviorStats(userId) {
  if (!userId) return null;
  try {
    return await get(`/behavior/stats?user_id=${userId}`);
  } catch {
    return null;
  }
}

export async function logEvent(type, metadata = {}, userId) {
  try {
    await post('/events', { type, metadata, ts: Date.now(), user_id: userId });
  } catch {
    const queue = JSON.parse((await AsyncStorage.getItem('zs_event_queue')) || '[]');
    queue.push({ type, metadata, ts: Date.now() });
    await AsyncStorage.setItem('zs_event_queue', JSON.stringify(queue));
  }
}
