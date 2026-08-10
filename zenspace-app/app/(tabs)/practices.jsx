import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useCalmSense } from '../../src/hooks/useCalmSense';
import PageHeader from '../../src/components/PageHeader';
import { DASHBOARD_PALETTE } from '../../src/lib/theme';
import { getPersonalizedPractices } from '../../src/lib/practiceLibrary';

const QUOTE = {
  text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
  author: 'Winston Churchill',
};

function PracticeRow({ item }) {
  return (
    <TouchableOpacity
      style={styles.practiceRow}
      activeOpacity={item.route ? 0.75 : 1}
      onPress={() => item.route && router.push(item.route)}
    >
      <View>
        <Text style={styles.practiceTitle}>{item.title}</Text>
        <Text style={styles.practiceMeta}>{item.kind} · {item.duration}</Text>
      </View>
      <View style={styles.practiceIconWrap}>
        <Text style={styles.practiceIcon}>{item.emoji}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function PracticesScreen() {
  const { profile } = useCalmSense();
  const [practices, setPractices] = useState(() => getPersonalizedPractices(null));
  const listRef = useRef(null);

  useFocusEffect(() => {
    AsyncStorage.getItem('zs_coping_style').then((v) => {
      const style = v ? JSON.parse(v) : null;
      setPractices(getPersonalizedPractices(style?.id));
    });
  });

  return (
    <LinearGradient colors={DASHBOARD_PALETTE.bgGradient} style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView ref={listRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <PageHeader profile={profile} />

          <View style={styles.quoteCard}>
            <View style={styles.quoteIconWrap}>
              <Text style={styles.quoteEmoji}>🌿</Text>
            </View>
            <Text style={styles.quoteAuthor}>— {QUOTE.author} —</Text>
            <Text style={styles.quoteText}>"{QUOTE.text}"</Text>
          </View>

          <View style={styles.tileRow}>
            <TouchableOpacity
              style={styles.tile}
              activeOpacity={0.8}
              onPress={() => Alert.alert('Coming soon', 'Journaling will be available in a future update.')}
            >
              <Text style={styles.tileIcon}>📖</Text>
              <Text style={styles.tileLabel}>Journal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tile}
              activeOpacity={0.8}
              onPress={() => listRef.current?.scrollToEnd({ animated: true })}
            >
              <Text style={styles.tileIcon}>✨</Text>
              <Text style={styles.tileLabel}>Practices</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.list}>
            {practices.map(p => <PracticeRow key={p.id} item={p} />)}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 130 },

  quoteCard: {
    backgroundColor: '#fdf2f8', borderRadius: 26, padding: 22, alignItems: 'center', marginBottom: 16,
  },
  quoteIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#fce7f3',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  quoteEmoji: { fontSize: 28 },
  quoteAuthor: { fontSize: 12, fontWeight: '700', color: '#be185d', marginBottom: 8 },
  quoteText: { fontSize: 13, color: DASHBOARD_PALETTE.textPrimary, textAlign: 'center', lineHeight: 20 },

  tileRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  tile: {
    flex: 1, backgroundColor: DASHBOARD_PALETTE.cardBg, borderRadius: 20, padding: 18, alignItems: 'center', gap: 8,
    shadowColor: DASHBOARD_PALETTE.cardShadow, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  tileIcon: { fontSize: 22 },
  tileLabel: { fontSize: 13, fontWeight: '700', color: DASHBOARD_PALETTE.textPrimary },

  list: { gap: 10 },
  practiceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: DASHBOARD_PALETTE.cardBg, borderRadius: 20, padding: 16,
    shadowColor: DASHBOARD_PALETTE.cardShadow, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  practiceTitle: { fontSize: 15, fontWeight: '700', color: DASHBOARD_PALETTE.textPrimary },
  practiceMeta: { fontSize: 12, color: DASHBOARD_PALETTE.textMuted, marginTop: 3 },
  practiceIconWrap: {
    width: 46, height: 46, borderRadius: 16, backgroundColor: '#fdece7',
    alignItems: 'center', justifyContent: 'center',
  },
  practiceIcon: { fontSize: 20 },
});
