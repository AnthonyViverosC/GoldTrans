import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { detalleLinea, formatearPesos, type LineaDesgloseVista } from '@/lib/cotizador';

type Props = { lineas: readonly LineaDesgloseVista[]; valorTotal: number };

/** HU-14 · Desglose de la cotización: tarifa base, km, días, peajes y recargos. */
export function DesgloseCotizacion({ lineas, valorTotal }: Props) {
  return (
    <View>
      {lineas.map((l) => {
        const texto = detalleLinea(l);
        return (
          <View key={l.concepto} style={styles.fila}>
            <View style={styles.concepto}>
              <Text style={styles.descripcion}>{l.descripcion}</Text>
              {texto ? <Text style={styles.detalle}>{texto}</Text> : null}
            </View>
            <Text style={styles.valor}>{formatearPesos(l.subtotal)}</Text>
          </View>
        );
      })}
      <View style={[styles.fila, styles.filaTotal]}>
        <Text style={styles.total}>Total</Text>
        <Text style={styles.total}>{formatearPesos(valorTotal)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  concepto: { flex: 1 },
  descripcion: { fontSize: 15, color: Colors.text },
  detalle: { fontSize: 13, color: Colors.muted, marginTop: 2 },
  valor: { fontSize: 15, color: Colors.text, fontVariant: ['tabular-nums'] },
  filaTotal: { borderBottomWidth: 0, paddingTop: Spacing.md },
  total: { fontSize: 18, fontWeight: '700', color: Colors.primaryDark, fontVariant: ['tabular-nums'] },
});
