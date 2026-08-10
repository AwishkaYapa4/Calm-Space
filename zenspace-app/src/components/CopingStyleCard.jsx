import { View, Text, StyleSheet } from 'react-native';

export default function CopingStyleCard({ style }) {
  if (!style) return null;

  return (
    <View style={[styles.card, { borderColor: style.color + '55' }]}>
      <View style={[styles.iconWrap, { backgroundColor: style.color + '22' }]}>
        <Text style={styles.emoji}>{style.emoji}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>Your Coping Style</Text>
        <Text style={[styles.styleName, { color: style.color }]}>{style.label}</Text>
        <Text style={styles.desc}>{style.description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: 14, alignItems: 'flex-start',
    backgroundColor: '#fff', borderRadius: 20, padding: 16,
    borderWidth: 1.5,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emoji: { fontSize: 24 },
  text: { flex: 1 },
  label: { fontSize: 11, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  styleName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  desc: { fontSize: 13, color: '#64748b', lineHeight: 19 },
});
