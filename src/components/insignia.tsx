import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

export type Tono = 'exito' | 'advertencia' | 'peligro' | 'info' | 'neutro';

const TONOS: Record<Tono, { color: string; fondo: string }> = {
  exito: { color: Colors.success, fondo: Colors.successBg },
  advertencia: { color: Colors.warning, fondo: Colors.warningBg },
  peligro: { color: Colors.danger, fondo: Colors.dangerBg },
  info: { color: Colors.primary, fondo: Colors.surface },
  neutro: { color: Colors.muted, fondo: Colors.page },
};

/** Etiqueta de estado en forma de píldora (Pendiente, Confirmada, Vencido...). */
export function Insignia({ texto, tono = 'neutro' }: { texto: string; tono?: Tono }) {
  const t = TONOS[tono];
  return (
    <View style={[styles.pildora, { backgroundColor: t.fondo }]}>
      <View style={[styles.punto, { backgroundColor: t.color }]} />
      <Text style={[styles.texto, { color: t.color }]}>{texto}</Text>
    </View>
  );
}

/** Color de texto del tono, para cifras o detalles que acompañan una insignia. */
export const colorTono = (tono: Tono) => TONOS[tono].color;

const styles = StyleSheet.create({
  pildora: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  punto: { width: 6, height: 6, borderRadius: 3 },
  texto: { fontSize: 12, fontWeight: '700' },
});
