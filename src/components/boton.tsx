import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

type Variante = 'primario' | 'secundario' | 'texto' | 'peligro';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  titulo: string;
  variante?: Variante;
  cargando?: boolean;
};

export function Boton({ titulo, variante = 'primario', cargando, disabled, ...rest }: Props) {
  const inactivo = !!disabled || !!cargando;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo, busy: !!cargando }}
      disabled={inactivo}
      style={({ pressed }) => [
        styles.base,
        contenedor[variante],
        pressed && styles.presionado,
        inactivo && styles.inactivo,
      ]}
      {...rest}>
      {cargando ? (
        <ActivityIndicator color={variante === 'primario' ? Colors.onPrimary : Colors.primaryDark} />
      ) : (
        <Text style={[styles.texto, texto[variante]]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: Radius,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { fontSize: 16, fontWeight: '600' },
  presionado: { opacity: 0.8 },
  inactivo: { opacity: 0.5 },
});

const contenedor = StyleSheet.create({
  primario: { backgroundColor: Colors.primary },
  secundario: { borderWidth: 1, borderColor: Colors.primaryDark, backgroundColor: Colors.background },
  texto: {},
  peligro: { borderWidth: 1, borderColor: Colors.danger, backgroundColor: Colors.background },
});

const texto = StyleSheet.create({
  primario: { color: Colors.onPrimary },
  secundario: { color: Colors.primaryDark },
  texto: { color: Colors.primaryDark },
  peligro: { color: Colors.danger },
});
