import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type Props<T extends string> = {
  etiqueta?: string;
  opciones: readonly { valor: T; texto: string }[];
  valor: T;
  onCambio: (valor: T) => void;
  deshabilitado?: boolean;
};

/** Grupo de chips de selección única (tipo de persona, rol, estado...). */
export function SelectorOpciones<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
  deshabilitado,
}: Props<T>) {
  return (
    <View style={styles.contenedor}>
      {etiqueta ? <Text style={styles.etiqueta}>{etiqueta}</Text> : null}
      <View style={styles.fila} accessibilityRole="radiogroup">
        {opciones.map((o) => {
          const activo = o.valor === valor;
          return (
            <Pressable
              key={o.valor}
              accessibilityRole="radio"
              accessibilityState={{ checked: activo, disabled: deshabilitado }}
              disabled={deshabilitado}
              onPress={() => onCambio(o.valor)}
              style={({ pressed }) => [
                styles.opcion,
                activo && styles.opcionActiva,
                pressed && !activo && styles.presionada,
                deshabilitado && styles.inactivo,
              ]}>
              {activo ? <Ionicons name="checkmark" size={16} color={Colors.onPrimary} /> : null}
              <Text style={[styles.texto, activo && styles.textoActivo]}>{o.texto}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginBottom: Spacing.md },
  etiqueta: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  opcion: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  opcionActiva: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  presionada: { backgroundColor: Colors.surface },
  texto: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  textoActivo: { color: Colors.onPrimary, fontWeight: '700' },
  inactivo: { opacity: 0.5 },
});
