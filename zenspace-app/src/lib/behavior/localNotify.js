import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'cs_app_settings'; // same key/shape as app/(tabs)/settings.jsx

// Controls how a notification behaves while this JS engine is alive and
// running (foreground app, or the headless background task) — without this,
// a notification fired from inside the headless task can fail to actually
// surface. Runs once at import time; both the foreground app and the
// headless task import aggregationService.js (which imports this), so
// either entry point sets it up.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Fires an immediate local notification for a real, persistent EMA trigger
 * detected in the background — without this, a headless-detected trigger
 * only ever surfaces the next time the user happens to open the app on
 * their own, which could be hours later or never. Respects the same
 * "notifications" toggle the user controls in Settings; if they've never
 * opted in (default off — see settings.jsx), this silently does nothing
 * rather than asking for permission itself. */
export async function notifyEmaTrigger() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const enabled = raw ? JSON.parse(raw).notifications : false;
    if (!enabled) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Quick check-in',
        body: 'Your phone activity looks different than usual right now. Open CalmSense to log how you feel.',
      },
      trigger: null, // fire immediately
    });
  } catch {
    // best-effort — the trigger is already durably saved in pending_ema_trigger
    // regardless, so a failed notification just means a delayed check-in, not a lost one
  }
}
