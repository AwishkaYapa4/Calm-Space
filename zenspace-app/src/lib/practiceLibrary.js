// Practice catalog + per-coping-style ordering — same rule-based personalization
// pattern as insightEngine.js/copingClassifier.js, driven by the coping style
// derived from onboarding answers rather than a fixed list for every user.
export const PRACTICE_CATALOG = {
  breathing: { id: 'breathing', title: 'Mindful Breath', kind: 'Article', duration: '4 min', emoji: '🧘‍♀️', route: '/practice/breathing' },
  bodyscan:  { id: 'bodyscan',  title: 'Body Scan Relaxation', kind: 'Audio', duration: '6 min', emoji: '🌿', route: null },
  walk:      { id: 'walk',      title: 'Mindful Walk Reset', kind: 'Guide', duration: '10 min', emoji: '🚶', route: null },
  journal:   { id: 'journal',   title: 'Stress Journal Prompt', kind: 'Journal', duration: '5 min', emoji: '📝', route: null },
  focus:     { id: 'focus',     title: 'Pomodoro Focus Reset', kind: 'Timer', duration: '25 min', emoji: '⏱️', route: null },
  music:     { id: 'music',     title: 'Calm Playlist', kind: 'Audio', duration: '15 min', emoji: '🎵', route: null },
  connect:   { id: 'connect',   title: 'Reach Out Prompt', kind: 'Guide', duration: '3 min', emoji: '💬', route: null },
};

const ORDER_BY_COPING_STYLE = {
  social_escaper:       ['breathing', 'walk', 'journal', 'music'],
  entertainment_seeker: ['breathing', 'bodyscan', 'walk', 'music'],
  communicator:         ['connect', 'breathing', 'journal', 'music'],
  avoider:              ['walk', 'breathing', 'bodyscan', 'journal'],
  productivity_coper:   ['focus', 'breathing', 'walk', 'bodyscan'],
};

const DEFAULT_ORDER = ['breathing', 'walk', 'journal', 'music'];

export function getPersonalizedPractices(copingStyleId) {
  const order = ORDER_BY_COPING_STYLE[copingStyleId] || DEFAULT_ORDER;
  return order.map((id) => PRACTICE_CATALOG[id]);
}
