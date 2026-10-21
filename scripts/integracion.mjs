// RNF-07 · Prueba de integración de punta a punta de los tres módulos, contra un proyecto Supabase real:
// API REST + RLS + Storage + Edge Functions, con un usuario por rol (visitante, cliente, asesor).
//
// Uso:  npm run test:integracion                    (lee .env)
//       CRON_SECRET=... npm run test:integracion    (prueba también alertas-vencimiento)
//
// Crea sus propios usuarios y datos de prueba (prefijo "IT <id>") y los borra al terminar, falle o no.
// Contra un proyecto remoto exige INTEGRACION_PRODUCCION=1: mientras corre, el paquete de prueba
// aparece unos segundos en el catálogo público.
import { createClient } from '@supabase/supabase-js';

import { estadoItem } from '../supabase/functions/_shared/licitaciones.ts';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
const region = process.env.REGION ?? 'us-west-2';
const LIMITE_COTIZADOR_MS = 5000;

if (!url || !anon || !servicio) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const local = /127\.0\.0\.1|localhost/.test(url);
if (!local && process.env.INTEGRACION_PRODUCCION !== '1') {
  console.error(`${url} no es local. Si de verdad quieres probar contra ese proyecto: INTEGRACION_PRODUCCION=1`);
  process.exit(1);
}

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
const servidor = createClient(url, servicio, opciones);
const visitante = createClient(url, anon, opciones);

