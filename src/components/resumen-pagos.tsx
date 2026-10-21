import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatearPesos } from '@/lib/cotizador';
import type { ResumenPagos } from '@/lib/reservas';

function Fila({ texto, valor, fuerte }: { texto: string; valor: number; fuerte?: boolean }) {
  return (
    <View style={styles.fila}>
      <Text style={[styles.texto, fuerte && styles.fuerte]}>{texto}</Text>
      <Text style={[styles.valor, fuerte && styles.fuerte]}>{formatearPesos(valor)}</Text>
    </View>
  );
}

/** HU-25 · Total, abonado, en revisión y saldo pendiente de una reserva. */
export function ResumenPagosVista({ resumen }: { resumen: ResumenPagos }) {
  return (
    <View style={styles.caja}>
      <Fila texto="Valor total" valor={resumen.total} />
      <Fila texto="Abonos aprobados" valor={resumen.abonado} />
      {resumen.enRevision > 0 ? <Fila texto="En revisión" valor={resumen.enRevision} /> : null}
      <View style={styles.linea} />
      <Fila texto="Saldo pendiente" valor={resumen.saldo} fuerte />
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { padding: Spacing.md, borderRadius: Radius, backgroundColor: Colors.surface, gap: Spacing.xs },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  texto: { fontSize: 15, color: Colors.text },
  valor: { fontSize: 15, color: Colors.text },
  fuerte: { fontWeight: '700', color: Colors.primaryDark, fontSize: 16 },
  linea: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
});
