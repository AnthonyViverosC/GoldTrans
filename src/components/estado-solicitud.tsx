import { StyleSheet, Text } from 'react-native';

import { Colors } from '@/constants/theme';
import { ETIQUETA_ESTADO_SOLICITUD, type EstadoSolicitud } from '@/lib/solicitudes';

const COLOR: Record<EstadoSolicitud, string> = {
  pendiente: Colors.primaryDark,
  confirmada: Colors.success,
  ajustada: Colors.primaryDark,
  rechazada: Colors.danger,
  cancelada: Colors.muted,
};

export function EstadoSolicitudTexto({ estado }: { estado: string }) {
  const e = estado as EstadoSolicitud;
  return <Text style={[styles.estado, { color: COLOR[e] ?? Colors.muted }]}>{ETIQUETA_ESTADO_SOLICITUD[e] ?? estado}</Text>;
}

const styles = StyleSheet.create({
  estado: { fontSize: 13, fontWeight: '700' },
});
