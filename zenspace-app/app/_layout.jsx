import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startCapture, checkPermissions } from '../src/lib/db/captureService';
import { subscribeToEmaTrigger } from '../src/lib/behavior/emaBus';
import EmaPrompt from '../src/components/EmaPrompt';

export default function RootLayout() {
  const [emaPayload, setEmaPayload] = useState(null);

  useEffect(() => {
    // Resume passive capture on relaunch if the user already completed onboarding
    // and granted at least one of the permissions last time.
    (async () => {
      const profile = await AsyncStorage.getItem('zs_profile');
      if (!profile) return;
      const { usageAccess, notificationAccess } = await checkPermissions();
      if (usageAccess || notificationAccess) startCapture();
    })();

    const sub = subscribeToEmaTrigger((payload) => setEmaPayload(payload));
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="practice/breathing" options={{ presentation: 'card' }} />
        <Stack.Screen name="ai-profile" options={{ presentation: 'card' }} />
      </Stack>
      <EmaPrompt payload={emaPayload} onDismiss={() => setEmaPayload(null)} />
    </>
  );
}
