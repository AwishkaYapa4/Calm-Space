import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, SafeAreaView, Animated, AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { classifyCopingStyle } from '../src/lib/copingClassifier';
import { registerUser } from '../src/lib/api';
import {
  hasNativeCaptureSupport, checkPermissions,
  openUsageAccessSettings, openNotificationAccessSettings, startCapture,
} from '../src/lib/db/captureService';

// ── Reusable sub-components ──────────────────────────────────────────────────

function OptionChip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={[styles.chip, selected && styles.chipSelected]}
      activeOpacity={0.75}
    >
      {selected && <Text style={styles.chipCheck}>✓ </Text>}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function RadioRow({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={[styles.radioRow, selected && styles.radioRowSelected]}
      activeOpacity={0.8}
    >
      <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <Text style={[styles.radioText, selected && styles.radioTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SliderRow({ value, onChange, min = 1, max = 10 }) {
  const steps = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  return (
    <View style={styles.sliderWrap}>
      <View style={styles.sliderTrack}>
        {steps.map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => { Haptics.selectionAsync(); onChange(n); }}
            style={[styles.sliderStep, value === n && styles.sliderStepActive]}
          >
            <Text style={[styles.sliderNum, value === n && styles.sliderNumActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabel}>Low</Text>
        <Text style={styles.sliderLabel}>High</Text>
      </View>
    </View>
  );
}

function SectionLabel({ text }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function PermissionRow({ label, description, granted, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={granted}
      style={[styles.radioRow, granted && styles.radioRowSelected, { alignItems: 'flex-start' }]}
      activeOpacity={0.8}
    >
      <View style={[styles.radioCircle, granted && styles.radioCircleSelected]}>
        {granted && <View style={styles.radioDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.radioText, granted && styles.radioTextSelected, { fontWeight: '700' }]}>
          {label}{granted ? ' — Granted' : ''}
        </Text>
        <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Step definitions ─────────────────────────────────────────────────────────

const ROLES = ['Student', 'Employee', 'Freelancer', 'Business Owner', 'Other'];
const INCOME = ['Low', 'Medium', 'High'];
const STRESS_BEHAVIORS = [
  'Scroll social media', 'Watch YouTube', 'Play games', 'Listen to music',
  'Talk with friends', 'Sleep', 'Exercise', 'Study/Work harder', 'Eat snacks', 'Other',
];
const PHONE_MORE = ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'];
const STRESS_APPS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'WhatsApp', 'Gaming Apps', 'Netflix', 'Other'];
const RELAXERS = [
  'Deep breathing', 'Music', 'Exercise', 'Walking', 'Meditation',
  'Talking to someone', 'Taking breaks', 'Watching videos', 'Gaming', 'Other',
];
const REMINDER_TYPES = ['Motivational', 'Friendly', 'Scientific', 'Minimal', 'No reminders'];
const UI_STYLES = ['Light Theme', 'Dark Theme', 'Adaptive Theme'];
const SLEEP_QUALITY = ['Very Poor', 'Poor', 'Average', 'Good', 'Excellent'];
const ACTIVITY_FREQ = ['0 days/week', '1–2 days/week', '3–4 days/week', '5+ days/week'];

const toggle = (arr, val) =>
  arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

// ── Main component ────────────────────────────────────────────────────────────

export default function Onboarding() {
  const router = useRouter();
  const scrollRef = useRef(null);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    // Section 1 — Basic Profile
    name: '',
    age: '',
    gender: '',
    daily_role: '',
    income_level: '',
    // Section 2 — Stress Behavior
    stress_behaviors: [],
    phone_more_when_stressed: '',
    stress_apps: [],
    // Section 3 — Wellness & Coping
    relaxers: [],
    reminder_type: [],
    ui_style: '',
    // Section 4 — Optional Research
    typical_stress_level: 5,
    sleep_quality: '',
    activity_frequency: '',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const tog = (k, v) => setForm(p => ({ ...p, [k]: toggle(p[k], v) }));

  const [perms, setPerms] = useState({ usageAccess: false, notificationAccess: false });
  const refreshPerms = useCallback(async () => {
    const result = await checkPermissions();
    setPerms(result);
  }, []);
  useEffect(() => {
    refreshPerms();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPerms();
    });
    return () => sub.remove();
  }, [refreshPerms]);

  // ── Step content ─────────────────────────────────────────────────────────

  const STEPS = [
    // Step 0 — Welcome + name/age
    {
      title: 'Welcome to CalmSense 🌿',
      subtitle: "We'll personalize your calm experience in 5 quick steps.",
      badge: 'Basic Profile',
      valid: form.name.trim().length > 0 && parseInt(form.age) > 0,
      content: (
        <View style={styles.fields}>
          <View>
            <SectionLabel text="Your first name" />
            <TextInput
              style={styles.input}
              placeholder="e.g. Awishka"
              placeholderTextColor="#94a3b8"
              value={form.name}
              onChangeText={v => set('name', v)}
              returnKeyType="next"
            />
          </View>
          <View>
            <SectionLabel text="Age" />
            <TextInput
              style={styles.input}
              placeholder="e.g. 22"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              value={form.age}
              onChangeText={v => set('age', v)}
            />
          </View>
          <View>
            <SectionLabel text="Gender" />
            <View style={styles.chipWrap}>
              {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map(g => (
                <OptionChip key={g} label={g} selected={form.gender === g} onPress={() => set('gender', g)} />
              ))}
            </View>
          </View>
        </View>
      ),
    },

    // Step 1 — Role & Income
    {
      title: 'Your Daily Life',
      subtitle: 'These anchor the AI model to your lifestyle context.',
      badge: 'Basic Profile',
      valid: form.daily_role.length > 0 && form.income_level.length > 0,
      content: (
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          <SectionLabel text="Current role" />
          {ROLES.map(r => (
            <RadioRow key={r} label={r} selected={form.daily_role === r} onPress={() => set('daily_role', r)} />
          ))}
          <SectionLabel text="Income level" style={{ marginTop: 20 }} />
          {INCOME.map(i => (
            <RadioRow key={i} label={i} selected={form.income_level === i} onPress={() => set('income_level', i)} />
          ))}
        </ScrollView>
      ),
    },

    // Step 2 — Stress Behavior Profile
    {
      title: 'When You Feel Stressed…',
      subtitle: 'This is the core of personalization. Be honest — nothing is judged.',
      badge: 'Stress Behavior',
      valid: form.stress_behaviors.length > 0 && form.phone_more_when_stressed.length > 0,
      content: (
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          <SectionLabel text="What do you usually do? (select all that apply)" />
          <View style={styles.chipWrap}>
            {STRESS_BEHAVIORS.map(b => (
              <OptionChip key={b} label={b} selected={form.stress_behaviors.includes(b)} onPress={() => tog('stress_behaviors', b)} />
            ))}
          </View>

          <SectionLabel text="Do you use your phone more when stressed?" />
          {PHONE_MORE.map(p => (
            <RadioRow key={p} label={p} selected={form.phone_more_when_stressed === p} onPress={() => set('phone_more_when_stressed', p)} />
          ))}

          <SectionLabel text="Which apps do you use most when stressed? (select all)" />
          <View style={styles.chipWrap}>
            {STRESS_APPS.map(a => (
              <OptionChip key={a} label={a} selected={form.stress_apps.includes(a)} onPress={() => tog('stress_apps', a)} />
            ))}
          </View>
        </ScrollView>
      ),
    },

    // Step 3 — Wellness & Coping
    {
      title: 'What Helps You Recover?',
      subtitle: 'CalmSense will match its suggestions to what actually works for you.',
      badge: 'Wellness Profile',
      valid: form.relaxers.length > 0 && form.ui_style.length > 0,
      content: (
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          <SectionLabel text="What usually helps you relax? (select all)" />
          <View style={styles.chipWrap}>
            {RELAXERS.map(r => (
              <OptionChip key={r} label={r} selected={form.relaxers.includes(r)} onPress={() => tog('relaxers', r)} />
            ))}
          </View>

          <SectionLabel text="Which type of reminders do you prefer?" />
          <View style={styles.chipWrap}>
            {REMINDER_TYPES.map(t => (
              <OptionChip key={t} label={t} selected={form.reminder_type.includes(t)} onPress={() => tog('reminder_type', t)} />
            ))}
          </View>

          <SectionLabel text="Preferred UI style" />
          {UI_STYLES.map(s => (
            <RadioRow key={s} label={s} selected={form.ui_style === s} onPress={() => set('ui_style', s)} />
          ))}
        </ScrollView>
      ),
    },

    // Step 4 — Optional Research + result preview
    {
      title: 'A Few Last Questions',
      subtitle: 'Optional — but valuable for the research. You can skip any of these.',
      badge: 'Research Data',
      valid: true,
      content: (
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          <SectionLabel text="How stressed do you feel in a typical week?" />
          <SliderRow value={form.typical_stress_level} onChange={v => set('typical_stress_level', v)} />

          <SectionLabel text="Sleep quality" />
          {SLEEP_QUALITY.map(q => (
            <RadioRow key={q} label={q} selected={form.sleep_quality === q} onPress={() => set('sleep_quality', q)} />
          ))}

          <SectionLabel text="Physical activity frequency" />
          {ACTIVITY_FREQ.map(a => (
            <RadioRow key={a} label={a} selected={form.activity_frequency === a} onPress={() => set('activity_frequency', a)} />
          ))}
        </ScrollView>
      ),
    },

    // Step 5 — Passive data permissions
    {
      title: 'Turn On Background Insights',
      subtitle: hasNativeCaptureSupport()
        ? 'CalmSense reads app-usage timing and screen unlocks in the background to personalize your stress predictions. We never read message content or notification text — only which app and when.'
        : 'Passive data capture needs a custom CalmSense build (not Expo Go). You can skip this and use the app with manual check-ins for now.',
      badge: 'Permissions',
      valid: true,
      content: (
        <View style={{ gap: 8 }}>
          <PermissionRow
            label="Usage Access"
            description="Lets CalmSense see which app is in the foreground and for how long — no screen content is read."
            granted={perms.usageAccess}
            onPress={openUsageAccessSettings}
          />
          <PermissionRow
            label="Notification Access"
            description="Lets CalmSense count how many notifications arrive — never their text or sender."
            granted={perms.notificationAccess}
            onPress={openNotificationAccessSettings}
          />
          <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
            You'll be taken to Android Settings to flip these on, then return here — CalmSense rechecks automatically.
          </Text>
        </View>
      ),
    },
  ];

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const totalSteps = STEPS.length;

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isLast) {
      const { style, scores, confidence } = classifyCopingStyle(form);
      const profile = {
        ...form,
        coping_style: style.id,
        coping_style_label: style.label,
        coping_confidence: confidence,
        coping_scores: scores,
        local_threshold: 5.5,
      };
      await AsyncStorage.setItem('zs_profile', JSON.stringify(profile));
      await AsyncStorage.setItem('zs_coping_style', JSON.stringify(style));

      const result = await registerUser(profile);
      if (result?.id) await AsyncStorage.setItem('cs_user_id', String(result.id));

      startCapture();
      router.replace('/(tabs)');
    } else {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setStep(s => s + 1);
    }
  };

  const handleBack = () => {
    Haptics.selectionAsync();
    setStep(s => s - 1);
  };

  const progress = (step + 1) / totalSteps;

  return (
    <LinearGradient colors={['#ede9fe', '#f0f9ff', '#f0fdf4']} style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          {/* Step counter + badge */}
          <View style={styles.stepMeta}>
            <Text style={styles.stepCount}>{step + 1} / {totalSteps}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{current.badge}</Text>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              <Text style={styles.title}>{current.title}</Text>
              <Text style={styles.subtitle}>{current.subtitle}</Text>
              <View style={styles.contentWrap}>{current.content}</View>

              {/* Navigation */}
              <View style={styles.navRow}>
                {step > 0 && (
                  <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                    <Text style={styles.backText}>← Back</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleNext}
                  disabled={!current.valid}
                  style={[styles.nextBtn, !current.valid && styles.nextBtnDisabled, step === 0 && styles.nextBtnFull]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.nextText, !current.valid && styles.nextTextDisabled]}>
                    {isLast ? 'Finish & Open CalmSense ✓' : 'Continue →'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safe: { flex: 1 },
  kav: { flex: 1 },
  progressTrack: { height: 3, backgroundColor: '#e2e8f0', marginHorizontal: 20, marginTop: 8, borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: '#7c3aed', borderRadius: 2 },
  stepMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 },
  stepCount: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  badge: { backgroundColor: '#ede9fe', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, color: '#7c3aed', fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 28, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 20, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1e293b', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#64748b', lineHeight: 21, marginBottom: 22 },
  contentWrap: { minHeight: 160 },

  // Fields
  fields: { gap: 18 },
  sectionLabel: { fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, color: '#1e293b',
  },

  // Chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#f8fafc',
  },
  chipSelected: { borderColor: '#7c3aed', backgroundColor: '#ede9fe' },
  chipCheck: { fontSize: 11, color: '#7c3aed' },
  chipText: { fontSize: 13, color: '#64748b' },
  chipTextSelected: { color: '#7c3aed', fontWeight: '600' },

  // Radio
  radioRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, backgroundColor: '#f8fafc',
  },
  radioRowSelected: { borderColor: '#7c3aed', backgroundColor: '#faf5ff' },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  radioCircleSelected: { borderColor: '#7c3aed' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#7c3aed' },
  radioText: { fontSize: 14, color: '#475569' },
  radioTextSelected: { color: '#7c3aed', fontWeight: '600' },

  // Slider
  sliderWrap: { marginVertical: 8 },
  sliderTrack: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderStep: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
    marginHorizontal: 2, backgroundColor: '#f8fafc',
  },
  sliderStepActive: { borderColor: '#7c3aed', backgroundColor: '#7c3aed' },
  sliderNum: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  sliderNumActive: { color: '#fff' },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  sliderLabel: { fontSize: 11, color: '#94a3b8' },

  // Navigation
  navRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  backBtn: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center',
  },
  backText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  nextBtn: {
    flex: 1, backgroundColor: '#7c3aed', borderRadius: 16,
    paddingVertical: 15, alignItems: 'center',
  },
  nextBtnFull: { flex: 1 },
  nextBtnDisabled: { backgroundColor: '#e2e8f0' },
  nextText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  nextTextDisabled: { color: '#94a3b8' },
});
