// Goldtours · HU-22 reserva con viajeros · HU-23 abono con comprobante · HU-24 verificación del asesor
// HU-25 saldo y fecha límite de pago · HU-26 estados y cupos vencidos.
import { borrarArchivo, subirArchivo, type ArchivoElegido } from '@/lib/archivos';
import { traducirError, type Resultado } from '@/lib/auth';
import { formatearPesos, hoyEnColombia, sumarDias } from '@/lib/cotizador';
import type { SolicitudBandeja } from '@/lib/solicitudes';
import { supabase } from '@/lib/supabase';
import {
  normalizarPesos,
  normalizarTelefono,
  requerido,
  validarDocumento,
  validarFecha,
  validarPesos,
  validarTelefono,
  type Errores,
} from '@/lib/validacion';
import type { Json, Tables } from '@/types/database';

export type Reserva = Tables<'reservas'>;
export type Viajero = Tables<'viajeros'>;
export type Abono = Tables<'abonos'>;

// ─── Reglas (las mismas de crear_reserva en la migración del Sprint 4) ──

export const HORAS_PRERRESERVA = 48;
export const ABONO_MINIMO_PORCENTAJE = 30;
export const DIAS_LIMITE_PAGO = 8;
export const MAX_VIAJEROS = 20;

export function abonoMinimo(valorTotal: number): number {
  return Math.ceil((valorTotal * ABONO_MINIMO_PORCENTAJE) / 100);
}

/** Cuenta para la transferencia, configurada en EXPO_PUBLIC_DATOS_TRANSFERENCIA. */
export const DATOS_TRANSFERENCIA = process.env.EXPO_PUBLIC_DATOS_TRANSFERENCIA?.trim() || null;

// ─── Estados ──────────────────────────────────────────────────

export const ESTADOS_RESERVA = ['prerreserva', 'confirmada', 'pagada', 'vencida', 'cancelada'] as const;
export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

export const ETIQUETA_ESTADO_RESERVA: Record<EstadoReserva, string> = {
  prerreserva: 'Prerreserva',
  confirmada: 'Confirmada',
  pagada: 'Pagada',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
};

/** Explicación del estado para el cliente. */
export const AYUDA_ESTADO_RESERVA: Record<EstadoReserva, string> = {
  prerreserva: 'Tus cupos están apartados. Registra el abono antes de que venza el plazo.',
  confirmada: 'Tu cupo está asegurado. Paga el saldo antes de la fecha límite.',
  pagada: '¡Todo listo! Tu reserva está pagada.',
  vencida: 'El plazo para el abono pasó y los cupos se liberaron.',
  cancelada: 'La reserva fue cancelada.',
};

export const ESTADOS_ABONO = ['pendiente', 'aprobado', 'rechazado'] as const;
export type EstadoAbono = (typeof ESTADOS_ABONO)[number];