const id = Date.now().toString(36);
const hoy = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
const enDias = (n) => new Date(Date.parse(`${hoy}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const creado = {
  usuarios: [],
  cotizaciones: [],
  rutas: [],
  tarifas: [],
  vehiculos: [],
  paquetes: [],
  documentos: [],
  procesos: [],
  archivos: { comprobantes: [], documentos: [] },
};
const resultados = [];

function esperar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

/** Lanza el error de Supabase o devuelve los datos. */
function datos({ data, error }, contexto) {
  if (error) throw new Error(`${contexto}: ${error.message}`);
  return data;
}

async function paso(nombre, fn) {
  const inicio = performance.now();
  try {
    const nota = await fn();
    const ms = Math.round(performance.now() - inicio);
    resultados.push({ nombre, ok: true });
    console.log(`  ✔ ${nombre} (${ms} ms)${nota ? ` · ${nota}` : ''}`);
  } catch (e) {
    resultados.push({ nombre, ok: false });
    console.log(`  ✘ ${nombre}\n      ${e.message}`);
    throw e;
  }
}

async function crearUsuario(rol) {
  const email = `it-${id}-${rol}@goldtrans.test`;
  const password = `Prueba-${id}-9`;
  const { user } = datos(
    await servidor.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        tipo_persona: 'persona',
        nombre_completo: `IT ${id} ${rol}`,
        tipo_documento: 'CC',
        numero_documento: `9${Date.now() % 1_000_000_000}`,
        telefono: '3100000000',
      },
    }),
    `crear ${rol}`,
  );
  creado.usuarios.push(user.id);
  if (rol !== 'cliente') datos(await servidor.from('usuarios').update({ rol }).eq('id', user.id), `rol ${rol}`);
  const cliente = createClient(url, anon, opciones);
  datos(await cliente.auth.signInWithPassword({ email, password }), `iniciar sesión ${rol}`);
  return { id: user.id, db: cliente };
}

async function invocar(cliente, funcion, body) {
  const { data, error } = await cliente.functions.invoke(funcion, { body, region });
  if (error) {
    const detalle = await error.context?.json?.().catch(() => null);
    throw new Error(`${funcion}: ${detalle?.error ?? error.message}`);
  }
  return data;
}

const PNG = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
);
const PDF = new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

let cliente;
let asesor;
let rutaId;
let reserva;
let documentoId;
let procesoId;

async function probar() {
  console.log('\nPreparación');
  await paso('crear cliente y asesor e iniciar sesión (Auth)', async () => {
    cliente = await crearUsuario('cliente');
    asesor = await crearUsuario('asesor');
  });

  // ─── Módulo 1 · Cotizador ──────────────────────────────────
  console.log('\nMódulo 1 · Cotizador y solicitudes');
  await paso('hay una ruta con vehículo y tarifa vigente (o se crea una de prueba)', async () => {
    const rutas = datos(await servidor.from('rutas').select('id').eq('activo', true).limit(1), 'rutas');
    if (rutas.length) {
      rutaId = rutas[0].id;
      return 'se usa una ruta existente';
    }
    const ruta = datos(
      await servidor.from('rutas').insert({ origen: `IT ${id} Origen`, destino: `IT ${id} Destino`, distancia_km: 50 }).select().single(),
      'ruta',
    );
    creado.rutas.push((rutaId = ruta.id));
    const placa = `ZZ${String.fromCharCode(65 + (Date.now() % 26))}${String(Date.now() % 1000).padStart(3, '0')}`;
    creado.vehiculos.push(
      datos(
        await servidor
          .from('vehiculos')
          .insert({ placa, tipo: 'bus', marca: 'IT', modelo: 'IT', anio: 2020, capacidad_pasajeros: 40 })
          .select()
          .single(),
        'vehículo',
      ).id,
    );
    creado.tarifas.push(
      datos(
        await servidor
          .from('tarifas')
          .insert({ tipo_vehiculo: 'bus', tarifa_base: 100000, valor_km: 2000, valor_dia: 200000, vigencia_desde: hoy })
          .select()
          .single(),
        'tarifa',
      ).id,
    );
    return 'datos de prueba creados';
  });

  const peticion = () => ({ ruta_id: rutaId, tipo_servicio: 'ida', fecha_inicio: enDias(1), pasajeros: 1 });
  await paso(`HU-05/13 · el visitante cotiza en menos de ${LIMITE_COTIZADOR_MS / 1000} s (RNF-04)`, async () => {
    const inicio = performance.now();
    const c = await invocar(visitante, 'calcular-tarifa', peticion());
    const ms = Math.round(performance.now() - inicio);
    creado.cotizaciones.push(c.id);
    esperar(c.valor_total > 0 && c.desglose.length > 0, 'la cotización no trae total ni desglose');
    esperar(ms < LIMITE_COTIZADOR_MS, `tardó ${ms} ms`);
    return `${c.codigo} · ${ms} ms`;
  });

  let solicitudId;
  await paso('HU-16 · el cliente cotiza con su sesión y formaliza la solicitud', async () => {
    const c = await invocar(cliente.db, 'calcular-tarifa', peticion());
    creado.cotizaciones.push(c.id);
    const propia = datos(await cliente.db.from('cotizaciones').select('usuario_id').eq('id', c.id).single(), 'leer');
    esperar(propia.usuario_id === cliente.id, 'la cotización no quedó a nombre del cliente');
    const s = datos(
      await cliente.db.rpc('crear_solicitud', {
        p_cotizacion_id: c.id,
        p_nombre_contacto: 'IT',
        p_telefono_contacto: '3100000000',
        p_direccion_recogida: 'Parque principal',
        p_hora_recogida: '06:30',
      }),
      'crear_solicitud',
    );
    solicitudId = s.id;
    esperar(s.estado === 'pendiente', `estado ${s.estado}`);
  });

  await paso('HU-17 · el asesor la confirma y el cliente lo ve', async () => {
    datos(await asesor.db.rpc('responder_solicitud', { p_solicitud_id: solicitudId, p_accion: 'confirmar' }), 'responder');
    const s = datos(await cliente.db.from('solicitudes').select('estado').eq('id', solicitudId).single(), 'leer');
    esperar(s.estado === 'confirmada', `estado ${s.estado}`);
  });

  // ─── Módulo 2 · Goldtours ──────────────────────────────────
  console.log('\nMódulo 2 · Goldtours, reservas y abonos');
  let fechaId;
  await paso('HU-18 · un paquete activo con foto aparece en el catálogo público', async () => {
    const p = datos(
      await servidor
        .from('paquetes')
        .insert({ nombre: `IT ${id} Paquete`, destino: 'Prueba', duracion_dias: 1, precio_por_persona: 100000, activo: true })
        .select()
        .single(),
      'paquete',
    );
    creado.paquetes.push(p.id);
    datos(await servidor.from('imagenes_paquete').insert({ paquete_id: p.id, ruta: `it/${id}.jpg` }), 'imagen');
    fechaId = datos(
      await servidor
        .from('fechas_salida')
        .insert({ paquete_id: p.id, fecha_salida: enDias(30), fecha_regreso: enDias(30), cupos_totales: 3 })
        .select()
        .single(),
      'fecha',
    ).id;
    const catalogo = datos(await visitante.from('paquetes').select('id').eq('id', p.id), 'catálogo');
    esperar(catalogo.length === 1, 'el visitante no ve el paquete');
  });

  await paso('HU-22 · el cliente reserva 2 cupos con sus viajeros', async () => {
    reserva = datos(
      await cliente.db.rpc('crear_reserva', {
        p_fecha_salida_id: fechaId,
        p_viajeros: [
          { nombre_completo: 'Viajero Uno', tipo_documento: 'CC', numero_documento: '7001', fecha_nacimiento: '1990-01-01' },
          { nombre_completo: 'Viajero Dos', tipo_documento: 'TI', numero_documento: '7002', fecha_nacimiento: '2012-01-01' },
        ],
        p_telefono_contacto: '3100000000',
      }),
      'crear_reserva',
    );
    const f = datos(await visitante.from('fechas_salida').select('cupos_disponibles').eq('id', fechaId).single(), 'fecha');
    esperar(reserva.estado === 'prerreserva' && f.cupos_disponibles === 1, `estado ${reserva.estado}, cupos ${f.cupos_disponibles}`);
    return reserva.codigo;
  });

  await paso('HU-23 · sube el comprobante a su carpeta privada y registra el abono mínimo', async () => {
    const ruta = `${cliente.id}/${reserva.id}/it-${id}.png`;
    datos(await cliente.db.storage.from('comprobantes').upload(ruta, PNG, { contentType: 'image/png' }), 'subir');
    creado.archivos.comprobantes.push(ruta);
    const ajena = await cliente.db.storage
      .from('comprobantes')
      .upload(`${asesor.id}/${reserva.id}/x.png`, PNG, { contentType: 'image/png' });
    esperar(ajena.error, 'RNF-06: el cliente pudo subir a una carpeta ajena');
    const a = datos(
      await cliente.db.rpc('registrar_abono', {
        p_reserva_id: reserva.id,
        p_valor: reserva.abono_minimo,
        p_fecha_transferencia: hoy,
        p_comprobante_ruta: ruta,
      }),
      'registrar_abono',
    );
    esperar(a.estado === 'pendiente' && a.comprobante_tipo === 'image/png', `abono ${a.estado} ${a.comprobante_tipo}`);
  });

  await paso('HU-24 · el asesor ve el comprobante (URL firmada) y aprueba: reserva confirmada', async () => {
    const abono = datos(await asesor.db.from('abonos').select('*').eq('reserva_id', reserva.id).single(), 'abono');
    const firmada = datos(await asesor.db.storage.from('comprobantes').createSignedUrl(abono.comprobante_ruta, 60), 'firmar');
    esperar((await fetch(firmada.signedUrl)).ok, 'la URL firmada no descarga el comprobante');
    datos(await asesor.db.rpc('verificar_abono', { p_abono_id: abono.id, p_accion: 'aprobar' }), 'verificar');
    const r = datos(await cliente.db.from('reservas').select('estado, saldo').eq('id', reserva.id).single(), 'reserva');
    esperar(r.estado === 'confirmada', `estado ${r.estado}`);
    return `saldo ${r.saldo}`;
  });

  await paso('RNF-02 · el visitante no ve reservas ni comprobantes', async () => {
    const r = await visitante.from('reservas').select('id');
    esperar(r.error || r.data.length === 0, 'el visitante ve reservas');
    const lista = await visitante.storage.from('comprobantes').list(cliente.id);
    esperar(lista.error || lista.data.length === 0, 'el visitante lista comprobantes');
  });

  // ─── Módulo 3 · Portal de licitaciones ─────────────────────
  console.log('\nMódulo 3 · Documentos y licitaciones');
  await paso('HU-27/28 · el asesor carga un documento con su vigencia', async () => {
    const categoria = datos(await asesor.db.from('categorias_doc').select('id').eq('nombre', 'Pólizas').single(), 'categoría');
    const ruta = `${categoria.id}/it-${id}.pdf`;
    datos(await asesor.db.storage.from('documentos').upload(ruta, PDF, { contentType: 'application/pdf' }), 'subir');
    creado.archivos.documentos.push(ruta);
    const d = datos(
      await asesor.db.rpc('crear_documento', {
        p_categoria_id: categoria.id,
        p_nombre: `IT ${id} Póliza`,
        p_ruta: ruta,
        p_nombre_archivo: 'poliza.pdf',
      }),
      'crear_documento',
    );
    creado.documentos.push((documentoId = d.id));
    datos(
      await asesor.db
        .from('vigencias')
        .insert({ documento_id: d.id, fecha_vencimiento: enDias(10), responsable_id: asesor.id }),
      'vigencia',
    );
  });

  await paso('RNF-02 · el cliente no ve el repositorio documental', async () => {
    const docs = datos(await cliente.db.from('documentos').select('id'), 'documentos');
    esperar(docs.length === 0, 'el cliente ve documentos');
  });

  await paso('HU-31/32 · proceso con lista de verificación: el documento vence antes del cierre', async () => {
    const p = datos(
      await asesor.db
        .from('procesos_licitacion')
        .insert({ numero: `IT-${id}`, entidad: 'Entidad de prueba', objeto: 'Integración', fecha_cierre: enDias(20) })
        .select()
        .single(),
      'proceso',
    );
    creado.procesos.push((procesoId = p.id));
    datos(
      await asesor.db.from('items_verificacion').insert({ proceso_id: p.id, requisito: 'Póliza RCE', documento_id: documentoId }),
      'requisito',
    );
    const item = datos(
      await asesor.db
        .from('items_verificacion')
        .select('documento_id, cumplido_manual, obligatorio, documento:documentos(vigencia:vigencias(fecha_vencimiento))')
        .eq('proceso_id', p.id)
        .single(),
      'leer requisito',
    );
    const estado = estadoItem(item, item.documento?.vigencia?.fecha_vencimiento ?? null, hoy, p.fecha_cierre);
    esperar(estado === 'vence_antes_cierre', `estado ${estado}`);
  });

  await paso('HU-33 · descarga el paquete ZIP y queda en la bitácora', async () => {
    const r = await invocar(asesor.db, 'descargar-paquete', { proceso_id: procesoId });
    const zip = new Uint8Array(await (await fetch(r.url)).arrayBuffer());
    esperar(zip[0] === 0x50 && zip[1] === 0x4b, 'el archivo descargado no es un ZIP');
    const bitacora = datos(await asesor.db.from('bitacora_descargas').select('documentos').eq('proceso_id', procesoId), 'bitácora');
    esperar(bitacora.length === 1 && bitacora[0].documentos === 1, 'la descarga no quedó registrada');
    return `${zip.byteLength} bytes`;
  });

  await paso('HU-33 · el cliente no puede descargar paquetes', async () => {
    const { error } = await cliente.db.functions.invoke('descargar-paquete', { body: { proceso_id: procesoId }, region });
    esperar(error, 'el cliente descargó un paquete');
  });

  if (process.env.CRON_SECRET) {
    await paso('HU-28 · la tarea diaria crea la alerta de 15 días para el responsable', async () => {
      const r = await fetch(`${url}/functions/v1/alertas-vencimiento`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      esperar(r.ok, `HTTP ${r.status}`);
      const alertas = datos(await asesor.db.from('alertas').select('umbral').eq('documento_id', documentoId), 'alertas');
      esperar(alertas.length === 1 && alertas[0].umbral === 15, `alertas ${JSON.stringify(alertas)}`);
    });
  } else {
    console.log('  − HU-28 · alertas-vencimiento: se omite (define CRON_SECRET para probarla)');
  }
}

async function limpiar() {
  const intentos = [
    async () => {
      for (const p of creado.procesos) {
        const lista = await servidor.storage.from('paquetes-licitacion').list(p);
        const rutas = (lista.data ?? []).map((o) => `${p}/${o.name}`);
        if (rutas.length) await servidor.storage.from('paquetes-licitacion').remove(rutas);
      }
      if (creado.procesos.length) await servidor.from('procesos_licitacion').delete().in('id', creado.procesos);
    },
    async () => creado.documentos.length && servidor.from('documentos').delete().in('id', creado.documentos),
    async () => creado.archivos.documentos.length && servidor.storage.from('documentos').remove(creado.archivos.documentos),
    async () => creado.usuarios.length && servidor.from('reservas').delete().in('usuario_id', creado.usuarios),
    async () => creado.archivos.comprobantes.length && servidor.storage.from('comprobantes').remove(creado.archivos.comprobantes),
    async () => creado.paquetes.length && servidor.from('paquetes').delete().in('id', creado.paquetes),
    async () => creado.usuarios.length && servidor.from('solicitudes').delete().in('usuario_id', creado.usuarios),
    async () => creado.cotizaciones.length && servidor.from('cotizaciones').delete().in('id', creado.cotizaciones),
    async () => creado.tarifas.length && servidor.from('tarifas').delete().in('id', creado.tarifas),
    async () => creado.vehiculos.length && servidor.from('vehiculos').delete().in('id', creado.vehiculos),
    async () => creado.rutas.length && servidor.from('rutas').delete().in('id', creado.rutas),
    async () => Promise.all(creado.usuarios.map((u) => servidor.auth.admin.deleteUser(u))),
  ];
  for (const intento of intentos) {
    try {
      const r = await intento();
      const error = Array.isArray(r) ? r.find((x) => x?.error)?.error : r?.error;
      if (error) console.warn('  ! limpieza:', error.message);
    } catch (e) {
      console.warn('  ! limpieza:', e.message);
    }
  }
}

console.log(`RNF-07 · Integración de punta a punta contra ${url} (${local ? 'local' : 'remoto'})`);
try {
  await probar();
} catch {
  // El detalle ya se imprimió en el paso que falló.
} finally {
  console.log('\nLimpieza de datos de prueba');
  await limpiar();
}

const fallos = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - fallos} de ${resultados.length} pasos en verde${fallos ? ' · HAY FALLOS' : ''}`);
process.exit(fallos ? 1 : 0);
