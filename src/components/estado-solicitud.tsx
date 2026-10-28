import { Insignia, type Tono } from '@/components/insignia';
import { ETIQUETA_ESTADO_SOLICITUD, type EstadoSolicitud } from '@/lib/solicitudes';

const TONO: Record<EstadoSolicitud, Tono> = {
  pendiente: 'advertencia',
  confirmada: 'exito',
  ajustada: 'info',
  rechazada: 'peligro',
  cancelada: 'neutro',
};

export function EstadoSolicitudTexto({ estado }: { estado: string }) {
  const e = estado as EstadoSolicitud;
  return <Insignia texto={ETIQUETA_ESTADO_SOLICITUD[e] ?? estado} tono={TONO[e] ?? 'neutro'} />;
}
