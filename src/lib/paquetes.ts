// Goldtours · HU-18 catálogo con filtros · HU-19 ficha · HU-20 fechas con cupos · HU-21 paquetes.
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
import type { Tables, TablesInsert } from '@/types/database';

export type Paquete = Tables<'paquetes'>;
export type ImagenPaquete = Pick<Tables<'imagenes_paquete'>, 'id' | 'ruta' | 'orden'>;
export type DiaItinerario = Tables<'itinerario_paquete'>;
export type FechaSalida = Tables<'fechas_salida'>;

export type PaqueteCompleto = Paquete & {
  imagenes: ImagenPaquete[];
  itinerario: DiaItinerario[];
  fechas: FechaSalida[];
};

const BUCKET = 'paquetes';
const SELECT_COMPLETO =
  '*, imagenes:imagenes_paquete(id, ruta, orden), itinerario:itinerario_paquete(*), fechas:fechas_salida(*)';

/** Orden de las relaciones: fotos (la portada primero), días y fechas. */
function ordenar(p: PaqueteCompleto): PaqueteCompleto {
  p.imagenes.sort((a, b) => a.orden - b.orden);
  p.itinerario.sort((a, b) => a.dia - b.dia);
  p.fechas.sort((a, b) => a.fecha_salida.localeCompare(b.fecha_salida));
  return p;
}

export function urlImagen(ruta: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}

export function portada(p: Pick<PaqueteCompleto, 'imagenes'>): string | null {
  return p.imagenes[0] ? urlImagen(p.imagenes[0].ruta) : null;
}

export function duracionTexto(p: Pick<Paquete, 'duracion_dias' | 'duracion_noches'>): string {
  const dias = `${p.duracion_dias} ${p.duracion_dias === 1 ? 'día' : 'días'}`;
  if (p.duracion_noches === 0) return dias;
  return `${dias} / ${p.duracion_noches} ${p.duracion_noches === 1 ? 'noche' : 'noches'}`;
}

// ─── Fechas y cupos (HU-20) ───────────────────────────────────

export type EstadoFecha = 'disponible' | 'ultimos' | 'agotada' | 'cerrada' | 'pasada';

export const ULTIMOS_CUPOS = 5;

export function estadoFecha(
  f: Pick<FechaSalida, 'fecha_salida' | 'estado' | 'cupos_totales' | 'cupos_reservados'>,
  hoy: string,
): EstadoFecha {
  if (f.fecha_salida < hoy) return 'pasada';
  if (f.estado === 'cerrada') return 'cerrada';
  const disponibles = f.cupos_totales - f.cupos_reservados;
  if (disponibles <= 0) return 'agotada';
  return disponibles <= ULTIMOS_CUPOS ? 'ultimos' : 'disponible';
}

/** Solo las fechas "disponible" y "ultimos" admiten nuevas reservas. */
export function admiteReservas(estado: EstadoFecha): boolean {
  return estado === 'disponible' || estado === 'ultimos';
}

export const ETIQUETA_ESTADO_FECHA: Record<EstadoFecha, string> = {
  disponible: 'Disponible',
  ultimos: 'Últimos cupos',
  agotada: 'Agotada',
  cerrada: 'Cerrada',
  pasada: 'Ya salió',
};

/** Próxima salida que todavía admite reservas. */
export function proximaSalida(p: Pick<PaqueteCompleto, 'fechas'>, hoy: string): FechaSalida | null {
  return (
    [...p.fechas]
      .sort((a, b) => a.fecha_salida.localeCompare(b.fecha_salida))
      .find((f) => admiteReservas(estadoFecha(f, hoy))) ?? null
  );
}

// ─── Catálogo con filtros (HU-18) ─────────────────────────────

export type FiltroDuracion = 'todas' | '1' | '2-3' | '4+';
export type OrdenCatalogo = 'salida' | 'precio' | 'precio_desc';

export type FiltrosCatalogo = {
  texto: string;
  destino: string; // '' = todos
  duracion: FiltroDuracion;
  orden: OrdenCatalogo;
};

export const FILTROS_INICIALES: FiltrosCatalogo = { texto: '', destino: '', duracion: 'todas', orden: 'salida' };

