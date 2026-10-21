import { Insignia, type Tono } from '@/components/insignia';
import {
  ETIQUETA_ESTADO_ABONO,
  ETIQUETA_ESTADO_RESERVA,
  type EstadoAbono,
  type EstadoReserva,
} from '@/lib/reservas';

const TONO_RESERVA: Record<EstadoReserva, Tono> = {
  prerreserva: 'advertencia',
  confirmada: 'info',
  pagada: 'exito',
  vencida: 'neutro',
  cancelada: 'peligro',
};

const TONO_ABONO: Record<EstadoAbono, Tono> = {
  pendiente: 'advertencia',
  aprobado: 'exito',
  rechazado: 'peligro',
};

export function EstadoReservaTexto({ estado }: { estado: EstadoReserva }) {
  return <Insignia texto={ETIQUETA_ESTADO_RESERVA[estado]} tono={TONO_RESERVA[estado]} />;
}

export function EstadoAbonoTexto({ estado }: { estado: string }) {
  const e = estado as EstadoAbono;
  return <Insignia texto={ETIQUETA_ESTADO_ABONO[e] ?? estado} tono={TONO_ABONO[e] ?? 'neutro'} />;
}
