// HU-11 a HU-14 · Cotizador instantáneo (cliente de la Edge Function calcular-tarifa).
import { FunctionRegion, FunctionsHttpError } from '@supabase/supabase-js';

import { traducirError, type Resultado } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

import type {
  Jornada,
  LineaDesglose,
  TipoServicio,
} from '../../supabase/functions/_shared/calculo';

export {
  JORNADAS,
  JORNADA_PREDETERMINADA,
  MAX_DIAS,
  TIPOS_SERVICIO,
  diasEntre,
  esFechaValida,
  hoyEnColombia,
  sumarDias,
  type Jornada,
  type LineaDesglose,
  type TipoServicio,
} from '../../supabase/functions/_shared/calculo';

export const ETIQUETA_SERVICIO: Record<TipoServicio, string> = {
  ida: 'Solo ida',
  ida_vuelta: 'Ida y vuelta',
  disponibilidad: 'Por días',
};

export type PeticionCotizacion = {
  ruta_id: string;
  tipo_servicio: TipoServicio;
  fecha_inicio: string;
  fecha_fin?: string | null;
  pasajeros: number;
  jornada_horas: Jornada;
};

/** Respuesta de calcular-tarifa. */
export type Cotizacion = {
  id: string;
  codigo: string;
  created_at: string;
  ruta: { origen: string; destino: string };
  tipo_servicio: TipoServicio;
  fecha_inicio: string;
  fecha_fin: string;
  pasajeros: number;
  vehiculo: { tipo: string; capacidad: number };
  distancia_km: number;
  jornada_horas: Jornada;
  km_incluidos_dia: number;
  valor_km_adicional: number;
  dias: number;
  desglose: LineaDesglose[];
  valor_total: number;
  duracion_ms: number;
};

/** 1250000 → "$ 1.250.000" (sin depender de Intl, que no está completo en todos los motores). */
export function formatearPesos(valor: number): string {
  const signo = valor < 0 ? '-' : '';
  const entero = String(Math.round(Math.abs(valor))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}$ ${entero}`;
}

/** 132.5 → "132,5" */
export function formatearDecimal(valor: number): string {
  return String(valor).replace('.', ',');
}

/**
 * RNF-04 · La función se ejecuta en la región de la base de datos (us-west-2). Sin esto corre en el
 * borde más cercano al usuario (us-east-1 desde Colombia) y cada consulta cruza el continente.
 */
export const REGION_FUNCIONES = FunctionRegion.UsWest2;

/** Línea del desglose tal como la devuelve la función o la tabla detalle_cotizacion. */
export type LineaDesgloseVista = Pick<
  LineaDesglose,
  'descripcion' | 'cantidad' | 'valor_unitario' | 'subtotal'
> & { concepto: string };

function plural(n: number, singular: string, varios: string) {
  return `${formatearDecimal(n)} ${n === 1 ? singular : varios}`;
}

/** HU-14 · Cómo se obtuvo el subtotal de cada línea ("2 días × $ 580.000"). */
export function detalleLinea(l: LineaDesgloseVista): string | null {
  const unitario = formatearPesos(l.valor_unitario);
  switch (l.concepto) {
    case 'jornada':
      return `${plural(l.cantidad, 'día', 'días')} × ${unitario}`;
    case 'km_adicional':
      return l.cantidad === 0
        ? 'No aplica: el recorrido está dentro de los km incluidos'
        : `${formatearDecimal(l.cantidad)} km × ${unitario}`;
    // Cotizaciones anteriores a las tarifas por jornada.
    case 'kilometraje':
      return `${formatearDecimal(l.cantidad)} km × ${unitario}`;
    case 'dias':
      return `${plural(l.cantidad, 'día', 'días')} × ${unitario}`;
    case 'peajes':
      return l.valor_unitario === 0
        ? 'Incluidos: servicio a todo costo'
        : `${plural(l.cantidad, 'trayecto', 'trayectos')} × ${unitario}`;
    case 'recargo':
      return l.cantidad === 0
        ? 'No aplica: el servicio no incluye sábado ni domingo'
        : `${plural(l.cantidad, 'día', 'días')} de fin de semana × ${unitario}`;
    default:
      return null;
  }
}

/** HU-13 · Calcula la cotización en la Edge Function y la deja registrada. */
export async function cotizar(peticion: PeticionCotizacion): Promise<Resultado<Cotizacion>> {
  const { data, error } = await supabase.functions.invoke<Cotizacion>('calcular-tarifa', {
    body: peticion,
    region: REGION_FUNCIONES,
  });
  if (error) {
    // Los errores de negocio (400/404/422) traen un mensaje para el usuario en el cuerpo.
    if (error instanceof FunctionsHttpError) {
      try {
        const cuerpo = (await error.context.json()) as { error?: string };
        if (cuerpo.error) return { ok: false, error: cuerpo.error };
      } catch {
        // Cuerpo no JSON: se usa el mensaje genérico.
      }
      return { ok: false, error: 'No se pudo calcular la cotización. Inténtalo de nuevo' };
    }
    return { ok: false, error: traducirError(error) };
  }
  if (!data) return { ok: false, error: 'No se pudo calcular la cotización. Inténtalo de nuevo' };
  return { ok: true, data };
}

export type CotizacionGuardada = Tables<'cotizaciones'> & {
  detalle: Tables<'detalle_cotizacion'>[];
};

/** Cotización del historial del cliente, con su solicitud formal si ya la tiene (HU-16). */
export type CotizacionHistorial = CotizacionGuardada & {
  solicitud: Pick<Tables<'solicitudes'>, 'id' | 'codigo' | 'estado'> | null;
};

/** Historial del cliente (RLS: solo sus cotizaciones). */
export async function listarMisCotizaciones(
  usuarioId: string,
): Promise<Resultado<CotizacionHistorial[]>> {
  const { data, error } = await supabase
    .from('cotizaciones')
    .select('*, detalle:detalle_cotizacion(*), solicitud:solicitudes(id, codigo, estado)')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return { ok: false, error: traducirError(error) };
  for (const c of data) c.detalle.sort((a, b) => a.orden - b.orden);
  return { ok: true, data };
}
