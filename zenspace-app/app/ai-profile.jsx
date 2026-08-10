/**
 * Personalization Tab
 * Pattern: "Your AI Coach" — shows who you are behaviorally, how the AI has adapted,
 * streak/progress gamification, and intervention history.
 * Reference: Headspace "Today" + Apple Health "Highlights" design patterns
 */
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { fetchInteractionEvents, fetchDailySummary, fetchBehaviorStats } from '../src/lib/api';

// ── Donut chart ───────────────────────────────────────────────────────────────

function Donut({ rate, color, size = 88 }) {
  const sw = 9, r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (rate / 100) * circ;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="#f1f5f9" strokeWidth={sw} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={sw} fill="none"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
    </Svg>
  );
}

// ── Streak calendar strip ─────────────────────────────────────────────────────

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Maps real daily-summary rows onto this week's Mon..Sun — a day only shows
 * "active" if at least one 15-min window was actually captured that day. */
function buildWeekActivity(dailySummary) {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon .. 6=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek);
  monday.setHours(0, 0, 0, 0);

  const activeDates = new Set(dailySummary.map((d) => d.date));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    return activeDates.has(key);
  });
}

function StreakCalendar({ weekActivity }) {
  return (
    <View style={styles.streakRow}>
      {WEEK_DAYS.map((d, i) => (
        <View key={i} style={styles.streakCol}>
          <View style={[styles.streakDot, weekActivity[i] && styles.streakDotActive]}>
            {weekActivity[i] && <Text style={{ fontSize: 10 }}>✓</Text>}
          </View>
          <Text style={styles.streakDay}>{d}</Text>
        </View>
      ))}
    </View>
  );
}

