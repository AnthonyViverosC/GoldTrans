// Sprint 5 · HU-28 alertas · HU-31 procesos de licitación · HU-32 lista de verificación · HU-33 paquete.
import { FunctionsHttpError } from '@supabase/supabase-js';

import { traducirError, type Resultado } from '@/lib/auth';
import { REGION_FUNCIONES } from '@/lib/cotizador';
import { supabase } from '@/lib/supabase';
import { normalizarPesos, requerido, validarFecha, type Errores } from '@/lib/validacion';
import type { Tables } from '@/types/database';

import {
  cumplimiento,
  estadoItem,
  type Cumplimiento,
  type EstadoItem,
} from '../../supabase/functions/_shared/licitaciones';

export {
  DIAS_POR_VENCER,
  ESTADOS_VIGENCIA,
  MAX_PAQUETE_BYTES,
  UMBRALES_ALERTA,
  cumplimiento,
  diasHasta,
  estadoItem,
  estadoVigencia,
  nombreEnPaquete,
  problemasPaquete,
  umbralAlerta,
  type Cumplimiento,
  type EstadoItem,
  type EstadoVigencia,
} from '../../supabase/functions/_shared/licitaciones';

export const ETIQUETA_VIGENCIA = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  sin_vigencia: 'Sin vencimiento',
} as const;

export const ETIQUETA_ITEM: Record<EstadoItem, string> = {
  cumple: 'Cumple',
  vence_antes_cierre: 'Vence antes del cierre',
  vencido: 'Vencido',
  pendiente: 'Pendiente',
};

// ─── Procesos (HU-31) ─────────────────────────────────────────

export type Proceso = Tables<'procesos_licitacion'>;
export type ItemVerificacion = Tables<'items_verificacion'>;
export type Descarga = Tables<'bitacora_descargas'>;

export const ESTADOS_PROCESO = ['preparacion', 'presentada', 'adjudicada', 'no_adjudicada', 'desierta', 'cancelada'] as const;
export type EstadoProceso = (typeof ESTADOS_PROCESO)[number];

export const ETIQUETA_ESTADO_PROCESO: Record<EstadoProceso, string> = {
  preparacion: 'En preparación',
  presentada: 'Propuesta presentada',
  adjudicada: 'Adjudicada',
  no_adjudicada: 'No adjudicada',
  desierta: 'Desierta',
  cancelada: 'Cancelada',
};

export function procesoAbierto(estado: string): boolean {
  return estado === 'preparacion' || estado === 'presentada';
}

export type DocumentoDeItem = {
  id: string;
  nombre: string;
  version_actual: number;
  vigencia: { fecha_vencimiento: string } | null;
};

export type ItemConDocumento = ItemVerificacion & { documento: DocumentoDeItem | null };
export type ProcesoCompleto = Proceso & { items: ItemConDocumento[]; descargas: Descarga[] };
export type ItemEvaluado = ItemConDocumento & { estado: EstadoItem };

const SELECT_PROCESO =
  '*, items:items_verificacion(*, documento:documentos(id, nombre, version_actual, vigencia:vigencias(fecha_vencimiento))), descargas:bitacora_descargas(*)';

function ordenar(p: ProcesoCompleto): ProcesoCompleto {
  p.items.sort((a, b) => a.orden - b.orden || a.created_at.localeCompare(b.created_at));
  p.descargas.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return p;
}

/** HU-32 · Estado de cada requisito según el documento vinculado y la fecha de cierre. */
export function evaluarProceso(
  p: Pick<ProcesoCompleto, 'items' | 'fecha_cierre'>,
  hoy: string,
): { items: ItemEvaluado[]; resumen: Cumplimiento } {
  const items = p.items.map((i) => ({
    ...i,
    estado: estadoItem(i, i.documento?.vigencia?.fecha_vencimiento ?? null, hoy, p.fecha_cierre),
  }));
  return { items, resumen: cumplimiento(items) };
}

