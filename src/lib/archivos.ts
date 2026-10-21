// RNF-06 · Archivos en buckets privados de Supabase Storage: selección, subida y URLs firmadas.
// Los tipos y tamaños permitidos son los mismos que exige cada bucket (migración del Sprint 4).
import * as DocumentPicker from 'expo-document-picker';
import { File as ArchivoLocal } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';

import { traducirError, type Resultado } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export type Bucket = 'comprobantes' | 'documentos';

export type ArchivoElegido = {
  uri: string;
  nombre: string;
  tipo: string;
  /** null si el sistema no informa el tamaño (el bucket lo valida igual). */
  tamano: number | null;
  /** Solo en web: el archivo que entrega el navegador. */
  web?: Blob;
};

const MB = 1024 * 1024;

export const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

export const REGLAS: Record<Bucket, { tipos: readonly string[]; maximo: number; ayuda: string }> = {
  comprobantes: {
    tipos: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maximo: 5 * MB,
    ayuda: 'Foto, captura o PDF de hasta 5 MB',
  },
  documentos: {
    tipos: Object.keys(EXTENSIONES),
    maximo: 20 * MB,
    ayuda: 'PDF, imagen, Word o Excel de hasta 20 MB',
  },
};

/** Tipo MIME según la extensión, para cuando el sistema no lo informa. */
export function tipoPorNombre(nombre: string): string | null {
  const extension = nombre.split('?')[0].split('.').pop()?.toLowerCase();
  if (extension === 'jpeg') return 'image/jpeg';
  return Object.entries(EXTENSIONES).find(([, e]) => e === extension)?.[0] ?? null;
}

export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / MB).toFixed(1).replace('.', ',')} MB`;
}

export function validarArchivo(a: Pick<ArchivoElegido, 'tipo' | 'tamano'>, bucket: Bucket): string | undefined {
  const reglas = REGLAS[bucket];
  if (!reglas.tipos.includes(a.tipo)) return `Tipo de archivo no permitido. ${reglas.ayuda}`;
  if (a.tamano !== null && a.tamano > reglas.maximo) {
    return `El archivo pesa ${formatearTamano(a.tamano)}: el máximo es ${formatearTamano(reglas.maximo)}`;
  }
}

/** Ruta única dentro de la carpeta: <carpeta>/<marca de tiempo>-<aleatorio>.<ext> */
export function rutaArchivo(carpeta: string, tipo: string, ahora = Date.now()): string {
  const aleatorio = Math.random().toString(36).slice(2, 8);
  return `${carpeta}/${ahora}-${aleatorio}.${EXTENSIONES[tipo] ?? 'bin'}`;
}

/** Foto o captura de pantalla desde la galería. */
export async function elegirImagen(): Promise<ArchivoElegido | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  const a = r.canceled ? null : r.assets[0];
  if (!a) return null;
  const nombre = a.fileName ?? a.uri.split('/').pop() ?? 'imagen.jpg';
  return {
    uri: a.uri,
    nombre,
    tipo: a.mimeType ?? tipoPorNombre(nombre) ?? 'image/jpeg',
    tamano: a.fileSize ?? null,
    web: a.file,
  };
}

/** Archivo desde el explorador del teléfono (PDF, Word, Excel...). */
export async function elegirDocumento(bucket: Bucket): Promise<ArchivoElegido | null> {
  const r = await DocumentPicker.getDocumentAsync({
    type: [...REGLAS[bucket].tipos],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const a = r.canceled ? null : r.assets[0];
  if (!a) return null;
  return {
    uri: a.uri,
    nombre: a.name,
    tipo: a.mimeType ?? tipoPorNombre(a.name) ?? 'application/octet-stream',
    tamano: a.size ?? null,
    web: a.file,
  };
}

async function leerBytes(a: ArchivoElegido): Promise<ArrayBuffer> {
  if (a.web) return a.web.arrayBuffer();
  return new ArchivoLocal(a.uri).arrayBuffer();
}

/** Sube el archivo a la carpeta del bucket y devuelve su ruta. Nunca reemplaza otro archivo. */
export async function subirArchivo(
  bucket: Bucket,
  carpeta: string,
  archivo: ArchivoElegido,
): Promise<Resultado<string>> {
  const invalido = validarArchivo(archivo, bucket);
  if (invalido) return { ok: false, error: invalido };

  let bytes: ArrayBuffer;
  try {
    bytes = await leerBytes(archivo);
  } catch {
    return { ok: false, error: 'No se pudo leer el archivo. Inténtalo de nuevo' };
  }
  const ruta = rutaArchivo(carpeta, archivo.tipo);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(ruta, bytes, { contentType: archivo.tipo, upsert: false });
  if (error) {
    if (/exceeded|too large/i.test(error.message)) {
      return { ok: false, error: `El archivo supera ${formatearTamano(REGLAS[bucket].maximo)}` };
    }
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data: ruta };
}

export async function borrarArchivo(bucket: Bucket, ruta: string): Promise<void> {
  await supabase.storage.from(bucket).remove([ruta]);
}

/** Los buckets son privados: cada vista usa una URL firmada que vence en 5 minutos. */
export const DURACION_URL_FIRMADA = 300;

export async function urlFirmada(bucket: Bucket, ruta: string): Promise<Resultado<string>> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(ruta, DURACION_URL_FIRMADA);
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: data.signedUrl };
}

/** Abre el archivo en el visor del sistema (PDF, Word...) o en el navegador. */
export async function abrirArchivo(bucket: Bucket, ruta: string): Promise<Resultado> {
  const url = await urlFirmada(bucket, ruta);
  if (!url.ok) return url;
  try {
    await Linking.openURL(url.data);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: 'No se pudo abrir el archivo' };
  }
}
