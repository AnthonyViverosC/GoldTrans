import { StyleSheet, Text } from 'react-native';

import { Colors } from '@/constants/theme';
import {
  ETIQUETA_ESTADO_ABONO,
  ETIQUETA_ESTADO_RESERVA,
  type EstadoAbono,
  type EstadoReserva,
} from '@/lib/reservas';

const COLOR_RESERVA: Record<EstadoReserva, string> = {
  prerreserva: Colors.primaryDark,
  confirmada: Colors.success,
  pagada: Colors.success,
  vencida: Colors.muted,
  cancelada: Colors.danger,
};

const COLOR_ABONO: Record<EstadoAbono, string> = {
  pendiente: Colors.primaryDark,
  aprobado: Colors.success,
  rechazado: Colors.danger,
};

export function EstadoReservaTexto({ estado }: { estado: EstadoReserva }) {
  return <Text style={[styles.estado, { color: COLOR_RESERVA[estado] }]}>{ETIQUETA_ESTADO_RESERVA[estado]}</Text>;
}

export function EstadoAbonoTexto({ estado }: { estado: string }) {
  const e = estado as EstadoAbono;
  return (
    <Text style={[styles.estado, { color: COLOR_ABONO[e] ?? Colors.muted }]}>{ETIQUETA_ESTADO_ABONO[e] ?? estado}</Text>
  );
}

const styles = StyleSheet.create({
  estado: { fontSize: 13, fontWeight: '700' },
});
