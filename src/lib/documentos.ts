// HU-27 · Repositorio documental de la empresa (solo asesor y admin).
// Cada documento conserva todas sus versiones en el bucket privado "documentos".
// HU-28 vigencias · HU-29 tablero Vigente / Por vencer / Vencido · HU-30 buscador.
import { borrarArchivo, subirArchivo, type ArchivoElegido } from '@/lib/archivos';
import { traducirError, type Resultado } from '@/lib/auth';
import { ESTADOS_VIGENCIA, estadoVigencia, type EstadoVigencia } from '@/lib/licitaciones';
import { supabase } from '@/lib/supabase';
import { requerido, validarFecha, type Errores } from '@/lib/validacion';
import type { Tables } from '@/types/database';

export type Categoria = Tables<'categorias_doc'>;
export type Documento = Tables<'documentos'>;
export type VersionDoc = Tables<'versiones_doc'>;

export type Vigencia = Tables<'vigencias'>;
export type VersionConAutor = VersionDoc & { autor: { email: string } | null };
export type DocumentoCompleto = Documento & { versiones: VersionConAutor[]; vigencia: Vigencia | null };

/** La versión vigente: la de mayor número. */
export function versionActual(d: Pick<DocumentoCompleto, 'versiones'>): VersionConAutor | null {
  return d.versiones.reduce<VersionConAutor | null>((max, v) => (!max || v.version > max.version ? v : max), null);
}

type Filtrable = Pick<Documento, 'nombre' | 'descripcion' | 'categoria_id'> & {
  vigencia?: Pick<Vigencia, 'fecha_vencimiento'> | null;
};

export function estadoDocumento(d: Pick<Filtrable, 'vigencia'>, hoy: string): EstadoVigencia {
  return estadoVigencia(d.vigencia?.fecha_vencimiento, hoy);
}

/** HU-30 · Buscador por nombre (o descripción), categoría y estado de vigencia. */
export function filtrarDocumentos<D extends Filtrable>(
  documentos: readonly D[],
  categoriaId: string, // '' = todas
  texto: string,
  estado: EstadoVigencia | '' = '',
  hoy = '',
): D[] {
  const buscado = sinTildes(texto.trim());
  return documentos
    .filter(
      (d) =>
        (!categoriaId || d.categoria_id === categoriaId) &&
        (!estado || estadoDocumento(d, hoy) === estado) &&
        (!buscado || sinTildes(`${d.nombre} ${d.descripcion}`).includes(buscado)),
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** HU-29 · Conteo del tablero documental. */
export function resumenTablero(documentos: readonly Pick<Filtrable, 'vigencia'>[], hoy: string): Record<EstadoVigencia, number> {
  const conteo = Object.fromEntries(ESTADOS_VIGENCIA.map((e) => [e, 0])) as Record<EstadoVigencia, number>;
  for (const d of documentos) conteo[estadoDocumento(d, hoy)]++;
  return conteo;
}

function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ─── Consultas ────────────────────────────────────────────────

export async function listarCategorias(): Promise<Resultado<Categoria[]>> {
  const { data, error } = await supabase.from('categorias_doc').select('*').order('orden').order('nombre');
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data };
}

export async function listarDocumentos(): Promise<Resultado<DocumentoCompleto[]>> {
  const { data, error } = await supabase.from('documentos').select('*, vigencia:vigencias(*), versiones:versiones_doc(*, autor:usuarios!versiones_doc_subido_por_fkey(email))').order('nombre');
  if (error) return { ok: false, error: traducirError(error) };
  const documentos = data as unknown as DocumentoCompleto[];
  for (const d of documentos) d.versiones.sort((a, b) => b.version - a.version);
  return { ok: true, data: documentos };
}

// ─── Formularios ──────────────────────────────────────────────

export type FormularioDocumento = {
  categoriaId: string;
  nombre: string;
  descripcion: string;
  notas: string;
};

export const DOCUMENTO_VACIO: FormularioDocumento = { categoriaId: '', nombre: '', descripcion: '', notas: '' };

/** Sin archivo = edición de los datos de un documento existente. */
export function validarDocumento(
  f: FormularioDocumento,
  archivo: ArchivoElegido | null,
  requiereArchivo: boolean,
): Errores<keyof FormularioDocumento | 'archivo'> {
  const errores: Errores<keyof FormularioDocumento | 'archivo'> = {
    categoriaId: f.categoriaId ? undefined : 'Elige la categoría',
    nombre: requerido(f.nombre, 'Indica el nombre del documento'),
    archivo: requiereArchivo && !archivo ? 'Adjunta el archivo' : undefined,
  };
  for (const k of Object.keys(errores) as (keyof typeof errores)[]) {
    if (!errores[k]) delete errores[k];
  }
  return errores;
}

const NOMBRE_REPETIDO = 'Ya hay un documento con ese nombre en la categoría';

/** Sube el archivo y crea el documento con su versión 1. */
export async function crearDocumento(f: FormularioDocumento, archivo: ArchivoElegido): Promise<Resultado<Documento>> {
  const subida = await subirArchivo('documentos', f.categoriaId, archivo);
  if (!subida.ok) return subida;
  const { data, error } = await supabase.rpc('crear_documento', {
    p_categoria_id: f.categoriaId,
    p_nombre: f.nombre.trim(),
    p_ruta: subida.data,
    p_nombre_archivo: archivo.nombre,
    p_descripcion: f.descripcion.trim() || null,
    p_notas: f.notas.trim() || null,
  });
  if (error) {
    await borrarArchivo('documentos', subida.data);
    if (error.code === '23505') return { ok: false, error: NOMBRE_REPETIDO };
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data };
}

/** Sube una versión nueva; las anteriores quedan en el historial. */
export async function agregarVersion(
  documento: Pick<Documento, 'id' | 'categoria_id'>,
  archivo: ArchivoElegido,
  notas: string,
): Promise<Resultado<VersionDoc>> {
  const subida = await subirArchivo('documentos', documento.categoria_id, archivo);
  if (!subida.ok) return subida;
  const { data, error } = await supabase.rpc('agregar_version_documento', {
    p_documento_id: documento.id,
    p_ruta: subida.data,
    p_nombre_archivo: archivo.nombre,
    p_notas: notas.trim() || null,
  });
  if (error) {
    await borrarArchivo('documentos', subida.data);
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data };
}

export async function actualizarDocumento(id: string, f: FormularioDocumento): Promise<Resultado> {
  const { error } = await supabase
    .from('documentos')
    .update({ categoria_id: f.categoriaId, nombre: f.nombre.trim(), descripcion: f.descripcion.trim() })
    .eq('id', id);
  if (error) {
    if (error.code === '23505') return { ok: false, error: NOMBRE_REPETIDO };
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data: undefined };
}

/** Solo admin. Borra el documento con todas sus versiones y sus archivos. */
export async function eliminarDocumento(d: DocumentoCompleto): Promise<Resultado> {
  const { error } = await supabase.from('documentos').delete().eq('id', d.id);
  if (error) return { ok: false, error: traducirError(error) };
  if (d.versiones.length) await supabase.storage.from('documentos').remove(d.versiones.map((v) => v.ruta));
  return { ok: true, data: undefined };
}

export async function crearCategoria(nombre: string, descripcion: string): Promise<Resultado<Categoria>> {
  const { data, error } = await supabase
    .from('categorias_doc')
    .insert({ nombre: nombre.trim(), descripcion: descripcion.trim(), orden: 100 })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya existe una categoría con ese nombre' };
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data };
}

