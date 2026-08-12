import { View, Text, StyleSheet } from 'react-native';
import { DASHBOARD_PALETTE } from '../lib/theme';

function formatHours(hours) {
  if (hours == null) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

// Screen time and unlocks are the two fields the passive-capture pipeline
// actually aggregates from real behavior_observations rows — unlike
// sleep/mood, which the backend has no sensor for and always returns null.
export default function WellbeingCards({ telemetry }) {
  const screenTime = telemetry?.device_hours_per_day;
  const unlocks = telemetry?.phone_unlocks;

  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>📱</Text>
        </View>
        <View>
          <Text style={styles.label}>Screen Time</Text>
          <Text style={styles.value}>{formatHours(screenTime)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: '#fff7ed' }]}>
          <Text style={styles.icon}>🔓</Text>
        </View>
        <View>
          <Text style={styles.label}>Phone Unlocks</Text>
          <Text style={styles.value}>{unlocks ?? '—'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: DASHBOARD_PALETTE.cardBg, borderRadius: 20, padding: 14,
    shadowColor: DASHBOARD_PALETTE.cardShadow, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: '#fdece7',
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 17 },
  label: { fontSize: 11, color: DASHBOARD_PALETTE.textMuted, fontWeight: '600' },
  value: { fontSize: 15, fontWeight: '800', color: DASHBOARD_PALETTE.textPrimary, marginTop: 2 },
});
