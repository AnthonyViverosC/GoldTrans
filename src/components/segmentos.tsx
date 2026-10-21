import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Sombra, Spacing } from '@/constants/theme';

type Props<T extends string> = {
  opciones: readonly { valor: T; texto: string }[];
  valor: T;
  onCambio: (valor: T) => void;
};

/** Control segmentado para cambiar entre vistas de una misma pestaña. */
export function Segmentos<T extends string>({ opciones, valor, onCambio }: Props<T>) {
  return (
    <View style={styles.contenedor} accessibilityRole="tablist">
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
            onPress={() => onCambio(o.valor)}
            style={[styles.segmento, activo && styles.activo]}>
            <Text style={[styles.texto, activo && styles.textoActivo]} numberOfLines={1}>
              {o.texto}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: Spacing.md,
    borderRadius: Radius,
    backgroundColor: Colors.surface,
  },
  segmento: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Radius - 3, paddingHorizontal: Spacing.sm },
  activo: { backgroundColor: Colors.background, ...Sombra },
  texto: { fontSize: 14, fontWeight: '600', color: Colors.muted },
  textoActivo: { color: Colors.primary, fontWeight: '700' },
});