function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function cumpleDuracion(dias: number, filtro: FiltroDuracion): boolean {
  switch (filtro) {
    case '1':
      return dias === 1;
    case '2-3':
      return dias >= 2 && dias <= 3;
    case '4+':
      return dias >= 4;
    default:
      return true;
  }
}

export function filtrarCatalogo<P extends PaqueteCompleto>(
  paquetes: readonly P[],
  f: FiltrosCatalogo,
  hoy: string,
): P[] {
  const texto = sinTildes(f.texto.trim());
  const filtrados = paquetes.filter(
    (p) =>
      (!texto || sinTildes(`${p.nombre} ${p.destino}`).includes(texto)) &&
      (!f.destino || p.destino === f.destino) &&
      cumpleDuracion(p.duracion_dias, f.duracion),
  );
  const salida = (p: P) => proximaSalida(p, hoy)?.fecha_salida ?? '9999-12-31';
  return filtrados.sort((a, b) => {
    if (f.orden === 'precio') return a.precio_por_persona - b.precio_por_persona;
    if (f.orden === 'precio_desc') return b.precio_por_persona - a.precio_por_persona;
    return salida(a).localeCompare(salida(b)) || a.nombre.localeCompare(b.nombre);
  });
}

export function destinosDe(paquetes: readonly Pick<Paquete, 'destino'>[]): string[] {
  return [...new Set(paquetes.map((p) => p.destino))].sort((a, b) => a.localeCompare(b));
}

/** Catálogo público (RLS: solo paquetes activos con foto). */
export async function listarCatalogo(): Promise<Resultado<PaqueteCompleto[]>> {
  const { data, error } = await supabase.from('paquetes').select(SELECT_COMPLETO).eq('activo', true);
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: (data as PaqueteCompleto[]).map(ordenar) };
}

export async function obtenerPaquete(id: string): Promise<Resultado<PaqueteCompleto>> {
  const { data, error } = await supabase.from('paquetes').select(SELECT_COMPLETO).eq('id', id).maybeSingle();
  if (error) return { ok: false, error: traducirError(error) };
  if (!data) return { ok: false, error: 'El paquete no existe o ya no está disponible' };
  return { ok: true, data: ordenar(data as PaqueteCompleto) };
}

// ─── Administración de paquetes (HU-21) ───────────────────────

/** Admin: todos los paquetes, también los inactivos o sin foto. */
export async function listarPaquetesAdmin(): Promise<Resultado<PaqueteCompleto[]>> {
  const { data, error } = await supabase.from('paquetes').select(SELECT_COMPLETO).order('nombre');
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: (data as PaqueteCompleto[]).map(ordenar) };
}

export type FormularioPaquete = {
  nombre: string;
  destino: string;
  descripcion: string;
  dias: string;
  noches: string;
  precio: string;
  /** Un ítem por línea. */
  incluye: string;
  noIncluye: string;
  estado: 'activo' | 'inactivo';
};

export const PAQUETE_VACIO: FormularioPaquete = {
  nombre: '',
  destino: '',
  descripcion: '',
  dias: '1',
  noches: '0',
  precio: '',
  incluye: '',
  noIncluye: '',
  estado: 'inactivo',
};

export function paqueteAFormulario(p: Paquete): FormularioPaquete {
  return {
    nombre: p.nombre,
    destino: p.destino,
    descripcion: p.descripcion,
    dias: String(p.duracion_dias),
    noches: String(p.duracion_noches),
    precio: String(p.precio_por_persona),
    incluye: p.incluye.join('\n'),
    noIncluye: p.no_incluye.join('\n'),
    estado: p.activo ? 'activo' : 'inactivo',
  };
}