function formatEventLabel(event) {
  const action = event.action || (event.type === 'success_event' ? 'Completed intervention' : 'Dismissed suggestion');
  return action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

// ── How AI adapts copy ────────────────────────────────────────────────────────

const ADAPTATIONS = {
  social_escaper:      ['Offers a breath exercise before you open social media', 'Sends a gentle nudge after 30 mins of scrolling', 'Suggests app timers on high-stress afternoons'],
  entertainment_seeker:['Prompts a mindful pause before content autoplay', 'Reminds you to take a screen-free break every hour', 'Suggests calming audio instead of video when stressed'],
  communicator:        ['Recommends reaching out to one trusted contact', 'Offers journaling when messaging feels overwhelming', 'Sends quieter nudges to honour your social energy'],
  avoider:             ['Minimal interruptions — respects your natural rhythm', 'Suggests short outdoor walks when stress spikes', 'Reduces notification frequency automatically'],
  productivity_coper:  ['Reminds you to rest every 90 mins of focused work', 'Frames breaks as performance fuel, not lost time', 'Uses Pomodoro-style nudges during long sessions'],
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PersonalizationScreen() {
  const [style, setStyle] = useState(null);
  const [events, setEvents] = useState([]);
  const [weekActivity, setWeekActivity] = useState(Array(7).fill(false));
  const [streakDays, setStreakDays] = useState(0);
  const [histOpen, setHistOpen] = useState(false);

  const load = useCallback(async () => {
    AsyncStorage.getItem('zs_coping_style').then(v => v && setStyle(JSON.parse(v)));

    const userIdRaw = await AsyncStorage.getItem('cs_user_id');
    const userId = userIdRaw ? Number(userIdRaw) : undefined;
    const [realEvents, dailySummary, stats] = await Promise.all([
      fetchInteractionEvents(userId, 20),
      fetchDailySummary(userId, 7),
      fetchBehaviorStats(userId),
    ]);
    setEvents(realEvents);
    setWeekActivity(buildWeekActivity(dailySummary));
    setStreakDays(stats?.streak_days ?? 0);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const successes     = events.filter(e => e.type === 'success_event').length;
  const total         = events.length;
  const acceptRate    = total > 0 ? Math.round((successes / total) * 100) : 0;
  const daysActiveThisWeek = weekActivity.filter(Boolean).length;
  const styleColor    = style?.color || '#7c3aed';
  const adaptations   = ADAPTATIONS[style?.id] || ADAPTATIONS.social_escaper;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Page title */}
        <Text style={styles.pageTitle}>Your AI Profile</Text>

        {/* Coping style hero */}
        {style ? (
          <LinearGradient
            colors={[styleColor, styleColor + 'aa']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Text style={styles.heroSub}>Digital Coping Style</Text>
            <Text style={styles.heroEmoji}>{style.emoji}</Text>
            <Text style={styles.heroName}>{style.label}</Text>
            <Text style={styles.heroDesc}>{style.description}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.heroCard, { backgroundColor: '#ede9fe', alignItems: 'center' }]}>
            <Text style={{ color: '#7c3aed', fontSize: 14 }}>Complete onboarding to unlock your AI profile</Text>
          </View>
        )}

        {/* Weekly streak */}
        <View style={[styles.card, { marginTop: 14 }]}>
          <View style={styles.cardTitleRow}>
            <View>
              <Text style={styles.cardTitle}>This Week's Streak</Text>
              <Text style={styles.cardSub}>{daysActiveThisWeek} of 7 days active</Text>
            </View>
            <View style={styles.streakBadge}>
              <Text style={styles.streakNum}>🔥 {streakDays}</Text>
            </View>
          </View>
          <StreakCalendar weekActivity={weekActivity} />
        </View>

        {/* Intervention acceptance rate */}
        <View style={[styles.card, { marginTop: 14 }]}>
          <Text style={styles.cardTitle}>Intervention Success Rate</Text>
          {total === 0 ? (
            <Text style={styles.rateSub}>
              No interactions yet — this fills in as you accept or dismiss suggestions.
            </Text>
          ) : (
            <View style={styles.rateRow}>
              <View style={styles.donutWrap}>
                <Donut rate={acceptRate} color={styleColor} />
                <View style={styles.donutCenter}>
                  <Text style={[styles.rateNum, { color: styleColor }]}>{acceptRate}%</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rateHeadline}>
                  {successes} of {total} recent suggestions accepted
                </Text>
                <Text style={styles.rateSub}>
                  CalmSense refines your personal threshold after every interaction. The more you use it, the better it fits.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* How AI adapts for you */}
        <View style={[styles.card, { marginTop: 14 }]}>
          <Text style={styles.cardTitle}>How CalmSense Adapts for You</Text>
          <Text style={styles.cardSub}>Based on your coping style and daily patterns</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {adaptations.map((a, i) => (
              <View key={i} style={styles.adaptRow}>
                <View style={[styles.adaptDot, { backgroundColor: styleColor }]} />
                <Text style={styles.adaptText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Intervention history */}
        <View style={[styles.card, { marginTop: 14 }]}>
          <TouchableOpacity style={styles.cardTitleRow} onPress={() => setHistOpen(v => !v)}>
            <Text style={styles.cardTitle}>Intervention History</Text>
            {events.length > 0 && <Text style={styles.expandIcon}>{histOpen ? '▲' : '▼'}</Text>}
          </TouchableOpacity>

          {events.length === 0 ? (
            <Text style={styles.rateSub}>No interventions logged yet.</Text>
          ) : (
            <>
              {(histOpen ? events : events.slice(0, 3)).map((e, i) => (
                <View key={i} style={styles.histRow}>
                  <View style={[styles.histBadge,
                    { backgroundColor: e.type === 'success_event' ? '#dcfce7' : '#fee2e2' }]}>
                    <Text style={{ fontSize: 12 }}>{e.type === 'success_event' ? '✓' : '×'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histLabel}>{formatEventLabel(e)}</Text>
                    <Text style={styles.histTime}>{new Date(e.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                  </View>
                </View>
              ))}

              {!histOpen && events.length > 3 && (
                <TouchableOpacity onPress={() => setHistOpen(true)} style={styles.seeMoreBtn}>
                  <Text style={styles.seeMoreText}>See all {events.length} interactions →</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 16, paddingBottom: 110 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#1e293b', marginBottom: 14 },

  heroCard: { borderRadius: 24, padding: 24, alignItems: 'center' },
  heroSub:  { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 },
  heroEmoji:{ fontSize: 48, marginBottom: 8 },
  heroName: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  heroDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center', lineHeight: 21 },

  card: {
    backgroundColor: '#fff', borderRadius: 22, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  cardSub:   { fontSize: 12, color: '#94a3b8', marginTop: 3, lineHeight: 17 },
  expandIcon:{ fontSize: 12, color: '#94a3b8', marginTop: 2 },

  // Streak
  streakBadge: { backgroundColor: '#fff7ed', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  streakNum:   { fontSize: 14, fontWeight: '800', color: '#f97316' },
  streakRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  streakCol:   { alignItems: 'center', gap: 4 },
  streakDot:   { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  streakDotActive: { backgroundColor: '#d1fae5' },
  streakDay:   { fontSize: 10, color: '#94a3b8', fontWeight: '600' },

  // Rate
  rateRow:     { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  donutWrap:   { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  rateNum:     { fontSize: 20, fontWeight: '800' },
  rateHeadline:{ fontSize: 13, fontWeight: '600', color: '#334155', lineHeight: 19, marginBottom: 6 },
  rateSub:     { fontSize: 12, color: '#94a3b8', lineHeight: 18 },

  // Adaptations
  adaptRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  adaptDot:  { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  adaptText: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 20 },

  // History
  histRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f8fafc' },
  histBadge:  { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  histLabel:  { fontSize: 13, color: '#334155', fontWeight: '500' },
  histTime:   { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  seeMoreBtn: { marginTop: 8, alignItems: 'center', paddingVertical: 6 },
  seeMoreText:{ fontSize: 13, color: '#7c3aed', fontWeight: '600' },
});
