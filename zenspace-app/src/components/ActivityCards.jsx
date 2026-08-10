import { View, Text, StyleSheet } from 'react-native';

function formatTime(mins) {
  if (!mins && mins !== 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Card({ emoji, label, value, sub }) {
  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

export default function ActivityCards({ telemetry }) {
  if (!telemetry) return null;
  const { device_hours_per_day, phone_unlocks, notifications_per_day, social_media_mins } = telemetry;

  const screenMins = Math.round((device_hours_per_day || 0) * 60);

  return (
    <View>
      <Text style={styles.sectionTitle}>Today's Digital Activity</Text>
      <View style={styles.grid}>
        <Card emoji="📱" label="Screen Time"   value={formatTime(screenMins)}        sub={`${device_hours_per_day}h total`} />
        <Card emoji="🔓" label="Unlocks"       value={phone_unlocks ?? '—'}           sub="times today" />
        <Card emoji="🔔" label="Notifications" value={notifications_per_day ?? '—'}   sub="received" />
        <Card emoji="📲" label="Social Media"  value={formatTime(social_media_mins)}  sub="active time" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47%', backgroundColor: '#fff', borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  emoji: { fontSize: 22, marginBottom: 8 },
  value: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  sub:   { fontSize: 11, color: '#94a3b8', marginTop: 2 },
});