// ─── Vigencias (HU-28) ────────────────────────────────────────

export type Personal = { id: string; email: string; rol: string; nombre: string };

/** Asesores y administradores activos: los posibles responsables de una vigencia o un proceso. */
export async function listarPersonal(): Promise<Resultado<Personal[]>> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, rol, perfil:perfiles(nombre_completo)')
    .in('rol', ['asesor', 'admin'])
    .eq('activo', true)
    .order('email');
  if (error) return { ok: false, error: traducirError(error) };
  return {
    ok: true,
    data: data.map((u) => ({ id: u.id, email: u.email, rol: u.rol, nombre: u.perfil?.nombre_completo || u.email })),
  };
}

export type FormularioVigencia = {
  fechaExpedicion: string;
  fechaVencimiento: string;
  responsableId: string;
  notas: string;
};

export function vigenciaAFormulario(v: Vigencia | null, responsablePorDefecto: string): FormularioVigencia {
  return {
    fechaExpedicion: v?.fecha_expedicion ?? '',
    fechaVencimiento: v?.fecha_vencimiento ?? '',
    responsableId: v?.responsable_id ?? responsablePorDefecto,
    notas: v?.notas ?? '',
  };
}

export function validarVigencia(f: FormularioVigencia): Errores<keyof FormularioVigencia> {
  const errores: Errores<keyof FormularioVigencia> = {
    fechaExpedicion: validarFecha(f.fechaExpedicion),
    fechaVencimiento: requerido(f.fechaVencimiento, 'Indica la fecha de vencimiento') ?? validarFecha(f.fechaVencimiento),
    responsableId: f.responsableId ? undefined : 'Elige quién recibe las alertas',
  };
  if (
    !errores.fechaExpedicion &&
    !errores.fechaVencimiento &&
    f.fechaExpedicion.trim() &&
    f.fechaExpedicion.trim() > f.fechaVencimiento.trim()
  ) {
    errores.fechaVencimiento = 'Debe ser posterior a la expedición';
  }
  for (const k of Object.keys(errores) as (keyof FormularioVigencia)[]) {
    if (!errores[k]) delete errores[k];
  }
  return errores;
}

export async function guardarVigencia(documentoId: string, f: FormularioVigencia): Promise<Resultado> {
  const { error } = await supabase.from('vigencias').upsert({
    documento_id: documentoId,
    fecha_expedicion: f.fechaExpedicion.trim() || null,
    fecha_vencimiento: f.fechaVencimiento.trim(),
    responsable_id: f.responsableId,
    notas: f.notas.trim() || null,
  });
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: undefined };
}

/** Para documentos que no vencen (p. ej. el RUT). */
export async function quitarVigencia(documentoId: string): Promise<Resultado> {
  const { error } = await supabase.from('vigencias').delete().eq('documento_id', documentoId);
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: undefined };
}
