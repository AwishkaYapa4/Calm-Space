import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { getGreeting, DASHBOARD_PALETTE } from '../lib/theme';

export default function PageHeader({ profile, onBellPress }) {
  const name = profile?.name || 'there';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <View style={styles.row}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View>
          <Text style={styles.greeting}>{getGreeting()}! 👋</Text>
          <Text style={styles.name}>{name}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.bell} onPress={onBellPress} activeOpacity={0.7}>
        <Text style={styles.bellIcon}>🔔</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#fdece7',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: DASHBOARD_PALETTE.accentRose },
  greeting: { fontSize: 13, color: DASHBOARD_PALETTE.textMuted },
  name: { fontSize: 16, fontWeight: '700', color: DASHBOARD_PALETTE.textPrimary, marginTop: 1 },
  bell: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: DASHBOARD_PALETTE.cardBg,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: DASHBOARD_PALETTE.cardShadow, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  bellIcon: { fontSize: 16 },
});
