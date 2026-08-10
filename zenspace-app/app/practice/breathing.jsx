import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logEvent } from '../../src/lib/api';

const TRACK = { title: 'Whispers of Stillness', artist: '@denisewilliams', durationSec: 173 }; // 2:53

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function BreathingMeditationScreen() {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(52); // matches reference mock's starting position
  const [liked, setLiked] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (playing) {
      timer.current = setInterval(() => {
        setElapsed(e => {
          if (e + 1 >= TRACK.durationSec) {
            AsyncStorage.getItem('cs_user_id').then((v) => {
              logEvent('success_event', { action: 'breathe_completed' }, v ? Number(v) : undefined);
            });
            return 0;
          }
          return e + 1;
        });
      }, 1000);
    } else {
      clearInterval(timer.current);
    }
    return () => clearInterval(timer.current);
  }, [playing]);

  const progressPct = Math.min((elapsed / TRACK.durationSec) * 100, 100);
  const remaining = TRACK.durationSec - elapsed;

  return (
    <LinearGradient colors={['#fdf2f8', '#fff7ed', '#fef3c7']} style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Text style={styles.iconText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Breathing meditation</Text>
          <TouchableOpacity style={styles.iconBtn}>
            <Text style={styles.iconTextSm}>🔔</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.glowWrap}>
          <View style={[styles.ring, styles.ringOuter]} />
          <View style={[styles.ring, styles.ringMid]} />
          <View style={styles.figureWrap}>
            <Text style={styles.figureEmoji}>🧘‍♀️</Text>
          </View>
        </View>

        <View style={styles.player}>
          <View style={styles.trackRow}>
            <View style={styles.thumb}>
              <Text style={styles.thumbEmoji}>🏔️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trackTitle}>{TRACK.title}</Text>
              <Text style={styles.trackArtist}>{TRACK.artist}</Text>
            </View>
            <TouchableOpacity onPress={() => setLiked(v => !v)}>
              <Text style={styles.heart}>{liked ? '♥' : '♡'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.seekRow}>
            <View style={styles.track}>
              <View style={[styles.trackFill, { width: `${progressPct}%` }]} />
            </View>
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(elapsed)}</Text>
            <Text style={styles.timeText}>-{formatTime(remaining)}</Text>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlBtn}>
              <Text style={styles.controlIcon}>⏮</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.playBtn} onPress={() => setPlaying(v => !v)}>
              <Text style={styles.playIcon}>{playing ? '❚❚' : '▶'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn}>
              <Text style={styles.controlIcon}>⏭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 16 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  iconText: { fontSize: 22, color: '#1e293b', marginTop: -2 },
  iconTextSm: { fontSize: 15 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },

  glowWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderRadius: 999 },
  ringOuter: { width: 320, height: 320, backgroundColor: 'rgba(251,191,36,0.12)' },
  ringMid: { width: 220, height: 220, backgroundColor: 'rgba(251,191,36,0.18)' },
  figureWrap: { alignItems: 'center', justifyContent: 'center' },
  figureEmoji: { fontSize: 96 },

  player: {
    backgroundColor: 'rgba(30,27,50,0.85)', borderRadius: 28, padding: 18, marginBottom: 12,
  },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  thumb: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 18 },
  trackTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  trackArtist: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  heart: { color: '#fff', fontSize: 20 },

  seekRow: { marginBottom: 4 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  trackFill: { height: 4, borderRadius: 2, backgroundColor: '#fff' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  timeText: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
  controlBtn: { padding: 8 },
  controlIcon: { fontSize: 18, color: '#fff' },
  playBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  playIcon: { fontSize: 18, color: '#1e293b' },
});
