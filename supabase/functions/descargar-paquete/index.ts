// Sprint 5 · Edge Function descargar-paquete
// HU-33 · Arma un ZIP con la versión vigente de cada documento de la lista de verificación de un
// proceso, más un 00-INDICE.txt con el estado de cada requisito. Lo guarda en el bucket privado
// "paquetes-licitacion", registra la descarga en bitacora_descargas y devuelve una URL firmada (10 min).
//
// POST { proceso_id }. Solo asesor o admin. Se despliega con verify_jwt = false (la app usa una
// publishable key); el usuario se identifica con el JWT de su sesión.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { strToU8, zipSync, type Zippable } from 'npm:fflate@0.8.2';

import { hoyEnColombia } from '../_shared/calculo.ts';
import {
  MAX_PAQUETE_BYTES,
  cumplimiento,
  estadoItem,
  nombreEnPaquete,
  type EstadoItem,
} from '../_shared/licitaciones.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ETIQUETA: Record<EstadoItem, string> = {
  cumple: 'CUMPLE',
  vence_antes_cierre: 'VENCE ANTES DEL CIERRE',
  vencido: 'VENCIDO',
  pendiente: 'PENDIENTE',
};

const EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

/** Clave con permisos de servidor: la legada (JWT) o la nueva sb_secret_. */
function claveServicio(): string {
  const legada = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legada) return legada;
  const nuevas = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
  return nuevas.default ?? Object.values(nuevas)[0] ?? '';
}

const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', claveServicio(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function responder(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Id del usuario si es un asesor o administrador activo; null en otro caso. */
async function personalDeLaPeticion(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (token.split('.').length !== 3) return null;
  const { data } = await db.auth.getUser(token);
  if (!data.user) return null;
  const { data: u } = await db.from('usuarios').select('rol, activo').eq('id', data.user.id).maybeSingle();
  return u?.activo && (u.rol === 'asesor' || u.rol === 'admin') ? data.user.id : null;
}

