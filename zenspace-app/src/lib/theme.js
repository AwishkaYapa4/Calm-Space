// Warm-pastel chrome for the dashboard shell (background, cards, nav).
export const DASHBOARD_PALETTE = {
  bgGradient: ['#fdf6ec', '#fbe9e3', '#f7dfe0'],
  cardBg: '#fff',
  cardShadow: '#000',
  textPrimary: '#2d2a26',
  textMuted: '#a89a91',
  accentRose: '#f43f5e',
  accentLilac: '#c4b5fd',
  accentLime: '#bef264',
  accentSky: '#93c5fd',
  pillActive: '#fff',
};

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

