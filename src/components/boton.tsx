import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

type Variante = 'primario' | 'acento' | 'secundario' | 'texto' | 'peligro';
export type NombreIcono = keyof typeof Ionicons.glyphMap;

type Props = Omit<PressableProps, 'children' | 'style'> & {
  titulo: string;
  variante?: Variante;
  cargando?: boolean;
  /** Ícono a la izquierda del título (Ionicons). */
  icono?: NombreIcono;
};

export function Boton({ titulo, variante = 'primario', cargando, disabled, icono, ...rest }: Props) {
  const inactivo = !!disabled || !!cargando;
  const color = COLOR_TEXTO[variante];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo, busy: !!cargando }}
      disabled={inactivo}
      {...rest}
      // Estilo visual en la View interna: en web, <Link asChild> combina su style con el del hijo
      // y un style en forma de función dejaría de aplicarse.
      style={styles.contenedor}>
      {({ pressed }) => (
        <View
          style={[
            styles.base,
            contenedor[variante],
            pressed && (variante === 'texto' ? styles.textoPresionado : styles.presionado),
            inactivo && styles.inactivo,
          ]}>
          {cargando ? (
            <ActivityIndicator color={color} />
          ) : (
            <View style={styles.fila}>
              {icono ? <Ionicons name={icono} size={19} color={color} /> : null}
              <Text style={[styles.texto, { color }]}>{titulo}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const COLOR_TEXTO: Record<Variante, string> = {
  primario: Colors.onPrimary,
  acento: Colors.text,
  secundario: Colors.primary,
  texto: Colors.primary,
  peligro: Colors.danger,
};

const styles = StyleSheet.create({
  contenedor: { alignSelf: 'stretch' },
  base: {
    minHeight: 50,
    borderRadius: Radius,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  texto: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  presionado: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  textoPresionado: { backgroundColor: Colors.surface },
  inactivo: { opacity: 0.5 },
});

const contenedor = StyleSheet.create({
  primario: { backgroundColor: Colors.primary },
  acento: { backgroundColor: Colors.accent },
  secundario: { borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.background },
  texto: {},
  peligro: { borderWidth: 1.5, borderColor: Colors.danger, backgroundColor: Colors.background },
});