type Item = {
  id: string;
  orden: number;
  requisito: string;
  obligatorio: boolean;
  documento_id: string | null;
  cumplido_manual: boolean;
  documento: {
    id: string;
    nombre: string;
    version_actual: number;
    vigencia: { fecha_vencimiento: string } | null;
    versiones: { version: number; ruta: string; tipo_mime: string; tamano_bytes: number }[];
  } | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const usuarioId = await personalDeLaPeticion(req);
  if (!usuarioId) return responder({ error: 'Solo asesores y administradores descargan paquetes' }, 403);

  let procesoId: unknown;
  try {
    procesoId = (await req.json())?.proceso_id;
  } catch {
    return responder({ error: 'Solicitud inválida' }, 400);
  }
  if (typeof procesoId !== 'string' || !/^[0-9a-f-]{36}$/i.test(procesoId)) {
    return responder({ error: 'Proceso no válido' }, 400);
  }

  const { data: proceso, error } = await db
    .from('procesos_licitacion')
    .select(
      'id, numero, entidad, objeto, fecha_cierre, items:items_verificacion(id, orden, requisito, obligatorio, documento_id, cumplido_manual, documento:documentos(id, nombre, version_actual, vigencia:vigencias(fecha_vencimiento), versiones:versiones_doc(version, ruta, tipo_mime, tamano_bytes)))',
    )
    .eq('id', procesoId)
    .maybeSingle();
  if (error) return responder({ error: error.message }, 500);
  if (!proceso) return responder({ error: 'El proceso no existe' }, 404);

  const hoy = hoyEnColombia();
  const items = (proceso.items as unknown as Item[])
    .sort((a, b) => a.orden - b.orden)
    .map((i) => ({
      ...i,
      estado: estadoItem(i, i.documento?.vigencia?.fecha_vencimiento ?? null, hoy, proceso.fecha_cierre),
    }));

  // Un archivo por documento: si dos requisitos usan el mismo, va una vez con el nombre del primero.
  const archivos: { nombre: string; ruta: string; tamano: number; documentoId: string; requisito: string }[] = [];
  items.forEach((item, i) => {
    const d = item.documento;
    if (!d || archivos.some((a) => a.documentoId === d.id)) return;
    const v = d.versiones.find((x) => x.version === d.version_actual);
    if (!v) return;
    archivos.push({
      nombre: nombreEnPaquete(i + 1, item.requisito, EXTENSION[v.tipo_mime] ?? 'bin'),
      ruta: v.ruta,
      tamano: v.tamano_bytes,
      documentoId: d.id,
      requisito: item.requisito,
    });
  });
  if (!archivos.length) return responder({ error: 'La lista de verificación no tiene documentos vinculados' }, 422);

  const total = archivos.reduce((s, a) => s + a.tamano, 0);
  if (total > MAX_PAQUETE_BYTES) {
    return responder({ error: 'El paquete supera 100 MB. Descarga los documentos más pesados por separado' }, 422);
  }

  const contenido: Zippable = {};
  const descargas = await Promise.all(archivos.map((a) => db.storage.from('documentos').download(a.ruta)));
  for (let k = 0; k < archivos.length; k++) {
    const { data, error: e } = descargas[k];
    if (e || !data) return responder({ error: `No se pudo leer «${archivos[k].requisito}»` }, 500);
    // Los PDF e imágenes ya vienen comprimidos: se guardan tal cual.
    contenido[archivos[k].nombre] = [new Uint8Array(await data.arrayBuffer()), { level: 0 }];
  }

  const resumen = cumplimiento(items);
  const vencidos = items.filter((i) => i.estado === 'vencido').length;
  const lineas = [
    'GOLDTRANS S.A.S. - Paquete de documentos',
    `Proceso: ${proceso.numero} - ${proceso.entidad}`,
    `Objeto: ${proceso.objeto}`,
    `Fecha de cierre: ${proceso.fecha_cierre}`,
    `Generado: ${hoy}`,
    `Cumplimiento: ${resumen.porcentaje} % (${resumen.cumplidos} de ${resumen.total} requisitos)`,
    '',
  ];
  items.forEach((i, n) => {
    lineas.push(`${String(n + 1).padStart(2, '0')}. [${ETIQUETA[i.estado]}] ${i.requisito}${i.obligatorio ? '' : ' (opcional)'}`);
    const archivo = i.documento ? archivos.find((a) => a.documentoId === i.documento?.id) : undefined;
    const vence = i.documento?.vigencia?.fecha_vencimiento;
    if (archivo) lineas.push(`    -> ${archivo.nombre}${vence ? ` (vence ${vence})` : ''}`);
    else if (i.cumplido_manual) lineas.push('    -> se entrega por fuera del repositorio');
  });
  contenido['00-INDICE.txt'] = strToU8(lineas.join('\r\n'));

  const zip = zipSync(contenido);
  const carpeta = proceso.id;
  const ruta = `${carpeta}/${Date.now()}.zip`;
  const subida = await db.storage.from('paquetes-licitacion').upload(ruta, zip, { contentType: 'application/zip' });
  if (subida.error) return responder({ error: subida.error.message }, 500);

  // Solo se conserva el último paquete de cada proceso.
  const anteriores = await db.storage.from('paquetes-licitacion').list(carpeta);
  const borrar = (anteriores.data ?? []).map((o) => `${carpeta}/${o.name}`).filter((r) => r !== ruta);
  if (borrar.length) await db.storage.from('paquetes-licitacion').remove(borrar);

  await db.from('bitacora_descargas').insert({
    proceso_id: proceso.id,
    usuario_id: usuarioId,
    documentos: archivos.length,
    vencidos,
    tamano_bytes: zip.byteLength,
    ruta,
  });

  const nombre = `paquete-${proceso.numero.replace(/[^A-Za-z0-9-]+/g, '-')}.zip`;
  const firmada = await db.storage.from('paquetes-licitacion').createSignedUrl(ruta, 600, { download: nombre });
  if (firmada.error) return responder({ error: firmada.error.message }, 500);

  return responder({
    url: firmada.data.signedUrl,
    nombre,
    documentos: archivos.length,
    vencidos,
    tamano_bytes: zip.byteLength,
  });
});