export async function listarProcesos(): Promise<Resultado<ProcesoCompleto[]>> {
  const { data, error } = await supabase.from('procesos_licitacion').select(SELECT_PROCESO).order('fecha_cierre');
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: (data as unknown as ProcesoCompleto[]).map(ordenar) };
}

export async function obtenerProceso(id: string): Promise<Resultado<ProcesoCompleto>> {
  const { data, error } = await supabase.from('procesos_licitacion').select(SELECT_PROCESO).eq('id', id).maybeSingle();
  if (error) return { ok: false, error: traducirError(error) };
  if (!data) return { ok: false, error: 'El proceso no existe' };
  return { ok: true, data: ordenar(data as unknown as ProcesoCompleto) };
}

export type FormularioProceso = {
  numero: string;
  entidad: string;
  objeto: string;
  fechaCierre: string;
  valorEstimado: string;
  estado: EstadoProceso;
  enlace: string;
  notas: string;
  responsableId: string;
};

export const PROCESO_VACIO: FormularioProceso = {
  numero: '',
  entidad: '',
  objeto: '',
  fechaCierre: '',
  valorEstimado: '',
  estado: 'preparacion',
  enlace: '',
  notas: '',
  responsableId: '',
};

export function procesoAFormulario(p: Proceso): FormularioProceso {
  return {
    numero: p.numero,
    entidad: p.entidad,
    objeto: p.objeto,
    fechaCierre: p.fecha_cierre,
    valorEstimado: p.valor_estimado !== null ? String(p.valor_estimado) : '',
    estado: p.estado as EstadoProceso,
    enlace: p.enlace ?? '',
    notas: p.notas ?? '',
    responsableId: p.responsable_id ?? '',
  };
}

export function validarProceso(f: FormularioProceso): Errores<keyof FormularioProceso> {
  const errores: Errores<keyof FormularioProceso> = {
    numero: requerido(f.numero, 'Indica el número del proceso (SECOP o de la entidad)'),
    entidad: requerido(f.entidad, 'Indica la entidad contratante'),
    objeto: requerido(f.objeto, 'Describe el objeto del contrato'),
    fechaCierre: requerido(f.fechaCierre, 'Indica la fecha de cierre') ?? validarFecha(f.fechaCierre),
    // Los contratos públicos superan con facilidad el tope de 100 millones de validarPesos.
    valorEstimado:
      f.valorEstimado.trim() && !/^\d{1,15}$/.test(normalizarPesos(f.valorEstimado))
        ? 'Valor en pesos no válido (solo números)'
        : undefined,
    enlace: f.enlace.trim() && !/^https?:\/\/\S+$/i.test(f.enlace.trim()) ? 'Debe empezar por https://' : undefined,
  };
  for (const k of Object.keys(errores) as (keyof FormularioProceso)[]) {
    if (!errores[k]) delete errores[k];
  }
  return errores;
}

export async function guardarProceso(f: FormularioProceso, id?: string): Promise<Resultado<Proceso>> {
  const fila = {
    numero: f.numero.trim(),
    entidad: f.entidad.trim(),
    objeto: f.objeto.trim(),
    fecha_cierre: f.fechaCierre.trim(),
    valor_estimado: f.valorEstimado.trim() ? Number(normalizarPesos(f.valorEstimado)) : null,
    estado: f.estado,
    enlace: f.enlace.trim() || null,
    notas: f.notas.trim() || null,
    responsable_id: f.responsableId || null,
  };
  const query = id
    ? supabase.from('procesos_licitacion').update(fila).eq('id', id)
    : supabase.from('procesos_licitacion').insert(fila);
  const { data, error } = await query.select().single();
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya existe un proceso con ese número en la entidad' };
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data };
}

/** Solo admin (RLS). */
export async function eliminarProceso(id: string): Promise<Resultado> {
  const { error, count } = await supabase.from('procesos_licitacion').delete({ count: 'exact' }).eq('id', id);
  if (error) return { ok: false, error: traducirError(error) };
  if (count === 0) return { ok: false, error: 'Solo un administrador puede eliminar procesos' };
  return { ok: true, data: undefined };
}

// ─── Lista de verificación (HU-32) ────────────────────────────

