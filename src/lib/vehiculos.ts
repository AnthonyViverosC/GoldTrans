// HU-06 · Administrar flota de vehículos.
import { traducirError, type Resultado } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  normalizarPlaca,
  requerido,
  validarEntero,
  validarFecha,
  validarPlaca,
  type Errores,
} from '@/lib/validacion';
import type { Tables, TablesInsert } from '@/types/database';

export type Vehiculo = Tables<'vehiculos'>;

export const TIPOS_VEHICULO = ['automovil', 'campero', 'camioneta', 'van', 'microbus', 'buseta', 'bus'] as const;
export type TipoVehiculo = (typeof TIPOS_VEHICULO)[number];

export const ETIQUETA_TIPO: Record<TipoVehiculo, string> = {
  automovil: 'Automóvil',
  campero: 'Campero',
  // Así se ofrece en las cotizaciones oficiales (con platón para herramientas livianas).
  camioneta: 'Camioneta 4x4 doble cabina',
  van: 'Van',
  microbus: 'Microbús',
  buseta: 'Buseta',
  bus: 'Bus',
};

export const ESTADOS_VEHICULO = ['disponible', 'mantenimiento', 'inactivo'] as const;
export type EstadoVehiculo = (typeof ESTADOS_VEHICULO)[number];

export const ETIQUETA_ESTADO: Record<EstadoVehiculo, string> = {
  disponible: 'Disponible',
  mantenimiento: 'En mantenimiento',
  inactivo: 'Inactivo',
};

export type FormularioVehiculo = {
  placa: string;
  tipo: TipoVehiculo;
  marca: string;
  modelo: string;
  anio: string;
  capacidad: string;
  estado: EstadoVehiculo;
  soatVence: string;
  tecnomecanicaVence: string;
};

export const VEHICULO_VACIO: FormularioVehiculo = {
  placa: '',
  tipo: 'van',
  marca: '',
  modelo: '',
  anio: '',
  capacidad: '',
  estado: 'disponible',
  soatVence: '',
  tecnomecanicaVence: '',
};

export function vehiculoAFormulario(v: Vehiculo): FormularioVehiculo {
  return {
    placa: v.placa,
    tipo: v.tipo as TipoVehiculo,
    marca: v.marca,
    modelo: v.modelo,
    anio: String(v.anio),
    capacidad: String(v.capacidad_pasajeros),
    estado: v.estado as EstadoVehiculo,
    soatVence: v.soat_vence ?? '',
    tecnomecanicaVence: v.tecnomecanica_vence ?? '',
  };
}

export function validarVehiculo(
  f: FormularioVehiculo,
  anioActual = new Date().getFullYear(),
): Errores<keyof FormularioVehiculo> {
  const errores: Errores<keyof FormularioVehiculo> = {
    placa: validarPlaca(f.placa),
    marca: requerido(f.marca),
    modelo: requerido(f.modelo),
    anio: validarEntero(f.anio, 1990, anioActual + 1, `Año entre 1990 y ${anioActual + 1}`),
    capacidad: validarEntero(f.capacidad, 1, 80, 'Entre 1 y 80 pasajeros'),
    soatVence: validarFecha(f.soatVence),
    tecnomecanicaVence: validarFecha(f.tecnomecanicaVence),
  };
  for (const k of Object.keys(errores) as (keyof FormularioVehiculo)[]) {
    if (!errores[k]) delete errores[k];
  }
  return errores;
}

export function formularioAVehiculo(f: FormularioVehiculo): TablesInsert<'vehiculos'> {
  return {
    placa: normalizarPlaca(f.placa),
    tipo: f.tipo,
    marca: f.marca.trim(),
    modelo: f.modelo.trim(),
    anio: Number(f.anio),
    capacidad_pasajeros: Number(f.capacidad),
    estado: f.estado,
    soat_vence: f.soatVence.trim() || null,
    tecnomecanica_vence: f.tecnomecanicaVence.trim() || null,
  };
}

export async function listarVehiculos(): Promise<Resultado<Vehiculo[]>> {
  const { data, error } = await supabase
    .from('vehiculos')
    .select('*')
    .order('capacidad_pasajeros', { ascending: true })
    .order('placa');
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data };
}

export async function guardarVehiculo(
  f: FormularioVehiculo,
  id?: string,
): Promise<Resultado<Vehiculo>> {
  const fila = formularioAVehiculo(f);
  const query = id
    ? supabase.from('vehiculos').update(fila).eq('id', id)
    : supabase.from('vehiculos').insert(fila);
  const { data, error } = await query.select().single();
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya existe un vehículo con esa placa' };
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data };
}

export async function eliminarVehiculo(id: string): Promise<Resultado> {
  const { error } = await supabase.from('vehiculos').delete().eq('id', id);
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: undefined };
}
