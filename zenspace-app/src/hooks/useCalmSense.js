import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchTelemetry, fetchProfile } from '../lib/api';

const POLL_MS = 15 * 60 * 1000; // matches the aggregation window cadence

export function useCalmSense() {
  const [state, setState] = useState({
    loading: true,
    telemetry: null,
    profile: null,
  });

  const runCycle = useCallback(async () => {
    try {
      const userIdRaw = await AsyncStorage.getItem('cs_user_id');
      const userId = userIdRaw ? Number(userIdRaw) : undefined;
      const [telemetry, profile] = await Promise.all([fetchTelemetry(userId), fetchProfile(userId)]);
      setState({ loading: false, telemetry, profile });
    } catch {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    runCycle();
    const timer = setInterval(runCycle, POLL_MS);
    return () => clearInterval(timer);
  }, [runCycle]);

  const refresh = useCallback(() => {
    setState(p => ({ ...p, loading: true }));
    runCycle();
  }, [runCycle]);

  return { ...state, refresh };
}
