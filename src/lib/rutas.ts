// HU-09 · Administrar tabla de rutas.
import { traducirError, type Resultado } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  aDecimal,
  normalizarPesos,
  requerido,
  validarDecimal,
  validarPesos,
  type Errores,
} from '@/lib/validacion';
import type { Tables, TablesInsert } from '@/types/database';

export type Ruta = Tables<'rutas'>;

export type FormularioRuta = {
  origen: string;
  destino: string;
  distanciaKm: string;
  duracionHoras: string;
  peajes: string;
  estado: 'activa' | 'inactiva';
};

export const RUTA_VACIA: FormularioRuta = {
  origen: '',
  destino: '',
  distanciaKm: '',
  duracionHoras: '',
  peajes: '0',
  estado: 'activa',
};

export function rutaAFormulario(r: Ruta): FormularioRuta {
  return {
    origen: r.origen,
    destino: r.destino,
    distanciaKm: String(r.distancia_km),
    duracionHoras: r.duracion_horas == null ? '' : String(r.duracion_horas),
    peajes: String(r.peajes),
    estado: r.activo ? 'activa' : 'inactiva',
  };
}

export function validarRuta(f: FormularioRuta): Errores<keyof FormularioRuta> {
  const errores: Errores<keyof FormularioRuta> = {
    origen: requerido(f.origen, 'Indica el origen'),
    destino:
      requerido(f.destino, 'Indica el destino') ??
      (f.origen.trim().toLowerCase() === f.destino.trim().toLowerCase()
        ? 'El destino debe ser distinto del origen'
        : undefined),
    distanciaKm: validarDecimal(f.distanciaKm, 0.1, 5000, 'Distancia entre 0,1 y 5.000 km'),
    duracionHoras: f.duracionHoras.trim()
      ? validarDecimal(f.duracionHoras, 0.1, 99, 'Duración entre 0,1 y 99 horas')
      : undefined,
    peajes: validarPesos(f.peajes, 'Valor de peajes no válido (usa 0 si no hay)'),
  };
  for (const k of Object.keys(errores) as (keyof FormularioRuta)[]) {
    if (!errores[k]) delete errores[k];
  }
  return errores;
}

export function formularioARuta(f: FormularioRuta): TablesInsert<'rutas'> {
  return {
    origen: f.origen.trim(),
    destino: f.destino.trim(),
    distancia_km: aDecimal(f.distanciaKm),
    duracion_horas: f.duracionHoras.trim() ? aDecimal(f.duracionHoras) : null,
    peajes: Number(normalizarPesos(f.peajes)),
    activo: f.estado === 'activa',
  };
}

/** Admin: todas las rutas. Visitantes y clientes: RLS solo devuelve las activas. */
export async function listarRutas(): Promise<Resultado<Ruta[]>> {
  const { data, error } = await supabase.from('rutas').select('*').order('origen').order('destino');
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data };
}

/** Rutas que se pueden cotizar (HU-11). */
export async function listarRutasActivas(): Promise<Resultado<Ruta[]>> {
  const { data, error } = await supabase
    .from('rutas')
    .select('*')
    .eq('activo', true)
    .order('origen')
    .order('destino');
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data };
}

export async function guardarRuta(f: FormularioRuta, id?: string): Promise<Resultado<Ruta>> {
  const fila = formularioARuta(f);
  const query = id
    ? supabase.from('rutas').update(fila).eq('id', id)
    : supabase.from('rutas').insert(fila);
  const { data, error } = await query.select().single();
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya existe una ruta con ese origen y destino' };
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data };
}

export async function eliminarRuta(id: string): Promise<Resultado> {
  const { error } = await supabase.from('rutas').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return { ok: false, error: 'La ruta ya tiene cotizaciones: márcala como inactiva en lugar de eliminarla' };
    }
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data: undefined };
}
