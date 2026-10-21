import { StyleSheet, Text } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

type Props = { tipo?: 'error' | 'exito'; texto?: string | null };

export function Mensaje({ tipo = 'error', texto }: Props) {
  if (!texto) return null;
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[styles.base, tipo === 'error' ? styles.error : styles.exito]}>
      {texto}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { padding: 12, borderRadius: Radius, marginBottom: Spacing.md, fontSize: 14 },
  error: { color: Colors.danger, backgroundColor: Colors.dangerBg },
  exito: { color: Colors.success, backgroundColor: Colors.successBg },
});
