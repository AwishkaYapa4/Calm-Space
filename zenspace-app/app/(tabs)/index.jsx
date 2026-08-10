import { useCallback } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';

import { useCalmSense } from '../../src/hooks/useCalmSense';
import PageHeader from '../../src/components/PageHeader';
import ActivityStrip from '../../src/components/ActivityStrip';
import WellbeingCards from '../../src/components/WellbeingCards';
import PhysicalStateCard from '../../src/components/PhysicalStateCard';
import { DASHBOARD_PALETTE } from '../../src/lib/theme';

export default function HomeScreen() {
  const { loading, telemetry, profile, refresh } = useCalmSense();

  // Tabs stay mounted in React Navigation — without this, switching back to
  // Home after using another tab (or the app) would keep showing whatever
  // was fetched up to 15 minutes ago instead of the current real numbers.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (loading) {
    return (
      <LinearGradient colors={DASHBOARD_PALETTE.bgGradient} style={styles.loadingBg}>
        <ActivityIndicator color={DASHBOARD_PALETTE.accentRose} size="large" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={DASHBOARD_PALETTE.bgGradient} style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <PageHeader profile={profile} />

          <View style={styles.gap}>
            <ActivityStrip />
          </View>

          <View style={styles.gap}>
            <WellbeingCards telemetry={telemetry} />
          </View>

          <View style={[styles.gap, { marginTop: 24 }]}>
            <PhysicalStateCard telemetry={telemetry} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingBg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 130 },
  gap: { marginTop: 16 },
});