export function lineas(texto: string): string[] {
  return texto
    .split('\n')
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

export function validarPaquete(f: FormularioPaquete): Errores<keyof FormularioPaquete> {
  const errores: Errores<keyof FormularioPaquete> = {
    nombre: requerido(f.nombre, 'Indica el nombre del paquete'),
    destino: requerido(f.destino, 'Indica el destino'),
    dias: validarEntero(f.dias, 1, 60, 'Entre 1 y 60 días'),
    noches: validarEntero(f.noches, 0, 60, 'Entre 0 y 60 noches'),
    precio:
      validarPesos(f.precio, 'Indica el precio por persona') ??
      (Number(normalizarPesos(f.precio)) <= 0 ? 'El precio debe ser mayor que cero' : undefined),
  };
  if (!errores.dias && !errores.noches && Number(f.noches) > Number(f.dias)) {
    errores.noches = 'No puede haber más noches que días';
  }
  for (const k of Object.keys(errores) as (keyof FormularioPaquete)[]) {
    if (!errores[k]) delete errores[k];
  }
  return errores;
}

export function formularioAPaquete(f: FormularioPaquete): TablesInsert<'paquetes'> {
  return {
    nombre: f.nombre.trim(),
    destino: f.destino.trim(),
    descripcion: f.descripcion.trim(),
    duracion_dias: Number(f.dias),
    duracion_noches: Number(f.noches),
    precio_por_persona: Number(normalizarPesos(f.precio)),
    incluye: lineas(f.incluye),
    no_incluye: lineas(f.noIncluye),
    activo: f.estado === 'activo',
  };
}

export async function guardarPaquete(f: FormularioPaquete, id?: string): Promise<Resultado<Paquete>> {
  const fila = formularioAPaquete(f);
  const query = id
    ? supabase.from('paquetes').update(fila).eq('id', id)
    : supabase.from('paquetes').insert(fila);
  const { data, error } = await query.select().single();
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data };
}

export async function eliminarPaquete(p: Pick<PaqueteCompleto, 'id' | 'imagenes'>): Promise<Resultado> {
  const { error } = await supabase.from('paquetes').delete().eq('id', p.id);
  if (error) {
    if (error.code === '23503') {
      return { ok: false, error: 'El paquete ya tiene reservas: márcalo como inactivo en lugar de eliminarlo' };
    }
    return { ok: false, error: traducirError(error) };
  }
  // Las filas de imágenes se borran en cascada; los archivos se limpian aparte.
  if (p.imagenes.length) await supabase.storage.from(BUCKET).remove(p.imagenes.map((i) => i.ruta));
  return { ok: true, data: undefined };
}

// ─── Fotos ────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodifica base64 sin depender de atob (no existe en todos los motores JS). */
export function base64ABytes(base64: string): Uint8Array {
  const limpio = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((limpio.length * 3) / 4));
  let j = 0;
  for (let i = 0; i < limpio.length; i += 4) {
    const n =
      (B64.indexOf(limpio[i]) << 18) |
      (B64.indexOf(limpio[i + 1]) << 12) |
      ((B64.indexOf(limpio[i + 2] ?? 'A') & 63) << 6) |
      (B64.indexOf(limpio[i + 3] ?? 'A') & 63);
    bytes[j++] = (n >> 16) & 255;
    if (i + 2 < limpio.length) bytes[j++] = (n >> 8) & 255;
    if (i + 3 < limpio.length) bytes[j++] = n & 255;
  }
  return bytes.slice(0, j);
}

const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function subirImagen(
  paqueteId: string,
  archivo: { base64: string; mimeType?: string | null },
  orden: number,
): Promise<Resultado<ImagenPaquete>> {
  const tipo = archivo.mimeType && EXTENSION[archivo.mimeType] ? archivo.mimeType : 'image/jpeg';
  const ruta = `${paqueteId}/${Date.now()}.${EXTENSION[tipo]}`;
  const subida = await supabase.storage
    .from(BUCKET)
    .upload(ruta, base64ABytes(archivo.base64), { contentType: tipo });
  if (subida.error) return { ok: false, error: traducirError(subida.error) };

  const { data, error } = await supabase
    .from('imagenes_paquete')
    .insert({ paquete_id: paqueteId, ruta, orden })
    .select('id, ruta, orden')
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([ruta]);
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data };
}

export async function eliminarImagen(imagen: ImagenPaquete): Promise<Resultado> {
  const { error } = await supabase.from('imagenes_paquete').delete().eq('id', imagen.id);
  if (error) return { ok: false, error: traducirError(error) };
  await supabase.storage.from(BUCKET).remove([imagen.ruta]);
  return { ok: true, data: undefined };
}

