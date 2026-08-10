import { View, Text, StyleSheet } from 'react-native';
import { DASHBOARD_PALETTE } from '../lib/theme';

function formatHours(hours) {
  if (hours == null) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

// Mood is framed as a soft, positive metric rather than a raw stress number —
// derived from sleep quality so it still reflects real signal without exposing the model score.
function moodFromSleepQuality(sleepQuality) {
  if (sleepQuality == null) return null;
  return Math.round((sleepQuality / 100) * 10 * 10) / 10;
}

export default function WellbeingCards({ telemetry }) {
  const sleepHours = telemetry?.sleep_hours;
  const mood = moodFromSleepQuality(telemetry?.sleep_quality);

  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🧘</Text>
        </View>
        <View>
          <Text style={styles.label}>Sleeping Times</Text>
          <Text style={styles.value}>{formatHours(sleepHours)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: '#fff7ed' }]}>
          <Text style={styles.icon}>🙂</Text>
        </View>
        <View>
          <Text style={styles.label}>Mood Level</Text>
          <Text style={styles.value}>{mood != null ? `${mood}/10` : '—'}</Text>
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
