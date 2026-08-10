import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

function RingMeter({ value, max = 100, color, size = 64 }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, max) / max) * circ;

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={6} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={color} strokeWidth={6} fill="none"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
      />
    </Svg>
  );
}

function MetricCard({ emoji, label, value, unit, max, ringColor, subtext }) {
  return (
    <View style={styles.card}>
      <View style={styles.ringWrap}>
        <RingMeter value={value} max={max} color={ringColor} />
        <Text style={styles.ringEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.value}>{value}<Text style={styles.unit}>{unit}</Text></Text>
      <Text style={styles.label}>{label}</Text>
      {subtext ? <Text style={styles.subtext}>{subtext}</Text> : null}
    </View>
  );
}

export default function CalmMetrics({ telemetry }) {
  if (!telemetry) return null;
  const { focus_score, device_hours_per_day, phone_unlocks, sleep_hours, sleep_quality, social_media_mins } = telemetry;

  return (
    <View>
      <Text style={styles.sectionTitle}>Your Calm Metrics</Text>
      <View style={styles.grid}>
        <MetricCard emoji="🧠" label="Mindful Focus" value={focus_score} unit="%" max={100} ringColor="#8b5cf6" subtext="Solid focus loops today" />
        <MetricCard emoji="🌙" label="Rest Balance" value={sleep_hours} unit="h" max={10} ringColor="#6366f1" subtext={`Quality ${sleep_quality}%`} />
        <MetricCard emoji="⏱️" label="Screen Rhythm" value={device_hours_per_day} unit="h" max={17} ringColor="#14b8a6" subtext={`${social_media_mins}m social`} />
        <MetricCard emoji="📱" label="Phone Checks" value={phone_unlocks} unit="×" max={374} ringColor="#f59e0b" subtext="Each check is a choice" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47%', backgroundColor: '#fff', borderRadius: 20, padding: 14,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ringWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  ringEmoji: { position: 'absolute', fontSize: 18 },
  value: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  unit: { fontSize: 11, fontWeight: '400', color: '#94a3b8' },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 2 },
  subtext: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 3, lineHeight: 15 },
});