export const ETIQUETA_ESTADO_ABONO: Record<EstadoAbono, string> = {
  pendiente: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

export function esActiva(estado: string): boolean {
  return estado === 'prerreserva' || estado === 'confirmada' || estado === 'pagada';
}

/**
 * Estado que se muestra. Una prerreserva cuyo plazo pasó se ve vencida aunque la tarea
 * programada (liberar-cupos) aún no la procese, salvo que tenga un abono en revisión.
 */
export function estadoVisible(
  r: Pick<Reserva, 'estado' | 'vence_at'>,
  abonos: readonly Pick<Abono, 'estado'>[],
  ahora = new Date(),
): EstadoReserva {
  const estado = r.estado as EstadoReserva;
  if (
    estado === 'prerreserva' &&
    Date.parse(r.vence_at) < ahora.getTime() &&
    !abonos.some((a) => a.estado === 'pendiente')
  ) {
    return 'vencida';
  }
  return estado;
}

// ─── Saldo y plazos (HU-25) ───────────────────────────────────

export type ResumenPagos = {
  total: number;
  abonado: number;
  enRevision: number;
  saldo: number;
  /** Lo que falta por pagar descontando lo que está en revisión. */
  porPagar: number;
  /** Lo que falta para completar el abono mínimo (0 si ya se cubrió). */
  minimoPendiente: number;
};

export function resumenPagos(
  r: Pick<Reserva, 'valor_total' | 'valor_abonado' | 'abono_minimo'>,
  abonos: readonly Pick<Abono, 'estado' | 'valor'>[],
): ResumenPagos {
  const enRevision = abonos.filter((a) => a.estado === 'pendiente').reduce((s, a) => s + a.valor, 0);
  const saldo = r.valor_total - r.valor_abonado;
  return {
    total: r.valor_total,
    abonado: r.valor_abonado,
    enRevision,
    saldo,
    porPagar: Math.max(0, saldo - enRevision),
    minimoPendiente: Math.max(0, r.abono_minimo - r.valor_abonado - enRevision),
  };
}

/**
 * Fecha límite para pagar el saldo (la misma regla de crear_reserva): 8 días antes de la salida;
 * en reservas de última hora, al menos 2 días de plazo y nunca después del día anterior a la salida.
 */
export function fechaLimitePago(fechaSalida: string, hoy: string): string {
  const minimo = sumarDias(hoy, 2);
  const ochoAntes = sumarDias(fechaSalida, -DIAS_LIMITE_PAGO);
  const limite = ochoAntes > minimo ? ochoAntes : minimo;
  const diaAnterior = sumarDias(fechaSalida, -1);
  return limite < diaAnterior ? limite : diaAnterior;
}

/** "2026-10-23T19:30:00Z" → "2026-10-23 14:30" (hora de Colombia, UTC-5). */
export function fechaHoraColombia(iso: string): string {
  return new Date(Date.parse(iso) - 5 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');
}

/** Tiempo restante de la prerreserva: "Vence en 2 días", "Vence en 5 h", "Vence en 40 min". */
export function plazoRestante(venceAt: string, ahora = new Date()): string {
  const minutos = Math.floor((Date.parse(venceAt) - ahora.getTime()) / 60_000);
  if (minutos <= 0) return 'El plazo venció';
  if (minutos < 60) return `Vence en ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 48) return `Vence en ${horas} h`;
  return `Vence en ${Math.floor(horas / 24)} días`;
}

/** El saldo está atrasado si pasó la fecha límite y la reserva no está pagada. */
export function saldoVencido(
  r: Pick<Reserva, 'estado' | 'fecha_limite_pago' | 'valor_total' | 'valor_abonado'>,
  hoy = hoyEnColombia(),
): boolean {
  return r.estado === 'confirmada' && r.valor_abonado < r.valor_total && r.fecha_limite_pago < hoy;
}

// ─── Formulario de reserva (HU-22) ────────────────────────────

export const TIPOS_DOCUMENTO_VIAJERO = ['CC', 'TI', 'RC', 'CE', 'PA'] as const;
export type TipoDocumentoViajero = (typeof TIPOS_DOCUMENTO_VIAJERO)[number];

export const ETIQUETA_DOCUMENTO_VIAJERO: Record<TipoDocumentoViajero, string> = {
  CC: 'Cédula',
  TI: 'Tarjeta de identidad',
  RC: 'Registro civil',
  CE: 'Cédula de extranjería',
  PA: 'Pasaporte',
};

export type FormularioViajero = {
  nombreCompleto: string;
  tipoDocumento: TipoDocumentoViajero;
  numeroDocumento: string;
  fechaNacimiento: string;
};

export const VIAJERO_VACIO: FormularioViajero = {
  nombreCompleto: '',
  tipoDocumento: 'CC',
  numeroDocumento: '',
  fechaNacimiento: '',
};

export function validarViajero(v: FormularioViajero, hoy: string): Errores<keyof FormularioViajero> {
  const errores: Errores<keyof FormularioViajero> = {
    nombreCompleto: requerido(v.nombreCompleto, 'Nombre como aparece en el documento'),
    numeroDocumento: validarDocumento(v.numeroDocumento),
    fechaNacimiento:
      requerido(v.fechaNacimiento, 'Indica la fecha de nacimiento') ??
      validarFecha(v.fechaNacimiento) ??
      (v.fechaNacimiento.trim() > hoy || v.fechaNacimiento.trim() < '1900-01-01'
        ? 'Fecha de nacimiento no válida'
        : undefined),
  };
  for (const k of Object.keys(errores) as (keyof FormularioViajero)[]) {
    if (!errores[k]) delete errores[k];
  }
  return errores;
}

export type ErroresReserva = {
  viajeros: Errores<keyof FormularioViajero>[];
  telefono?: string;
  general?: string;
};

export function validarReserva(
  viajeros: readonly FormularioViajero[],
  telefono: string,
  cuposDisponibles: number,
  hoy: string,
): ErroresReserva {
  const errores: ErroresReserva = { viajeros: viajeros.map((v) => validarViajero(v, hoy)) };
  const tel = validarTelefono(telefono, true);
  if (tel) errores.telefono = tel;

  if (viajeros.length < 1 || viajeros.length > MAX_VIAJEROS) {
    errores.general = `Una reserva lleva entre 1 y ${MAX_VIAJEROS} viajeros`;
  } else if (viajeros.length > cuposDisponibles) {
    errores.general = `Solo quedan ${cuposDisponibles} cupos en esta salida`;
  }

  // Un mismo documento no puede ir dos veces en la reserva.
  const vistos = new Set<string>();
  viajeros.forEach((v, i) => {
    const doc = v.numeroDocumento.trim().toUpperCase();
    if (!doc) return;
    if (vistos.has(doc) && !errores.viajeros[i].numeroDocumento) {
      errores.viajeros[i].numeroDocumento = 'Este documento ya está en otro viajero';
    }
    vistos.add(doc);
  });
  return errores;
}

export function reservaSinErrores(e: ErroresReserva): boolean {
  return !e.telefono && !e.general && e.viajeros.every((v) => Object.keys(v).length === 0);
}

export function viajerosAJson(viajeros: readonly FormularioViajero[]): Json {
  return viajeros.map((v) => ({
    nombre_completo: v.nombreCompleto.trim(),
    tipo_documento: v.tipoDocumento,
    numero_documento: v.numeroDocumento.trim().toUpperCase(),
    fecha_nacimiento: v.fechaNacimiento.trim(),
  }));
}

export async function crearReserva(
  fechaSalidaId: string,
  viajeros: readonly FormularioViajero[],
  telefono: string,
  observaciones: string,
): Promise<Resultado<Reserva>> {
  const { data, error } = await supabase.rpc('crear_reserva', {
    p_fecha_salida_id: fechaSalidaId,
    p_viajeros: viajerosAJson(viajeros),
    p_telefono_contacto: normalizarTelefono(telefono),
    p_observaciones: observaciones.trim() || null,
  });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Hay dos viajeros con el mismo documento' };
    if (error.code === '23514') return { ok: false, error: 'Ya no quedan cupos suficientes en esta salida' };
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data };
}

// ─── Consultas ────────────────────────────────────────────────

export type ReservaCompleta = Reserva & { viajeros: Viajero[]; abonos: Abono[] };
export type ReservaBandeja = ReservaCompleta & Pick<SolicitudBandeja, 'cliente'>;

const SELECT_COMPLETA = '*, viajeros(*), abonos(*)';
const SELECT_BANDEJA = `${SELECT_COMPLETA}, cliente:usuarios!reservas_usuario_id_fkey(email, perfil:perfiles(tipo_persona, nombre_completo, razon_social, nit, telefono, numero_documento, tipo_documento))`;

function ordenar<T extends ReservaCompleta>(r: T): T {
  r.viajeros.sort((a, b) => a.orden - b.orden);
  r.abonos.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return r;
}

/** Reservas del cliente (RLS: solo las suyas). */
export async function listarMisReservas(usuarioId: string): Promise<Resultado<ReservaCompleta[]>> {
  const { data, error } = await supabase
    .from('reservas')
    .select(SELECT_COMPLETA)
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: (data as ReservaCompleta[]).map(ordenar) };
}

export async function obtenerReserva(id: string): Promise<Resultado<ReservaCompleta>> {
  const { data, error } = await supabase.from('reservas').select(SELECT_COMPLETA).eq('id', id).maybeSingle();
  if (error) return { ok: false, error: traducirError(error) };
  if (!data) return { ok: false, error: 'La reserva no existe' };
  return { ok: true, data: ordenar(data as ReservaCompleta) };
}

export type FiltroBandeja = 'por_verificar' | EstadoReserva | 'todas';

/** HU-24 · Bandeja del asesor. "Por verificar": reservas con abonos en revisión, las más antiguas primero. */
export async function listarBandejaReservas(filtro: FiltroBandeja): Promise<Resultado<ReservaBandeja[]>> {
  let query = supabase.from('reservas').select(SELECT_BANDEJA).limit(100);

  if (filtro === 'por_verificar') {
    const pendientes = await supabase.from('abonos').select('reserva_id').eq('estado', 'pendiente').limit(200);
    if (pendientes.error) return { ok: false, error: traducirError(pendientes.error) };
    const ids = [...new Set(pendientes.data.map((a) => a.reserva_id))];
    if (ids.length === 0) return { ok: true, data: [] };
    query = query.in('id', ids).order('created_at', { ascending: true });
  } else {
    if (filtro !== 'todas') query = query.eq('estado', filtro);
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: (data as unknown as ReservaBandeja[]).map(ordenar) };
}

export async function obtenerReservaBandeja(id: string): Promise<Resultado<ReservaBandeja>> {
  const { data, error } = await supabase.from('reservas').select(SELECT_BANDEJA).eq('id', id).maybeSingle();
  if (error) return { ok: false, error: traducirError(error) };
  if (!data) return { ok: false, error: 'La reserva no existe' };
  return { ok: true, data: ordenar(data as unknown as ReservaBandeja) };
}

export async function cancelarReserva(id: string, motivo = ''): Promise<Resultado<Reserva>> {
  const { data, error } = await supabase.rpc('cancelar_reserva', {
    p_reserva_id: id,
    p_motivo: motivo.trim() || null,
  });
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data };
}

// ─── Abonos (HU-23) ───────────────────────────────────────────

export type FormularioAbono = {
  valor: string;
  fechaTransferencia: string;
  referencia: string;
};

export function validarAbono(
  f: FormularioAbono,
  resumen: ResumenPagos,
  archivo: ArchivoElegido | null,
  hoy: string,
): Errores<keyof FormularioAbono | 'comprobante'> {
  const valor = Number(normalizarPesos(f.valor));
  const errores: Errores<keyof FormularioAbono | 'comprobante'> = {
    valor:
      validarPesos(f.valor, 'Indica el valor transferido') ??
      (valor <= 0
        ? 'El valor debe ser mayor que cero'
        : valor > resumen.porPagar
          ? `No puede superar el saldo pendiente (${formatearPesos(resumen.porPagar)})`
          : valor < resumen.minimoPendiente
            ? `El abono mínimo para confirmar la reserva es ${formatearPesos(resumen.minimoPendiente)}`
            : undefined),
    fechaTransferencia:
      requerido(f.fechaTransferencia, 'Indica la fecha de la transferencia') ??
      validarFecha(f.fechaTransferencia) ??
      (f.fechaTransferencia.trim() > hoy ? 'No puede ser una fecha futura' : undefined),
    comprobante: archivo ? undefined : 'Adjunta el comprobante de la transferencia',
  };
  for (const k of Object.keys(errores) as (keyof typeof errores)[]) {
    if (!errores[k]) delete errores[k];
  }
  return errores;
}

/** Sube el comprobante a <usuario>/<reserva>/ y registra el abono; si el registro falla, borra el archivo. */
export async function registrarAbono(
  reserva: Pick<Reserva, 'id' | 'usuario_id'>,
  f: FormularioAbono,
  archivo: ArchivoElegido,
): Promise<Resultado<Abono>> {
  const subida = await subirArchivo('comprobantes', `${reserva.usuario_id}/${reserva.id}`, archivo);
  if (!subida.ok) return subida;

  const { data, error } = await supabase.rpc('registrar_abono', {
    p_reserva_id: reserva.id,
    p_valor: Number(normalizarPesos(f.valor)),
    p_fecha_transferencia: f.fechaTransferencia.trim(),
    p_comprobante_ruta: subida.data,
    p_referencia: f.referencia.trim() || null,
  });
  if (error) {
    await borrarArchivo('comprobantes', subida.data);
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data };
}

// ─── Verificación del asesor (HU-24) ──────────────────────────

export type AccionAbono = 'aprobar' | 'rechazar';

export function validarVerificacion(accion: AccionAbono, motivo: string): string | undefined {
  if (accion === 'rechazar') return requerido(motivo, 'Explica al cliente por qué se rechaza');
}

export async function verificarAbono(
  abonoId: string,
  accion: AccionAbono,
  motivo: string,
): Promise<Resultado<Abono>> {
  const { data, error } = await supabase.rpc('verificar_abono', {
    p_abono_id: abonoId,
    p_accion: accion,
    p_motivo: motivo.trim() || null,
  });
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data };
}
