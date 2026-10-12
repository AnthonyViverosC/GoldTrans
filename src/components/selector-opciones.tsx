import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

type Props<T extends string> = {
  etiqueta?: string;
  opciones: readonly { valor: T; texto: string }[];
  valor: T;
  onCambio: (valor: T) => void;
  deshabilitado?: boolean;
};

/** Grupo de botones de selección única (tipo de persona, rol, estado...). */
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
              style={[styles.opcion, activo && styles.opcionActiva, deshabilitado && styles.inactivo]}>
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
  etiqueta: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: Spacing.xs },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  opcion: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  opcionActiva: { borderColor: Colors.primaryDark, backgroundColor: Colors.surface },
  texto: { color: Colors.muted, fontSize: 14 },
  textoActivo: { color: Colors.primaryDark, fontWeight: '700' },
  inactivo: { opacity: 0.5 },
});
