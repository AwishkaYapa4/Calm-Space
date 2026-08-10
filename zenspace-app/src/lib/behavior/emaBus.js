import { DeviceEventEmitter } from 'react-native';

// Pure-JS event, not backed by a native module — works the same on captured
// device events and on the local decision-engine trigger below.
export const EMA_TRIGGER_EVENT = 'CalmSenseEmaTrigger';

export function emitEmaTrigger(payload) {
  DeviceEventEmitter.emit(EMA_TRIGGER_EVENT, payload);
}

export function subscribeToEmaTrigger(handler) {
  return DeviceEventEmitter.addListener(EMA_TRIGGER_EVENT, handler);
}
