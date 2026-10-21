// HU-10 · Administrar tarifas por tipo de vehículo y vigencia.
import { traducirError, type Resultado } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  normalizarPesos,
  requerido,
  validarEntero,
  validarFecha,
  validarPesos,
  type Errores,
} from '@/lib/validacion';
import type { TipoVehiculo } from '@/lib/vehiculos';
import type { Tables, TablesInsert } from '@/types/database';

export type Tarifa = Tables<'tarifas'>;

export type FormularioTarifa = {
  tipoVehiculo: TipoVehiculo;
  tarifaBase: string;
  valorKm: string;
  valorDia: string;
  recargoFinSemana: string;
  vigenciaDesde: string;
  /** Vacío = sin fecha de fin. */
  vigenciaHasta: string;
};

export const TARIFA_VACIA: FormularioTarifa = {
  tipoVehiculo: 'van',
  tarifaBase: '',
  valorKm: '',
  valorDia: '',
  recargoFinSemana: '0',
  vigenciaDesde: '',
  vigenciaHasta: '',
};

export const MENSAJE_SUPERPOSICION =
  'Ya hay una tarifa de ese tipo de vehículo con vigencia en esas fechas';

export function tarifaAFormulario(t: Tarifa): FormularioTarifa {
  return {
    tipoVehiculo: t.tipo_vehiculo as TipoVehiculo,
    tarifaBase: String(t.tarifa_base),
    valorKm: String(t.valor_km),
    valorDia: String(t.valor_dia),
    recargoFinSemana: String(t.recargo_fin_semana_pct),
    vigenciaDesde: t.vigencia_desde,
    vigenciaHasta: t.vigencia_hasta ?? '',
  };
}

type Vigencia = { desde: string; hasta: string | null };

/** Rangos cerrados [desde, hasta]; hasta null = sin fin. Fechas AAAA-MM-DD comparables como texto. */
export function vigenciasSeSuperponen(a: Vigencia, b: Vigencia): boolean {
  return (a.hasta === null || b.desde <= a.hasta) && (b.hasta === null || a.desde <= b.hasta);
}

/**
 * Valida el formulario. `existentes` permite avisar de la superposición antes de guardar;
 * la base de datos la impide de todos modos (restricción tarifas_sin_superposicion).
 */
export function validarTarifa(
  f: FormularioTarifa,
  existentes: readonly Tarifa[] = [],
  id?: string,
): Errores<keyof FormularioTarifa> {
  const errores: Errores<keyof FormularioTarifa> = {
    tarifaBase: validarPesos(f.tarifaBase),
    valorKm: validarPesos(f.valorKm),
    valorDia: validarPesos(f.valorDia),
    recargoFinSemana: validarEntero(f.recargoFinSemana, 0, 100, 'Porcentaje entre 0 y 100'),
    vigenciaDesde: requerido(f.vigenciaDesde, 'Indica desde cuándo rige') ?? validarFecha(f.vigenciaDesde),
    vigenciaHasta: validarFecha(f.vigenciaHasta),
  };

  const desde = f.vigenciaDesde.trim();
  const hasta = f.vigenciaHasta.trim() || null;
  if (!errores.vigenciaDesde && !errores.vigenciaHasta) {
    if (hasta !== null && hasta < desde) {
      errores.vigenciaHasta = 'Debe ser igual o posterior a la fecha de inicio';
    } else {
      const choca = existentes.some(
        (t) =>
          t.id !== id &&
          t.tipo_vehiculo === f.tipoVehiculo &&
          vigenciasSeSuperponen({ desde, hasta }, { desde: t.vigencia_desde, hasta: t.vigencia_hasta }),
      );
      if (choca) errores.vigenciaDesde = MENSAJE_SUPERPOSICION;
    }
  }

  for (const k of Object.keys(errores) as (keyof FormularioTarifa)[]) {
    if (!errores[k]) delete errores[k];
  }
  return errores;
}

export function formularioATarifa(f: FormularioTarifa): TablesInsert<'tarifas'> {
  return {
    tipo_vehiculo: f.tipoVehiculo,
    tarifa_base: Number(normalizarPesos(f.tarifaBase)),
    valor_km: Number(normalizarPesos(f.valorKm)),
    valor_dia: Number(normalizarPesos(f.valorDia)),
    recargo_fin_semana_pct: Number(f.recargoFinSemana),
    vigencia_desde: f.vigenciaDesde.trim(),
    vigencia_hasta: f.vigenciaHasta.trim() || null,
  };
}

export type EstadoVigencia = 'vigente' | 'futura' | 'vencida';

export function estadoVigencia(t: Pick<Tarifa, 'vigencia_desde' | 'vigencia_hasta'>, hoy: string): EstadoVigencia {
  if (t.vigencia_desde > hoy) return 'futura';
  if (t.vigencia_hasta !== null && t.vigencia_hasta < hoy) return 'vencida';
  return 'vigente';
}

export const ETIQUETA_VIGENCIA: Record<EstadoVigencia, string> = {
  vigente: 'Vigente',
  futura: 'Programada',
  vencida: 'Vencida',
};

export async function listarTarifas(): Promise<Resultado<Tarifa[]>> {
  const { data, error } = await supabase
    .from('tarifas')
    .select('*')
    .order('tipo_vehiculo')
    .order('vigencia_desde', { ascending: false });
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data };
}

export async function guardarTarifa(f: FormularioTarifa, id?: string): Promise<Resultado<Tarifa>> {
  const fila = formularioATarifa(f);
  const query = id
    ? supabase.from('tarifas').update(fila).eq('id', id)
    : supabase.from('tarifas').insert(fila);
  const { data, error } = await query.select().single();
  if (error) {
    if (error.code === '23P01') return { ok: false, error: MENSAJE_SUPERPOSICION };
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data };
}

export async function eliminarTarifa(id: string): Promise<Resultado> {
  const { error } = await supabase.from('tarifas').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return {
        ok: false,
        error: 'La tarifa ya se usó en cotizaciones: ciérrala con una fecha "hasta" en lugar de eliminarla',
      };
    }
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data: undefined };
}