/** Pone la foto elegida de primera (portada) y renumera las demás. */
export async function hacerPortada(
  imagen: ImagenPaquete,
  todas: readonly ImagenPaquete[],
): Promise<Resultado> {
  const orden = [imagen, ...todas.filter((i) => i.id !== imagen.id)];
  const resultados = await Promise.all(
    orden.map((img, i) => supabase.from('imagenes_paquete').update({ orden: i }).eq('id', img.id)),
  );
  const fallo = resultados.find((r) => r.error)?.error;
  if (fallo) return { ok: false, error: traducirError(fallo) };
  return { ok: true, data: undefined };
}

// ─── Itinerario ───────────────────────────────────────────────

export type FormularioDia = { dia: string; titulo: string; descripcion: string };

export function validarDia(f: FormularioDia, duracionDias: number): Errores<keyof FormularioDia> {
  const errores: Errores<keyof FormularioDia> = {
    dia: validarEntero(f.dia, 1, duracionDias, `Entre el día 1 y el ${duracionDias}`),
    titulo: requerido(f.titulo, 'Indica el título del día'),
  };
  if (!errores.dia) delete errores.dia;
  if (!errores.titulo) delete errores.titulo;
  return errores;
}

export async function guardarDia(
  paqueteId: string,
  f: FormularioDia,
  id?: string,
): Promise<Resultado<DiaItinerario>> {
  const fila = { paquete_id: paqueteId, dia: Number(f.dia), titulo: f.titulo.trim(), descripcion: f.descripcion.trim() };
  const query = id
    ? supabase.from('itinerario_paquete').update(fila).eq('id', id)
    : supabase.from('itinerario_paquete').insert(fila);
  const { data, error } = await query.select().single();
  if (error) {
    if (error.code === '23505') return { ok: false, error: `El día ${f.dia} ya está en el itinerario` };
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data };
}

export async function eliminarDia(id: string): Promise<Resultado> {
  const { error } = await supabase.from('itinerario_paquete').delete().eq('id', id);
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: undefined };
}

// ─── Fechas de salida (HU-20) ─────────────────────────────────

export type FormularioFecha = {
  fechaSalida: string;
  fechaRegreso: string;
  cupos: string;
  estado: 'abierta' | 'cerrada';
};

export function validarFechaSalida(
  f: FormularioFecha,
  cuposReservados = 0,
): Errores<keyof FormularioFecha> {
  const errores: Errores<keyof FormularioFecha> = {
    fechaSalida: requerido(f.fechaSalida, 'Indica la fecha de salida') ?? validarFecha(f.fechaSalida),
    fechaRegreso: requerido(f.fechaRegreso, 'Indica la fecha de regreso') ?? validarFecha(f.fechaRegreso),
    cupos: validarEntero(f.cupos, 1, 500, 'Entre 1 y 500 cupos'),
  };
  if (!errores.fechaSalida && !errores.fechaRegreso && f.fechaRegreso.trim() < f.fechaSalida.trim()) {
    errores.fechaRegreso = 'Debe ser igual o posterior a la salida';
  }
  if (!errores.cupos && Number(f.cupos) < cuposReservados) {
    errores.cupos = `Ya hay ${cuposReservados} cupos reservados: no puede ser menor`;
  }
  for (const k of Object.keys(errores) as (keyof FormularioFecha)[]) {
    if (!errores[k]) delete errores[k];
  }
  return errores;
}

export async function guardarFecha(
  paqueteId: string,
  f: FormularioFecha,
  id?: string,
): Promise<Resultado<FechaSalida>> {
  const fila = {
    fecha_salida: f.fechaSalida.trim(),
    fecha_regreso: f.fechaRegreso.trim(),
    cupos_totales: Number(f.cupos),
    estado: f.estado,
  };
  const query = id
    ? supabase.from('fechas_salida').update(fila).eq('id', id)
    : supabase.from('fechas_salida').insert({ ...fila, paquete_id: paqueteId });
  const { data, error } = await query.select().single();
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya hay una salida programada ese día' };
    if (error.code === '23514') return { ok: false, error: 'Los cupos no pueden ser menos que los ya reservados' };
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data };
}

export async function eliminarFecha(id: string): Promise<Resultado> {
  const { error } = await supabase.from('fechas_salida').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') return { ok: false, error: 'La fecha tiene reservas: ciérrala en lugar de eliminarla' };
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data: undefined };
}
