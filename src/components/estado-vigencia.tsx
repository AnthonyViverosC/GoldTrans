import { Insignia, colorTono, type Tono } from '@/components/insignia';
import { ETIQUETA_ITEM, ETIQUETA_VIGENCIA, type EstadoItem, type EstadoVigencia } from '@/lib/licitaciones';

const TONO_VIGENCIA: Record<EstadoVigencia, Tono> = {
  vigente: 'exito',
  por_vencer: 'advertencia',
  vencido: 'peligro',
  sin_vigencia: 'neutro',
};

export const COLOR_VIGENCIA = Object.fromEntries(
  Object.entries(TONO_VIGENCIA).map(([e, t]) => [e, colorTono(t)]),
) as Record<EstadoVigencia, string>;

const TONO_ITEM: Record<EstadoItem, Tono> = {
  cumple: 'exito',
  vence_antes_cierre: 'advertencia',
  vencido: 'peligro',
  pendiente: 'neutro',
};

export function EstadoVigenciaTexto({ estado }: { estado: EstadoVigencia }) {
  return <Insignia texto={ETIQUETA_VIGENCIA[estado]} tono={TONO_VIGENCIA[estado]} />;
}

export function EstadoItemTexto({ estado }: { estado: EstadoItem }) {
  return <Insignia texto={ETIQUETA_ITEM[estado]} tono={TONO_ITEM[estado]} />;
}
