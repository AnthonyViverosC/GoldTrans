import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

type Props = { tipo?: 'error' | 'exito'; texto?: string | null };

export function Mensaje({ tipo = 'error', texto }: Props) {
  if (!texto) return null;
  const error = tipo === 'error';
  const color = error ? Colors.danger : Colors.success;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.base, { backgroundColor: error ? Colors.dangerBg : Colors.successBg, borderLeftColor: color }]}>
      <Ionicons name={error ? 'alert-circle' : 'checkmark-circle'} size={20} color={color} />
      <Text style={[styles.texto, { color }]}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: 12,
    borderRadius: Radius,
    borderLeftWidth: 4,
    marginBottom: Spacing.md,
  },
  texto: { flex: 1, fontSize: 14, lineHeight: 20 },
});
