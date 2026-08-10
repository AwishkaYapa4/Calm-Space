import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { DASHBOARD_PALETTE } from '../lib/theme';

const SLEEP_TARGET_HOURS = 8;

function Donut({ pct, size = 120 }) {
  const sw = 12, r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const segments = [
    { pct: Math.min(pct, 60), color: '#c4b5fd' },
    { pct: Math.min(Math.max(pct - 60, 0), 25), color: '#bef264' },
    { pct: Math.min(Math.max(pct - 85, 0), 15), color: '#93c5fd' },
  ];

  let offsetAcc = 0;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="#f1f5f9" strokeWidth={sw} fill="none" />
      {segments.map((s, i) => {
        if (s.pct <= 0) return null;
        const dash = (s.pct / 100) * circ;
        const el = (
          <Circle
            key={i}
            cx={size / 2} cy={size / 2} r={r}
            stroke={s.color} strokeWidth={sw} fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset={-offsetAcc}
          />
        );
        offsetAcc += dash;
        return el;
      })}
    </Svg>
  );
}

export default function PhysicalStateCard({ telemetry }) {
  const achieved = telemetry?.sleep_hours ?? 0;
  const missing = Math.max(SLEEP_TARGET_HOURS - achieved, 0);
  const pct = Math.min(Math.round((achieved / SLEEP_TARGET_HOURS) * 100), 100);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Physical state</Text>
        <Text style={styles.tuneIcon}>⚙︎</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.legend}>
          <LegendRow color="#c4b5fd" value={`${SLEEP_TARGET_HOURS}h Target`} label="Sleep Goal" />
          <LegendRow color="#bef264" value={`${achieved.toFixed(1)}h Achieved`} label="Last Night" />
          <LegendRow color="#93c5fd" value={`${missing.toFixed(1)}h Missing`} label="Deficit" />
        </View>

        <View style={styles.donutWrap}>
          <Donut pct={pct} />
          <View style={styles.donutCenter}>
            <Text style={styles.pctText}>{pct}%</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function LegendRow({ color, value, label }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendBar, { backgroundColor: color }]} />
      <View>
        <Text style={styles.legendValue}>{value}</Text>
        <Text style={styles.legendLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DASHBOARD_PALETTE.cardBg, borderRadius: 26, padding: 20,
    shadowColor: DASHBOARD_PALETTE.cardShadow, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 17, fontWeight: '800', color: DASHBOARD_PALETTE.textPrimary },
  tuneIcon: { fontSize: 16, color: DASHBOARD_PALETTE.textMuted },
  body: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legend: { gap: 16, flex: 1 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendBar: { width: 4, height: 30, borderRadius: 2 },
  legendValue: { fontSize: 13, fontWeight: '700', color: DASHBOARD_PALETTE.textPrimary },
  legendLabel: { fontSize: 11, color: DASHBOARD_PALETTE.textMuted, marginTop: 1 },
  donutWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  pctText: { fontSize: 22, fontWeight: '800', color: DASHBOARD_PALETTE.textPrimary },
});
