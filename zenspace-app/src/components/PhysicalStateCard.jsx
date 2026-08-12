import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { DASHBOARD_PALETTE } from '../lib/theme';

function Donut({ pct, size = 120 }) {
  const sw = 12, r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(Math.max(pct, 0), 100) / 100) * circ;

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="#f1f5f9" strokeWidth={sw} fill="none" />
      {dash > 0 && (
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={DASHBOARD_PALETTE.accentRose} strokeWidth={sw} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      )}
    </Svg>
  );
}

// Breaks today's real, synced screen time (device_hours_per_day) into social
// vs. other minutes (social_media_mins). Both fields come straight from the
// backend's aggregation over real behavior_observations rows — unlike sleep,
// which the pipeline never captures, so this card no longer touches it.
export default function PhysicalStateCard({ telemetry }) {
  const hasData = telemetry?.device_hours_per_day != null;
  const totalMins = hasData ? Math.round(telemetry.device_hours_per_day * 60) : 0;
  const socialMins = Math.min(telemetry?.social_media_mins ?? 0, totalMins);
  const otherMins = Math.max(totalMins - socialMins, 0);
  const pct = totalMins > 0 ? Math.round((socialMins / totalMins) * 100) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Screen time breakdown</Text>
        <Text style={styles.tuneIcon}>⚙︎</Text>
      </View>

      {!hasData ? (
        <Text style={styles.emptyText}>No screen time synced yet today.</Text>
      ) : (
        <View style={styles.body}>
          <View style={styles.legend}>
            <LegendRow color={DASHBOARD_PALETTE.accentRose} value={`${Math.floor(totalMins / 60)}h ${totalMins % 60}m Total`} label="Screen Time" />
            <LegendRow color={DASHBOARD_PALETTE.accentLilac} value={`${socialMins}m Social`} label="Social Media" />
            <LegendRow color={DASHBOARD_PALETTE.accentSky} value={`${otherMins}m Other`} label="Everything Else" />
          </View>

          <View style={styles.donutWrap}>
            <Donut pct={pct} />
            <View style={styles.donutCenter}>
              <Text style={styles.pctText}>{pct}%</Text>
              <Text style={styles.pctLabel}>social</Text>
            </View>
          </View>
        </View>
      )}
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
  emptyText: { fontSize: 13, color: DASHBOARD_PALETTE.textMuted, lineHeight: 19 },
  body: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legend: { gap: 16, flex: 1 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendBar: { width: 4, height: 30, borderRadius: 2 },
  legendValue: { fontSize: 13, fontWeight: '700', color: DASHBOARD_PALETTE.textPrimary },
  legendLabel: { fontSize: 11, color: DASHBOARD_PALETTE.textMuted, marginTop: 1 },
  donutWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  pctText: { fontSize: 22, fontWeight: '800', color: DASHBOARD_PALETTE.textPrimary },
  pctLabel: { fontSize: 10, color: DASHBOARD_PALETTE.textMuted, marginTop: -2 },
});
