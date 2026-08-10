/**
 * Digital Coping Style Classifier
 * Classifies user into one of 5 behavioral archetypes based on onboarding answers.
 * Used to personalize intervention type, not stress prediction.
 */

export const COPING_STYLES = {
  SOCIAL_ESCAPER: {
    id: 'social_escaper',
    label: 'Social Escaper',
    emoji: '📱',
    description: 'You tend to open social media when stress builds up.',
    interventions: ['reduce_scrolling', 'replace_with_breath', 'set_app_timer'],
    color: '#f59e0b',
  },
  ENTERTAINMENT_SEEKER: {
    id: 'entertainment_seeker',
    label: 'Entertainment Seeker',
    emoji: '🎬',
    description: 'You reach for videos or games to decompress.',
    interventions: ['suggest_short_break', 'mindful_viewing', 'screen_time_nudge'],
    color: '#f97316',
  },
  COMMUNICATOR: {
    id: 'communicator',
    label: 'Communicator',
    emoji: '💬',
    description: 'Talking to others is your natural stress outlet.',
    interventions: ['suggest_reach_friend', 'journaling', 'voice_note'],
    color: '#10b981',
  },
  AVOIDER: {
    id: 'avoider',
    label: 'Avoider',
    emoji: '🚶',
    description: 'You prefer to step away from the phone when overwhelmed.',
    interventions: ['minimal_nudge', 'walking_prompt', 'silent_mode'],
    color: '#6366f1',
  },
  PRODUCTIVITY_COPER: {
    id: 'productivity_coper',
    label: 'Productivity Coper',
    emoji: '📚',
    description: 'Stress pushes you to work or study harder.',
    interventions: ['suggest_short_break', 'pomodoro_reminder', 'rest_nudge'],
    color: '#8b5cf6',
  },
};

/**
 * Score each archetype based on onboarding selections.
 * Returns the best-matched style and a confidence breakdown.
 */
export function classifyCopingStyle(profile) {
  const scores = {
    social_escaper: 0,
    entertainment_seeker: 0,
    communicator: 0,
    avoider: 0,
    productivity_coper: 0,
  };

  const behaviors = profile.stress_behaviors || [];
  const apps = profile.stress_apps || [];
  const phoneMore = profile.phone_more_when_stressed || '';
  const relaxers = profile.relaxers || [];

  // Stress behavior signals
  if (behaviors.includes('Scroll social media')) scores.social_escaper += 3;
  if (behaviors.includes('Watch YouTube')) scores.entertainment_seeker += 3;
  if (behaviors.includes('Play games')) scores.entertainment_seeker += 2;
  if (behaviors.includes('Talk with friends')) scores.communicator += 3;
  if (behaviors.includes('Listen to music')) scores.entertainment_seeker += 1;
  if (behaviors.includes('Exercise')) scores.avoider += 2;
  if (behaviors.includes('Sleep')) scores.avoider += 2;
  if (behaviors.includes('Study/Work harder')) scores.productivity_coper += 3;
  if (behaviors.includes('Eat snacks')) scores.avoider += 1;

  // App usage signals
  if (apps.includes('Instagram') || apps.includes('TikTok') || apps.includes('Facebook')) {
    scores.social_escaper += 2;
  }
  if (apps.includes('YouTube') || apps.includes('Netflix') || apps.includes('Gaming Apps')) {
    scores.entertainment_seeker += 2;
  }
  if (apps.includes('WhatsApp')) scores.communicator += 2;

  // Phone usage pattern
  if (phoneMore === 'Often' || phoneMore === 'Always') {
    scores.social_escaper += 1;
    scores.entertainment_seeker += 1;
  }
  if (phoneMore === 'Never' || phoneMore === 'Rarely') {
    scores.avoider += 2;
  }

  // Relaxation signals
  if (relaxers.includes('Deep breathing') || relaxers.includes('Meditation')) {
    scores.avoider += 1;
  }
  if (relaxers.includes('Talking to someone')) scores.communicator += 2;
  if (relaxers.includes('Exercise') || relaxers.includes('Walking')) scores.avoider += 2;
  if (relaxers.includes('Taking breaks')) scores.productivity_coper += 1;

  // Find winner
  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const styleKey = Object.keys(COPING_STYLES).find(
    k => COPING_STYLES[k].id === winner
  );

  const total = Object.values(scores).reduce((s, v) => s + v, 0) || 1;
  const confidence = Math.round((scores[winner] / total) * 100);

  return {
    style: COPING_STYLES[styleKey],
    scores,
    confidence,
  };
}
