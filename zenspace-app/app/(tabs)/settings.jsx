/**
 * Profile & Settings Tab
 * Pattern: Profile header with stats → grouped settings sections
 * Reference: Apple Health profile + Headspace account page
 */
import { useState, useCallback } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  hasNativeCaptureSupport, checkPermissions,
  openUsageAccessSettings, openNotificationAccessSettings, openExactAlarmSettings,
} from '../../src/lib/db/captureService';
import { fetchBehaviorStats } from '../../src/lib/api';

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBox({ emoji, value, label }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SettingRow({ emoji, label, desc, value, onChange, last }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Text style={{ fontSize: 17 }}>{emoji}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {desc ? <Text style={styles.rowDesc}>{desc}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={v => { Haptics.selectionAsync(); onChange(v); }}
        trackColor={{ false: '#e2e8f0', true: '#7c3aed' }}
        thumbColor="#fff"
        ios_backgroundColor="#e2e8f0"
      />
    </View>
  );
}

function NavRow({ emoji, label, desc, onPress, last }) {
  return (
    <TouchableOpacity style={[styles.row, !last && styles.rowBorder]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowIcon}>
        <Text style={{ fontSize: 17 }}>{emoji}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {desc ? <Text style={styles.rowDesc}>{desc}</Text> : null}
      </View>
      <Text style={styles.navArrow}>›</Text>
    </TouchableOpacity>
  );
}

function SectionCard({ title, children }) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

// Only "notifications" is kept — it's the one toggle that does something real
// (requests the OS notification permission). Theme, sensitivity, ambient colors,
// nightly optimizer, and data-sharing were all UI with no wired-up effect
// anywhere in the app, so they were removed rather than left as dead controls.
const SETTINGS_KEY = 'cs_app_settings';
const DEFAULT_SETTINGS = { notifications: false };

export default function SettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [copingStyle, setCopingStyle] = useState(null);
  const [sw, setSw] = useState(DEFAULT_SETTINGS);
  const [capturePerms, setCapturePerms] = useState({ usageAccess: false, notificationAccess: false, exactAlarmAccess: false });
  const [behaviorStats, setBehaviorStats] = useState(null);

  const persistSettings = (next) => AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));

  const load = useCallback(() => {
    AsyncStorage.getItem('zs_profile').then(v => {
      if (!v) return;
      setProfile(JSON.parse(v));
    });
    AsyncStorage.getItem('zs_coping_style').then(v => v && setCopingStyle(JSON.parse(v)));
    checkPermissions().then(setCapturePerms);
    AsyncStorage.getItem('cs_user_id').then(v => {
      fetchBehaviorStats(v ? Number(v) : undefined).then(setBehaviorStats);
    });
    AsyncStorage.getItem(SETTINGS_KEY).then(v => {
      setSw(v ? JSON.parse(v) : DEFAULT_SETTINGS);
    });
  }, []);

  useFocusEffect(load);

  const requestNotif = async (val) => {
    if (val) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Enable notifications in device Settings to receive gentle reminders.');
        return;
      }
    }
    setSw(p => { const next = { ...p, notifications: val }; persistSettings(next); return next; });
  };

  const resetApp = () => {
    Alert.alert(
      'Reset CalmSense',
      'Your profile, coping style, and history will be cleared. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['zs_profile', 'zs_coping_style', 'zs_event_queue', SETTINGS_KEY]);
            router.replace('/onboarding');
          },
        },
      ]
    );
  };

  const initials = profile?.name?.slice(0, 2).toUpperCase() || '??';
  const styleColor = copingStyle?.color || '#7c3aed';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Profile Header ──────────────────────────────── */}
        <LinearGradient
          colors={[styleColor, styleColor + 'cc']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.profileCard}
        >
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              {copingStyle && (
                <View style={styles.styleTag}>
                  <Text style={{ fontSize: 12 }}>{copingStyle.emoji}</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{profile?.name || 'Your Profile'}</Text>
              <Text style={styles.profileRole}>{profile?.daily_role}{profile?.income_level ? ` · ${profile.income_level} income` : ''}</Text>
              {copingStyle && (
                <View style={styles.copingBadge}>
                  <Text style={styles.copingBadgeText}>{copingStyle.label}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Stats row — real, computed from captured windows and logged interactions */}
          <View style={styles.statsRow}>
            <StatBox emoji="📅" value={String(behaviorStats?.days_active ?? 0)} label="Days Active" />
            <View style={styles.statDivider} />
            <StatBox emoji="🌬️" value={String(behaviorStats?.sessions_done ?? 0)} label="Sessions Done" />
            <View style={styles.statDivider} />
            <StatBox emoji="🔥" value={String(behaviorStats?.streak_days ?? 0)} label="Day Streak" />
          </View>
        </LinearGradient>

        {/* ── Notifications ────────────────────────────────── */}
        <SectionCard title="Notifications">
          <SettingRow emoji="🔔" label="Gentle nudges" desc="Allow CalmSense to send notifications" value={sw.notifications} onChange={requestNotif} last />
        </SectionCard>

        {/* ── Data & Privacy ──────────────────────────────── */}
        <SectionCard title="Data & Privacy">
          {hasNativeCaptureSupport() ? (
            <>
              <NavRow
                emoji="📱"
                label="Usage access"
                desc={capturePerms.usageAccess ? 'Granted — reads app foreground/background timing' : 'Not granted — tap to enable in Settings'}
                onPress={openUsageAccessSettings}
              />
              <NavRow
                emoji="🔔"
                label="Notification access"
                desc={capturePerms.notificationAccess ? 'Granted — counts notifications only, never content' : 'Not granted — tap to enable in Settings'}
                onPress={openNotificationAccessSettings}
              />
              <NavRow
                emoji="⏰"
                label="Alarms & reminders"
                desc={capturePerms.exactAlarmAccess
                  ? 'Granted — background check-ins run on time even when the phone is idle'
                  : 'Not granted — background checks may be delayed for hours; tap to enable'}
                onPress={openExactAlarmSettings}
                last
              />
            </>
          ) : (
            <SettingRow emoji="📱" label="Usage access" desc="Requires the CalmSense dev build, not Expo Go" value={false} onChange={() => {}} />
          )}
        </SectionCard>

        {/* ── Account ─────────────────────────────────────── */}
        <SectionCard title="Account">
          <NavRow emoji="🤖" label="AI Profile & Coping Style" desc="Personalization insights and intervention history" onPress={() => router.push('/ai-profile')} />
          <NavRow emoji="📤" label="Export my data" desc="Download a copy of your wellness history" onPress={() => Alert.alert('Coming soon', 'Data export will be available in v1.0')} />
          <TouchableOpacity style={[styles.row]} onPress={resetApp} activeOpacity={0.7}>
            <View style={styles.rowIcon}><Text style={{ fontSize: 17 }}>🗑️</Text></View>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: '#ef4444' }]}>Reset CalmSense</Text>
              <Text style={styles.rowDesc}>Clear all data and restart onboarding</Text>
            </View>
          </TouchableOpacity>
        </SectionCard>

        <Text style={styles.footer}>CalmSense v0.1.0 · All data stays on-device 🔒</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { paddingBottom: 110 },

  // Profile
  profileCard: { margin: 16, borderRadius: 24, padding: 20, marginBottom: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  styleTag: { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  profileName: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 2 },
  profileRole: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 6 },
  copingBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  copingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 16, padding: 12 },
  statBox: { flex: 1, alignItems: 'center', gap: 3 },
  statEmoji: { fontSize: 16 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 4 },

  // Sections
  sectionBlock: { paddingHorizontal: 16, marginBottom: 6 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },

  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  rowDesc:  { fontSize: 12, color: '#94a3b8', marginTop: 2, lineHeight: 17 },
  navArrow: { fontSize: 20, color: '#cbd5e1', fontWeight: '300' },

  footer: { textAlign: 'center', color: '#cbd5e1', fontSize: 12, marginTop: 10, marginBottom: 4, paddingHorizontal: 16 },
});
