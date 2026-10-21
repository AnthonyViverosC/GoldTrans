// HU-16 convertir cotización en solicitud formal · HU-17 gestión del asesor comercial.
import { traducirError, type Resultado } from '@/lib/auth';
import type { CotizacionGuardada } from '@/lib/cotizador';
import { supabase } from '@/lib/supabase';
import {
  normalizarTelefono,
  requerido,
  validarPesos,
  validarTelefono,
  normalizarPesos,
  type Errores,
} from '@/lib/validacion';
import type { Tables } from '@/types/database';

export type Solicitud = Tables<'solicitudes'>;

export const ESTADOS_SOLICITUD = ['pendiente', 'confirmada', 'ajustada', 'rechazada', 'cancelada'] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const ETIQUETA_ESTADO_SOLICITUD: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  ajustada: 'Valor ajustado',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

/** Explicación del estado para el cliente. */
export const AYUDA_ESTADO: Record<EstadoSolicitud, string> = {
  pendiente: 'Un asesor revisará tu solicitud y te contactará.',
  confirmada: 'Tu servicio está confirmado.',
  ajustada: 'El asesor ajustó el valor. Acéptalo para confirmar el servicio o cancela la solicitud.',
  rechazada: 'La solicitud no pudo atenderse.',
  cancelada: 'Cancelaste esta solicitud.',
};

/** Valor vigente: el confirmado/ajustado por el asesor o, mientras tanto, el cotizado. */
export function valorSolicitud(s: Pick<Solicitud, 'valor_final' | 'valor_cotizado'>): number {
  return s.valor_final ?? s.valor_cotizado;
}

// ─── Formulario del cliente (HU-16) ───────────────────────────

export type FormularioSolicitud = {
  nombreContacto: string;
  telefonoContacto: string;
  direccionRecogida: string;
  horaRecogida: string;
  observaciones: string;
};

export function validarHora(hora: string): string | undefined {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora.trim())) return 'Formato 24 h: HH:MM (ej. 06:30)';
}

export function validarFormularioSolicitud(f: FormularioSolicitud): Errores<keyof FormularioSolicitud> {
  const errores: Errores<keyof FormularioSolicitud> = {
    nombreContacto: requerido(f.nombreContacto, 'Indica quién recibe el servicio'),
    telefonoContacto: validarTelefono(f.telefonoContacto, true),
    direccionRecogida: requerido(f.direccionRecogida, 'Indica dónde recogemos a los pasajeros'),
    horaRecogida: validarHora(f.horaRecogida),
  };
  for (const k of Object.keys(errores) as (keyof FormularioSolicitud)[]) {
    if (!errores[k]) delete errores[k];
  }
  return errores;
}

export async function crearSolicitud(
  cotizacionId: string,
  f: FormularioSolicitud,
): Promise<Resultado<Solicitud>> {
  const { data, error } = await supabase.rpc('crear_solicitud', {
    p_cotizacion_id: cotizacionId,
    p_nombre_contacto: f.nombreContacto.trim(),
    p_telefono_contacto: normalizarTelefono(f.telefonoContacto),
    p_direccion_recogida: f.direccionRecogida.trim(),
    p_hora_recogida: f.horaRecogida.trim(),
    p_observaciones: f.observaciones.trim() || null,
  });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Esta cotización ya tiene una solicitud' };
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data };
}

// ─── Consultas ────────────────────────────────────────────────

const SELECT_COTIZACION = 'cotizacion:cotizaciones(*, detalle:detalle_cotizacion(*))';

export type SolicitudCliente = Solicitud & { cotizacion: CotizacionGuardada | null };

export type SolicitudBandeja = SolicitudCliente & {
  cliente: {
    email: string;
    perfil: Pick<
      Tables<'perfiles'>,
      'tipo_persona' | 'nombre_completo' | 'razon_social' | 'nit' | 'telefono' | 'numero_documento' | 'tipo_documento'
    > | null;
  } | null;
};

function ordenarDetalle<T extends { cotizacion: CotizacionGuardada | null }>(filas: T[]): T[] {
  for (const s of filas) s.cotizacion?.detalle.sort((a, b) => a.orden - b.orden);
  return filas;
}

/** Solicitudes del cliente (RLS: solo las suyas). */
export async function listarMisSolicitudes(usuarioId: string): Promise<Resultado<SolicitudCliente[]>> {
  const { data, error } = await supabase
    .from('solicitudes')
    .select(`*, ${SELECT_COTIZACION}`)
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: ordenarDetalle(data as SolicitudCliente[]) };
}

/** HU-17 · Bandeja del asesor. Las pendientes, las más antiguas primero. */
export async function listarBandeja(estado: EstadoSolicitud | 'todas'): Promise<Resultado<SolicitudBandeja[]>> {
  let query = supabase
    .from('solicitudes')
    .select(
      `*, ${SELECT_COTIZACION}, cliente:usuarios!solicitudes_usuario_id_fkey(email, perfil:perfiles(tipo_persona, nombre_completo, razon_social, nit, telefono, numero_documento, tipo_documento))`,
    )
    .order('created_at', { ascending: estado === 'pendiente' })
    .limit(100);
  if (estado !== 'todas') query = query.eq('estado', estado);
  const { data, error } = await query;
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: ordenarDetalle(data as unknown as SolicitudBandeja[]) };
}

export function nombreCliente(s: Pick<SolicitudBandeja, 'cliente'>): string {
  const p = s.cliente?.perfil;
  return p?.razon_social || p?.nombre_completo || s.cliente?.email || 'Cliente';
}

// ─── Respuesta del asesor (HU-17) ─────────────────────────────

export type AccionAsesor = 'confirmar' | 'ajustar' | 'rechazar';

export function validarRespuesta(
  accion: AccionAsesor,
  valor: string,
  motivo: string,
): Errores<'valor' | 'motivo'> {
  const errores: Errores<'valor' | 'motivo'> = {};
  if (accion === 'ajustar') {
    errores.valor = validarPesos(valor, 'Indica el nuevo valor en pesos') ??
      (Number(normalizarPesos(valor)) <= 0 ? 'El valor debe ser mayor que cero' : undefined);
    errores.motivo = requerido(motivo, 'Explica al cliente por qué cambia el valor');
  }
  if (accion === 'rechazar') errores.motivo = requerido(motivo, 'Indica el motivo del rechazo');
  if (!errores.valor) delete errores.valor;
  if (!errores.motivo) delete errores.motivo;
  return errores;
}

export async function responderSolicitud(
  id: string,
  accion: AccionAsesor,
  valor: string,
  motivo: string,
): Promise<Resultado<Solicitud>> {
  const { data, error } = await supabase.rpc('responder_solicitud', {
    p_solicitud_id: id,
    p_accion: accion,
    p_valor: accion === 'ajustar' ? Number(normalizarPesos(valor)) : null,
    p_motivo: motivo.trim() || null,
  });
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data };
}

/** El cliente acepta el valor ajustado o cancela la solicitud. */
export async function decidirSolicitud(
  id: string,
  accion: 'aceptar' | 'cancelar',
): Promise<Resultado<Solicitud>> {
  const { data, error } = await supabase.rpc('decidir_solicitud', {
    p_solicitud_id: id,
    p_accion: accion,
  });
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data };
}
