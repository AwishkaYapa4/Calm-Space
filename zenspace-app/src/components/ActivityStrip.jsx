import { View, Text, StyleSheet } from 'react-native';
import { DASHBOARD_PALETTE } from '../lib/theme';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildWeekStrip(today) {
  const days = [];
  for (let offset = -2; offset <= 2; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    days.push({
      date: d.getDate(),
      label: DAY_LABELS[d.getDay()],
      isToday: offset === 0,
    });
  }
  return days;
}

export default function ActivityStrip() {
  const days = buildWeekStrip(new Date());

  return (
    <View>
      <Text style={styles.sectionTitle}>Your Activities</Text>
      <View style={styles.row}>
        {days.map((d, i) => (
          <View key={i} style={[styles.cell, d.isToday && styles.cellActive]}>
            <Text style={[styles.date, d.isToday && styles.dateActive]}>{d.date}</Text>
            <Text style={[styles.day, d.isToday && styles.dayActive]}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 20, fontWeight: '800', color: DASHBOARD_PALETTE.textPrimary, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cell: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  cellActive: {
    backgroundColor: DASHBOARD_PALETTE.cardBg,
    shadowColor: DASHBOARD_PALETTE.cardShadow, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  date: { fontSize: 16, fontWeight: '700', color: DASHBOARD_PALETTE.textMuted },
  dateActive: { color: DASHBOARD_PALETTE.textPrimary },
  day: { fontSize: 11, color: DASHBOARD_PALETTE.textMuted, marginTop: 3 },
  dayActive: { color: DASHBOARD_PALETTE.accentRose, fontWeight: '600' },
});