/** Requisitos habituales en licitaciones de transporte especial; se agregan como punto de partida. */
export const PLANTILLA_REQUISITOS: readonly { requisito: string; obligatorio: boolean }[] = [
  { requisito: 'Carta de presentación de la propuesta firmada', obligatorio: true },
  { requisito: 'Certificado de existencia y representación legal (Cámara de Comercio)', obligatorio: true },
  { requisito: 'RUT actualizado', obligatorio: true },
  { requisito: 'Cédula del representante legal', obligatorio: true },
  { requisito: 'Resolución de habilitación del Ministerio de Transporte', obligatorio: true },
  { requisito: 'Certificado de pago de seguridad social y parafiscales', obligatorio: true },
  { requisito: 'Pólizas de responsabilidad civil contractual y extracontractual', obligatorio: true },
  { requisito: 'Estados financieros del último año', obligatorio: true },
  { requisito: 'RUP (Registro Único de Proponentes)', obligatorio: true },
  { requisito: 'Certificados de experiencia en contratos similares', obligatorio: false },
  { requisito: 'Antecedentes fiscales, disciplinarios y judiciales', obligatorio: true },
];

export async function agregarItems(
  procesoId: string,
  items: readonly { requisito: string; obligatorio: boolean }[],
  ordenInicial: number,
): Promise<Resultado> {
  const filas = items
    .filter((i) => i.requisito.trim())
    .map((i, k) => ({ proceso_id: procesoId, requisito: i.requisito.trim(), obligatorio: i.obligatorio, orden: ordenInicial + k }));
  if (!filas.length) return { ok: false, error: 'Escribe el requisito' };
  const { error } = await supabase.from('items_verificacion').insert(filas);
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: undefined };
}

export async function actualizarItem(
  id: string,
  cambios: Partial<Pick<ItemVerificacion, 'documento_id' | 'cumplido_manual' | 'obligatorio' | 'requisito' | 'notas'>>,
): Promise<Resultado> {
  // Vincular un documento quita la marca manual (restricción items_verificacion_manual_sin_documento).
  const fila = cambios.documento_id ? { ...cambios, cumplido_manual: false } : cambios;
  const { error } = await supabase.from('items_verificacion').update(fila).eq('id', id);
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: undefined };
}

export async function eliminarItem(id: string): Promise<Resultado> {
  const { error } = await supabase.from('items_verificacion').delete().eq('id', id);
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: undefined };
}

// ─── Paquete de documentos (HU-33) ────────────────────────────

export type PaqueteGenerado = {
  url: string;
  nombre: string;
  documentos: number;
  vencidos: number;
  tamano_bytes: number;
};

/** La Edge Function arma el ZIP con la versión vigente de cada documento y registra la descarga. */
export async function descargarPaquete(procesoId: string): Promise<Resultado<PaqueteGenerado>> {
  const { data, error } = await supabase.functions.invoke<PaqueteGenerado>('descargar-paquete', {
    body: { proceso_id: procesoId },
    region: REGION_FUNCIONES,
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const cuerpo = await error.context.json().catch(() => null);
      if (cuerpo?.error) return { ok: false, error: cuerpo.error };
    }
    return { ok: false, error: traducirError(error) };
  }
  if (!data) return { ok: false, error: 'No se pudo generar el paquete' };
  return { ok: true, data };
}

// ─── Alertas (HU-28) ──────────────────────────────────────────

export type Alerta = Tables<'alertas'>;

/** Alertas sin leer del usuario (RLS: solo las suyas; el admin ve todas, por eso se filtra). */
export async function listarMisAlertas(usuarioId: string): Promise<Resultado<Alerta[]>> {
  const { data, error } = await supabase
    .from('alertas')
    .select('*')
    .eq('responsable_id', usuarioId)
    .is('leida_at', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data };
}

export async function marcarAlertasLeidas(ids: readonly string[]): Promise<Resultado> {
  const { error } = await supabase.from('alertas').update({ leida_at: new Date().toISOString() }).in('id', [...ids]);
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: undefined };
}
