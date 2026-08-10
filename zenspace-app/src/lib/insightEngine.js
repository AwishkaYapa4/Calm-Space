/**
 * Insight Engine
 * Generates one personalized AI insight per session based on coping style + telemetry.
 * Each insight explains a behavioural pattern rather than issuing a command.
 */

const INSIGHTS = {
  social_escaper: [
    (t) => t.social_media_mins > 60 && {
      icon: '💡',
      text: `You've spent ${Math.round(t.social_media_mins / 60 * 10) / 10}h on social media today — usually 40% more than your calm-day average.`,
    },
    (t) => t.phone_unlocks > 120 && {
      icon: '📱',
      text: `${t.phone_unlocks} phone checks today. On your high-stress days, unlocks tend to spike before your mood dips.`,
    },
    () => ({
      icon: '💡',
      text: 'You tend to open social media when stress builds up. A 60-second pause before unlocking can break the cycle.',
    }),
  ],
  entertainment_seeker: [
    (t) => t.device_hours_per_day > 6 && {
      icon: '🎬',
      text: `${t.device_hours_per_day}h of screen time today. Video content helps short-term but often extends the stressed feeling.`,
    },
    (t) => t.sleep_hours < 6.5 && {
      icon: '💡',
      text: `Only ${t.sleep_hours}h of sleep last night. Your screen time tends to increase when rest is low.`,
    },
    () => ({
      icon: '💡',
      text: 'You often reach for videos or games when overwhelmed. A 5-minute offline pause often resets things faster.',
    }),
  ],
  communicator: [
    (t) => t.notifications_per_day > 80 && {
      icon: '🔔',
      text: `${t.notifications_per_day} notifications so far. High message volume is often linked to higher stress for you.`,
    },
    (t) => t.sleep_hours < 6 && {
      icon: '💡',
      text: `Sleep was ${t.sleep_hours}h last night. When rest drops, even good conversations can feel draining.`,
    },
    () => ({
      icon: '💡',
      text: 'Talking things through is your strength. On hard days, reaching out to one trusted person works better than many quick messages.',
    }),
  ],
  avoider: [
    (t) => t.phone_unlocks < 80 && {
      icon: '✅',
      text: `Only ${t.phone_unlocks} phone checks today — well below your average. Your natural instinct to step away is working.`,
    },
    (t) => t.device_hours_per_day > 5 && {
      icon: '💡',
      text: `Screen time is at ${t.device_hours_per_day}h today, above your usual pattern. Your body may be signalling a walk.`,
    },
    () => ({
      icon: '💡',
      text: 'You naturally decompress by stepping away. Even a 3-minute walk significantly lowers cortisol levels.',
    }),
  ],
  productivity_coper: [
    (t) => t.study_or_work_mins > 240 && {
      icon: '📚',
      text: `${Math.round(t.study_or_work_mins / 60 * 10) / 10}h of focused work today. Pushing harder under stress is your pattern — but recovery time matters too.`,
    },
    (t) => t.sleep_hours < 6.5 && {
      icon: '💡',
      text: `Sleep was ${t.sleep_hours}h. Sleep deprivation reduces cognitive output by up to 30%, even when effort stays high.`,
    },
    () => ({
      icon: '💡',
      text: 'Stress makes you work harder. That drive is a strength — but a 10-minute break every 90 minutes actually increases your total output.',
    }),
  ],
};

const GENERIC = [
  (t) => t.sleep_hours < 6 && {
    icon: '🌙',
    text: `Only ${t.sleep_hours}h of sleep last night. Research shows stress scores increase by an average of 2 points after poor sleep.`,
  },
  (t) => t.notifications_per_day > 100 && {
    icon: '🔔',
    text: `${t.notifications_per_day} notifications today. High notification volume is one of the strongest predictors of afternoon stress spikes.`,
  },
  () => ({
    icon: '💡',
    text: 'Your digital activity patterns are being used to personalise your experience. The more you use CalmSense, the more accurate it becomes.',
  }),
];

export function generateInsight(telemetry, copingStyleId) {
  if (!telemetry) return null;
  const pool = INSIGHTS[copingStyleId] || GENERIC;

  for (const fn of pool) {
    const result = fn(telemetry);
    if (result) return result;
  }
  return GENERIC[GENERIC.length - 1](telemetry);
}

// Maps coping style to a recommended action
export function getRecommendedAction(copingStyleId, stressBand) {
  const ACTIONS = {
    social_escaper: {
      low:      { emoji: '🌿', text: 'Keep your rhythm — you\'re doing well today', cta: 'Check In' },
      moderate: { emoji: '🌬️', text: 'Take a 30-second breathing break', cta: 'Breathe With Me' },
      high:     { emoji: '📴', text: 'Pause social media for 20 minutes', cta: 'Take a Break' },
    },
    entertainment_seeker: {
      low:      { emoji: '🎵', text: 'A calm playlist to keep the mood going', cta: 'Open Calm Corner' },
      moderate: { emoji: '🌬️', text: 'One slow breath before the next video', cta: 'Breathe First' },
      high:     { emoji: '📴', text: 'Step away from the screen for 5 minutes', cta: 'Go Offline' },
    },
    communicator: {
      low:      { emoji: '☀️', text: 'You seem balanced — great start to the day', cta: 'View Insights' },
      moderate: { emoji: '💬', text: 'Reach out to someone you trust', cta: 'Message a Friend' },
      high:     { emoji: '🌬️', text: 'One slow breath, then talk it through', cta: 'Breathe First' },
    },
    avoider: {
      low:      { emoji: '🌿', text: 'Your calm energy is on point today', cta: 'Check In' },
      moderate: { emoji: '🚶', text: 'A short walk could help right now', cta: 'Step Outside' },
      high:     { emoji: '🚶', text: 'Put the phone down and take a 5-minute walk', cta: 'Take a Walk' },
    },
    productivity_coper: {
      low:      { emoji: '✅', text: 'Great focus energy — keep the momentum', cta: 'View Insights' },
      moderate: { emoji: '⏸️', text: 'Take a 10-minute break to reset your focus', cta: 'Rest & Recharge' },
      high:     { emoji: '🌬️', text: 'Recovery time is part of high performance', cta: 'Breathe With Me' },
    },
  };

  return (
    ACTIONS[copingStyleId]?.[stressBand] ||
    {
      low:      { emoji: '🌿', text: "You're doing well today", cta: 'Check In' },
      moderate: { emoji: '🌬️', text: 'Take a 30-second breathing break', cta: 'Breathe With Me' },
      high:     { emoji: '🚶', text: 'Step away and take a short walk', cta: 'Take a Break' },
    }[stressBand]
  );
}
