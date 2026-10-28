import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type Props = {
  marcada: boolean;
  onCambio: (marcada: boolean) => void;
  texto: string;
  error?: string;
  /** Contenido bajo el texto (p. ej. un enlace). */
  children?: ReactNode;
};

export function Casilla({ marcada, onCambio, texto, error, children }: Props) {
  return (
    <View style={styles.contenedor}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: marcada }}
        accessibilityLabel={texto}
        onPress={() => onCambio(!marcada)}
        style={styles.fila}
        hitSlop={4}>
        <View style={[styles.caja, marcada && styles.cajaMarcada, !!error && styles.cajaError]}>
          {marcada ? <Ionicons name="checkmark" size={16} color={Colors.onPrimary} /> : null}
        </View>
        <Text style={styles.texto}>{texto}</Text>
      </Pressable>
      {children ? <View style={styles.extra}>{children}</View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginBottom: Spacing.md },
  fila: { flexDirection: 'row', alignItems: 'flex-start' },
  caja: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 1,
  },
  cajaMarcada: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  cajaError: { borderColor: Colors.danger },
  texto: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.text },
  extra: { marginLeft: 22 + Spacing.sm, marginTop: Spacing.xs },
  error: { color: Colors.danger, fontSize: 13, marginTop: Spacing.xs, marginLeft: 22 + Spacing.sm },
});
