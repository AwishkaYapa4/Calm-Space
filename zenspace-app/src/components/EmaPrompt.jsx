import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { getDb } from '../lib/db/schema';
import { submitEmaLabel } from '../lib/api';
import { DASHBOARD_PALETTE } from '../lib/theme';

const STRESS_LEVELS = Array.from({ length: 11 }, (_, i) => i);
const LAST_PROMPT_KEY = 'cs_last_ema_prompt';

export default function EmaPrompt({ payload, onDismiss }) {
  const [submitting, setSubmitting] = useState(false);
  const visible = !!payload;

  const respond = async (level) => {
    if (submitting) return;
    setSubmitting(true);
    Haptics.selectionAsync();

    const respondedAt = Date.now();
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO behavior_ema_labels (window_start, stress_level, mood, responded_at) VALUES (?, ?, ?, ?)',
      [payload.windowStart, level, null, respondedAt]
    );
    await AsyncStorage.setItem(LAST_PROMPT_KEY, String(respondedAt));

    const userIdRaw = await AsyncStorage.getItem('cs_user_id');
    submitEmaLabel(
      {
        window_start: payload.windowStart,
        stress_level: level,
        deviated_count: payload.deviatedCount,
        details: payload.perFeature,
        responded_at: respondedAt,
      },
      userIdRaw ? Number(userIdRaw) : undefined
    );

    setSubmitting(false);
    onDismiss();
  };

  const skip = async () => {
    await AsyncStorage.setItem(LAST_PROMPT_KEY, String(Date.now()));
    onDismiss();
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={skip}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Quick check-in</Text>
          <Text style={styles.body}>
            Your phone activity looks different than usual right now. How stressed do you feel?
          </Text>

          <View style={styles.scaleRow}>
            {STRESS_LEVELS.map((n) => (
              <TouchableOpacity
                key={n}
                disabled={submitting}
                style={styles.scaleBtn}
                onPress={() => respond(n)}
                activeOpacity={0.75}
              >
                <Text style={styles.scaleNum}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.labels}>
            <Text style={styles.labelText}>Calm</Text>
            <Text style={styles.labelText}>Very stressed</Text>
          </View>

          <TouchableOpacity onPress={skip} disabled={submitting}>
            <Text style={styles.skip}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: DASHBOARD_PALETTE.cardBg, borderRadius: 24, padding: 22, width: '100%' },
  title: { fontSize: 17, fontWeight: '800', color: DASHBOARD_PALETTE.textPrimary, marginBottom: 6 },
  body: { fontSize: 13, color: DASHBOARD_PALETTE.textMuted, lineHeight: 19, marginBottom: 16 },
  scaleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  scaleBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  scaleNum: { fontSize: 13, fontWeight: '700', color: DASHBOARD_PALETTE.textPrimary },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  labelText: { fontSize: 11, color: DASHBOARD_PALETTE.textMuted },
  skip: { textAlign: 'center', marginTop: 16, color: DASHBOARD_PALETTE.accentRose, fontWeight: '600', fontSize: 13 },
});
