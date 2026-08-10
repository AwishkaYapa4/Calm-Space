/**
 * Data & Analysis tab — a transparency view into the actual passive-capture
 * pipeline (raw events → 15-min aggregation → sync → Python deviation engine).
 * Every number here is read from real local SQLite or the real backend; there
 * is no mock/placeholder data path. If nothing has been captured yet, sections
 * say so plainly instead of showing a fabricated number.
 */
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';

import { fetchTelemetry, fetchBehaviorHistory, fetchDailySummary, fetchBehaviorStats, fetchBehaviorContext } from '../../src/lib/api';
import { getCaptureStats } from '../../src/lib/db/captureStats';
import { checkPermissions, hasNativeCaptureSupport } from '../../src/lib/db/captureService';
import { DASHBOARD_PALETTE as P } from '../../src/lib/theme';

function formatMins(totalSeconds) {
  const mins = Math.round((totalSeconds ?? 0) / 60);
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}

function timeAgo(ts) {
  if (!ts) return 'never';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

function windowLabel(windowStartMs) {
  const d = new Date(windowStartMs);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

function StatusRow({ label, ok, detail }) {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, { backgroundColor: ok ? '#34d399' : '#f87171' }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.statusLabel}>{label}</Text>
        {detail ? <Text style={styles.statusDetail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

function DailyBarChart({ days }) {
  const W = 300, H = 90, padL = 24, padB = 20;
  if (!days.length) return <Text style={styles.emptyText}>No days captured yet.</Text>;

  const maxVal = Math.max(1, ...days.map((d) => d.unlock_count));
  const colW = (W - padL) / days.length;

  return (
    <Svg width={W} height={H + padB}>
      <Line x1={padL} y1={H} x2={W} y2={H} stroke="#f1f5f9" strokeWidth={1} />
      {days.map((d, i) => {
        const bH = Math.max(2, (d.unlock_count / maxVal) * H);
        const x = padL + i * colW + colW * 0.2;
        const bW = colW * 0.6;
        const label = new Date(d.date).toLocaleDateString([], { weekday: 'short' }).slice(0, 3);
        return (
          <Svg key={d.date}>
            <Rect x={x} y={H - bH} width={bW} height={bH} rx={3} fill={P.accentRose} />
            <SvgText x={x + bW / 2} y={H + padB - 4} textAnchor="middle" fontSize={9} fill={P.textMuted}>
              {label}
            </SvgText>
          </Svg>
        );
      })}
    </Svg>
  );
}

function ContextRow({ label, count, detail }) {
  return (
    <View style={styles.contextRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.statusLabel}>{label}</Text>
        {detail ? <Text style={styles.statusDetail}>{detail}</Text> : null}
      </View>
      <Text style={styles.contextCount}>{count}</Text>
    </View>
  );
}

function WindowRow({ item }) {
  const badge =
    item.deviated_count == null
      ? { text: 'Not analyzed', color: P.textMuted }
      : item.deviated_count >= 2
      ? { text: `${item.deviated_count} features off-baseline`, color: '#f87171' }
      : { text: 'Normal', color: '#34d399' };

  return (
    <View style={styles.windowRow}>
      <Text style={styles.windowTime}>{windowLabel(item.window_start)}</Text>
      <Text style={styles.windowStat}>{formatMins(item.screen_time_sec)} screen</Text>
      <Text style={styles.windowStat}>{item.unlock_count} unlocks</Text>
      <Text style={styles.windowStat}>{item.notification_count} notifs</Text>
      <Text style={[styles.windowBadge, { color: badge.color }]}>{badge.text}</Text>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function DataAnalysisScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [permissions, setPermissions] = useState({ usageAccess: false, notificationAccess: false });
  const [capture, setCapture] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [history, setHistory] = useState([]);
  const [dailySummary, setDailySummary] = useState([]);
  const [stats, setStats] = useState(null);
  const [context, setContext] = useState(null);

  const load = useCallback(async () => {
    const userIdRaw = await AsyncStorage.getItem('cs_user_id');
    const userId = userIdRaw ? Number(userIdRaw) : undefined;

    const [perms, cap, tel, hist, daily, behaviorStats, ctx] = await Promise.all([
      checkPermissions(),
      getCaptureStats(),
      fetchTelemetry(userId),
      fetchBehaviorHistory(userId, 8),
      fetchDailySummary(userId, 7),
      fetchBehaviorStats(userId),
      fetchBehaviorContext(userId),
    ]);

    setPermissions(perms);
    setCapture(cap);
    setTelemetry(tel);
    setHistory(hist);
    setDailySummary(daily);
    setStats(behaviorStats);
    setContext(ctx);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.pageTitle}>Data & Analysis</Text>
        <Text style={styles.emptyText}>Loading real capture data…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.accentRose} />}
      >
        <Text style={styles.pageTitle}>Data & Analysis</Text>

        <SectionCard title="Capture Status" subtitle="Real state of the on-device passive-capture pipeline">
          {!hasNativeCaptureSupport() ? (
            <Text style={styles.emptyText}>
              Native capture isn't available in this build (requires the CalmSense dev client, not Expo Go).
            </Text>
          ) : (
            <View style={{ marginTop: 10, gap: 10 }}>
              <StatusRow label="Usage access" ok={permissions.usageAccess} detail={permissions.usageAccess ? 'Granted' : 'Not granted — enable in Settings'} />
              <StatusRow label="Notification access" ok={permissions.notificationAccess} detail={permissions.notificationAccess ? 'Granted' : 'Not granted — enable in Settings'} />
              <View style={styles.captureStatsRow}>
                <View style={styles.captureStatBox}>
                  <Text style={styles.captureStatValue}>{capture?.totalEvents ?? 0}</Text>
                  <Text style={styles.captureStatLabel}>Raw events captured</Text>
                </View>
                <View style={styles.captureStatBox}>
                  <Text style={styles.captureStatValue}>{capture?.todayEvents ?? 0}</Text>
                  <Text style={styles.captureStatLabel}>Today</Text>
                </View>
                <View style={styles.captureStatBox}>
                  <Text style={styles.captureStatValue}>{capture?.totalWindows ?? 0}</Text>
                  <Text style={styles.captureStatLabel}>15-min windows</Text>
                </View>
                <View style={styles.captureStatBox}>
                  <Text style={styles.captureStatValue}>{capture?.pendingSync ?? 0}</Text>
                  <Text style={styles.captureStatLabel}>Pending sync</Text>
                </View>
              </View>
              <Text style={styles.lastEventText}>Last raw event: {timeAgo(capture?.lastEventAt)}</Text>
            </View>
          )}
        </SectionCard>

        <SectionCard title="Today (real, synced totals)">
          {telemetry?.source !== 'real' ? (
            <Text style={styles.emptyText}>
              No account registered yet — complete onboarding to start real tracking.
            </Text>
          ) : (
            <View style={styles.todayGrid}>
              <View style={styles.todayCell}>
                <Text style={styles.todayValue}>{telemetry.device_hours_per_day}h</Text>
                <Text style={styles.todayLabel}>Screen time</Text>
              </View>
              <View style={styles.todayCell}>
                <Text style={styles.todayValue}>{telemetry.phone_unlocks}</Text>
                <Text style={styles.todayLabel}>Unlocks</Text>
              </View>
              <View style={styles.todayCell}>
                <Text style={styles.todayValue}>{telemetry.notifications_per_day}</Text>
                <Text style={styles.todayLabel}>Notifications</Text>
              </View>
              <View style={styles.todayCell}>
                <Text style={styles.todayValue}>{telemetry.social_media_mins}m</Text>
                <Text style={styles.todayLabel}>Social media</Text>
              </View>
            </View>
          )}
        </SectionCard>

        <SectionCard title="7-Day Unlock Trend" subtitle="Real per-day unlock counts from synced windows">
          <View style={{ alignItems: 'center', marginTop: 6 }}>
            <DailyBarChart days={dailySummary} />
          </View>
        </SectionCard>

        <SectionCard title="Time-Series Context" subtitle="What the latest analysis actually compared against (TimeSeriesContextBuilder)">
          {!context?.window_start ? (
            <Text style={styles.emptyText}>No analyzed window yet.</Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              <ContextRow
                label="Last 4 intervals"
                count={context.recent_intervals.length}
                detail="Most recent hour, any time of day"
              />
              <ContextRow
                label="Previous day, same time"
                count={context.previous_day_same_time ? 1 : 0}
                detail={context.previous_day_same_time ? 'Found — used for direct comparison' : 'Not captured yet'}
              />
              <ContextRow
                label="Same time slot, last 14 days"
                count={context.same_slot_last_14_days.length}
                detail="This is the deviation engine's baseline array"
              />
              <ContextRow
                label="Same weekday, same time"
                count={context.same_weekday_same_time.length}
                detail="e.g. previous Fridays at this hour"
              />
              <ContextRow
                label="Today so far"
                count={context.today_so_far.length}
                detail="Midnight through the analyzed window"
              />
            </View>
          )}
        </SectionCard>

        <SectionCard title="Recent 15-Minute Windows" subtitle="Latest aggregated windows and their deviation status">
          {history.length === 0 ? (
            <Text style={styles.emptyText}>No windows synced yet — check back after ~15 minutes of use.</Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              {history.map((item) => (
                <WindowRow key={item.window_start} item={item} />
              ))}
            </View>
          )}
        </SectionCard>

        <SectionCard title="Activity Stats" subtitle="Computed from real captured windows, not estimated">
          <View style={styles.todayGrid}>
            <View style={styles.todayCell}>
              <Text style={styles.todayValue}>{stats?.days_active ?? 0}</Text>
              <Text style={styles.todayLabel}>Days active</Text>
            </View>
            <View style={styles.todayCell}>
              <Text style={styles.todayValue}>{stats?.sessions_done ?? 0}</Text>
              <Text style={styles.todayLabel}>Sessions done</Text>
            </View>
            <View style={styles.todayCell}>
              <Text style={styles.todayValue}>{stats?.streak_days ?? 0}</Text>
              <Text style={styles.todayLabel}>Day streak</Text>
            </View>
          </View>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 16, paddingBottom: 130 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#1e293b', marginBottom: 14 },
  emptyText: { fontSize: 13, color: P.textMuted, lineHeight: 19, marginTop: 8 },

  card: {
    backgroundColor: '#fff', borderRadius: 22, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  cardSub: { fontSize: 12, color: P.textMuted, marginTop: 3, lineHeight: 17 },

  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  statusLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
  statusDetail: { fontSize: 11, color: P.textMuted, marginTop: 1 },

  contextRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#f8fafc',
  },
  contextCount: { fontSize: 16, fontWeight: '800', color: P.accentRose, marginLeft: 12 },

  captureStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  captureStatBox: { flexBasis: '47%', backgroundColor: '#f8fafc', borderRadius: 14, padding: 12, alignItems: 'center' },
  captureStatValue: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  captureStatLabel: { fontSize: 10, color: P.textMuted, marginTop: 2, textAlign: 'center' },
  lastEventText: { fontSize: 11, color: P.textMuted, marginTop: 2 },

  todayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  todayCell: { flexBasis: '47%', backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, alignItems: 'center' },
  todayValue: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  todayLabel: { fontSize: 11, color: P.textMuted, marginTop: 3 },

  windowRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#f8fafc',
  },
  windowTime: { fontSize: 12, fontWeight: '700', color: '#1e293b', width: 56 },
  windowStat: { fontSize: 11, color: P.textMuted },
  windowBadge: { fontSize: 11, fontWeight: '700', marginLeft: 'auto' },
});
