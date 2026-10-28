// Datos de ejemplo para presentar la app: tarifas por jornada, ventas (cotizaciones, solicitudes,
// reservas y abonos) y documentos del portal de licitaciones, en distintos estados.
//
// Uso:  npm run demo:crear     crea los datos (lee .env)
//       npm run demo:borrar    borra todo lo que creó
//
// Requiere la migración 20261029000000_tarifas_jornada.sql aplicada y calcular-tarifa desplegada.
// Contra un proyecto remoto exige DEMO_PRODUCCION=1: los datos se ven en la app real.
// Lo creado queda en scripts/.datos-ejemplo.json (fuera de git), con las cuentas de ejemplo para
// iniciar sesión. Los usuarios son demo-*@goldtrans.test y los nombres de entidades dicen "(ejemplo)".
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
const region = process.env.REGION ?? 'us-west-2';
const MANIFIESTO = new URL('./.datos-ejemplo.json', import.meta.url);
const NOTA = 'Dato de ejemplo (scripts/datos-ejemplo.mjs)';

const accion = process.argv[2];
if (!['--crear', '--borrar'].includes(accion)) {
  console.error('Uso: node --env-file=.env scripts/datos-ejemplo.mjs --crear | --borrar');
  process.exit(1);
}
if (!url || !anon || !servicio) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const local = /127\.0\.0\.1|localhost/.test(url);
if (!local && process.env.DEMO_PRODUCCION !== '1') {
  console.error(`${url} no es local. Para cargar los ejemplos en ese proyecto: DEMO_PRODUCCION=1`);
  process.exit(1);
}

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
const servidor = createClient(url, servicio, opciones);

const hoy = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
const enDias = (n) => new Date(Date.parse(`${hoy}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Lanza el error de Supabase o devuelve los datos. */
function datos({ data, error }, contexto) {
  if (error) throw new Error(`${contexto}: ${error.message}`);
  return data;
}

async function invocar(cliente, funcion, body) {
  const { data, error } = await cliente.functions.invoke(funcion, { body, region });
  if (error) {
    const detalle = await error.context?.json?.().catch(() => null);
    throw new Error(`${funcion}: ${detalle?.error ?? error.message}`);
  }
  return data;
}

/** PDF de una página con texto (Helvetica), para comprobantes y documentos de ejemplo. */
function pdf(titulo, lineas) {
  const esc = (t) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  const texto = [`/F1 18 Tf (${esc(titulo)}) Tj`, '/F1 11 Tf', ...lineas.map((l) => `T* (${esc(l)}) Tj`)].join('\n');
  const contenido = `BT 60 770 Td 18 TL\n${texto}\nT* T* (${esc(NOTA)}) Tj\nET`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(contenido, 'latin1')} >>\nstream\n${contenido}\nendstream`,
  ];
  let salida = '%PDF-1.4\n';
  const posiciones = objetos.map((o, i) => {
    const pos = Buffer.byteLength(salida, 'latin1');
    salida += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return pos;
  });
  const xref = Buffer.byteLength(salida, 'latin1');
  salida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  salida += posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  salida += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(salida, 'latin1'));
}

// ─── Manifiesto: todo lo creado, para poder borrarlo ──────────

const vacio = () => ({
  url,
  creado_at: new Date().toISOString(),
  cuentas: [],
  usuarios: [],
  vehiculos: [],
  rutas: [],
  tarifas: [],
  fechas_salida: [],
  cotizaciones: [],
  documentos: [],
  procesos: [],
  archivos: { comprobantes: [], documentos: [] },
});
let m = vacio();
const guardar = () => writeFileSync(MANIFIESTO, JSON.stringify(m, null, 2));

// ─── Crear ────────────────────────────────────────────────────

async function crearUsuario(rol, perfil) {
  const email = `demo-${perfil.clave}@goldtrans.test`;
  const password = `Demo-${randomBytes(6).toString('hex')}`;
  const { user } = datos(
    await servidor.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { telefono: '3200000000', ciudad: 'La Hormiga', ...perfil.metadata },
    }),
    `crear ${email}`,
  );
  m.usuarios.push(user.id);
  m.cuentas.push({ email, password, rol });
  guardar();
  if (rol !== 'cliente') datos(await servidor.from('usuarios').update({ rol }).eq('id', user.id), `rol ${rol}`);
  const db = createClient(url, anon, opciones);
  datos(await db.auth.signInWithPassword({ email, password }), `iniciar sesión ${email}`);
  return { id: user.id, email, db };
}

async function ruta(origen, destino, km, horas) {
  const existentes = datos(await servidor.from('rutas').select('id, origen, destino'), 'rutas');
  const igual = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const r = existentes.find((x) => igual(x.origen, origen) && igual(x.destino, destino));
  if (r) return r.id;
  const nueva = datos(
    await servidor.from('rutas').insert({ origen, destino, distancia_km: km, duracion_horas: horas }).select().single(),
    `ruta ${origen} → ${destino}`,
  );
  m.rutas.push(nueva.id);
  guardar();
  return nueva.id;
}

/** Inserta la tarifa; si ya hay una vigente que se superpone, la deja como está. */
async function tarifa(fila) {
  const { data, error } = await servidor
    .from('tarifas')
    .insert({ km_incluidos_dia: 150, valor_km_adicional: 1500, vigencia_desde: '2026-01-01', ...fila })
    .select()
    .single();
  if (error?.code === '23P01') return 'ya existía';
  datos({ data, error }, `tarifa ${fila.tipo_vehiculo} ${fila.jornada_horas} h`);
  m.tarifas.push(data.id);
  guardar();
  return 'creada';
}

async function crear() {
  if (existsSync(MANIFIESTO)) {
    console.error('Ya hay datos de ejemplo (scripts/.datos-ejemplo.json). Bórralos primero: npm run demo:borrar');
    process.exit(1);
  }
  const columnas = await servidor.from('tarifas').select('jornada_horas').limit(1);
  if (columnas.error) {
    console.error('La tabla tarifas no tiene jornada_horas: aplica antes la migración 20261029000000_tarifas_jornada.sql');
    process.exit(1);
  }
  guardar();

  console.log('\nUsuarios de ejemplo');
  const asesor = await crearUsuario('asesor', {
    clave: 'asesora',
    metadata: { tipo_persona: 'persona', nombre_completo: 'Laura Asesora (ejemplo)', tipo_documento: 'CC', numero_documento: '1000000001' },
  });
  const empresa1 = await crearUsuario('cliente', {
    clave: 'agro',
    metadata: { tipo_persona: 'empresa', nombre_completo: 'Carlos Ruiz', razon_social: 'Agroindustrias del Sur S.A.S. (ejemplo)', nit: '900000001-1', ciudad: 'Puerto Asís' },
  });
  const empresa2 = await crearUsuario('cliente', {
    clave: 'petro',
    metadata: { tipo_persona: 'empresa', nombre_completo: 'Diana Paz', razon_social: 'Servicios Petroleros Amazonía Ltda. (ejemplo)', nit: '900000002-2', ciudad: 'Orito' },
  });
  const persona = await crearUsuario('cliente', {
    clave: 'familia',
    metadata: { tipo_persona: 'persona', nombre_completo: 'Andrea Gómez (ejemplo)', tipo_documento: 'CC', numero_documento: '1000000002' },
  });
  console.log(`  ✔ 1 asesora y 3 clientes (${m.cuentas.map((c) => c.email).join(', ')})`);

  // ─── Flota, rutas y tarifas ─────────────────────────────────
  console.log('\nFlota, rutas y tarifas');
  const flota = [
    { placa: 'DMO101', tipo: 'camioneta', marca: 'Toyota', modelo: 'Hilux 4x4', anio: 2025, capacidad_pasajeros: 4 },
    { placa: 'DMO102', tipo: 'campero', marca: 'Toyota', modelo: 'Land Cruiser', anio: 2022, capacidad_pasajeros: 5 },
    { placa: 'DMO103', tipo: 'van', marca: 'Renault', modelo: 'Master', anio: 2023, capacidad_pasajeros: 15 },
    { placa: 'DMO104', tipo: 'bus', marca: 'Chevrolet', modelo: 'NPR', anio: 2021, capacidad_pasajeros: 40 },
  ];
  for (const v of flota) {
    m.vehiculos.push(datos(await servidor.from('vehiculos').insert(v).select().single(), `vehículo ${v.placa}`).id);
  }
  guardar();
  console.log(`  ✔ ${flota.length} vehículos (placas DMO101 a DMO104)`);

  const rutas = {
    paHormiga: await ruta('Puerto Asís', 'La Hormiga', 62, 1.5),
    mocoaHormiga: await ruta('Mocoa', 'La Hormiga', 140, 3.5),
    mocoaPa: await ruta('Mocoa', 'Puerto Asís', 95, 2.5),
    hormigaDorada: await ruta('La Hormiga', 'La Dorada', 30, 1),
    hormigaOrito: await ruta('La Hormiga', 'Orito', 45, 1),
  };
  console.log(`  ✔ rutas listas (${m.rutas.length} nuevas)`);

  // Valores de las cotizaciones oficiales (docs/tarifas.md); los demás, simulados.
  const tarifas = [
    { tipo_vehiculo: 'camioneta', jornada_horas: 12, valor_jornada: 580000 },
    { tipo_vehiculo: 'camioneta', jornada_horas: 8, valor_jornada: 480000 },
    { tipo_vehiculo: 'camioneta', jornada_horas: 4, valor_jornada: 350000 },
    { tipo_vehiculo: 'campero', jornada_horas: 12, valor_jornada: 540000 },
    { tipo_vehiculo: 'campero', jornada_horas: 8, valor_jornada: 450000 },
    { tipo_vehiculo: 'van', jornada_horas: 12, valor_jornada: 850000, valor_km_adicional: 2200 },
    { tipo_vehiculo: 'bus', jornada_horas: 12, valor_jornada: 1600000, km_incluidos_dia: 200, valor_km_adicional: 3500, recargo_fin_semana_pct: 10 },
    // Precios especiales por ruta (SERVIEVENTOS)
    { tipo_vehiculo: 'camioneta', jornada_horas: 8, valor_jornada: 780000, ruta_id: rutas.paHormiga },
    { tipo_vehiculo: 'camioneta', jornada_horas: 8, valor_jornada: 850000, ruta_id: rutas.mocoaHormiga },
    { tipo_vehiculo: 'camioneta', jornada_horas: 8, valor_jornada: 780000, ruta_id: rutas.mocoaPa },
    { tipo_vehiculo: 'camioneta', jornada_horas: 4, valor_jornada: 650000, ruta_id: rutas.hormigaDorada },
    { tipo_vehiculo: 'campero', jornada_horas: 8, valor_jornada: 750000, ruta_id: rutas.paHormiga },
  ];
  let existian = 0;
  for (const t of tarifas) if ((await tarifa(t)) === 'ya existía') existian++;
  console.log(`  ✔ ${m.tarifas.length} tarifas creadas${existian ? ` (${existian} ya existían y se dejaron igual)` : ''}`);

  // ─── Ventas: cotizaciones y solicitudes ─────────────────────
  console.log('\nVentas · cotizaciones y solicitudes');
  const casos = [
    { c: empresa1, ruta: rutas.paHormiga, servicio: 'ida_vuelta', inicio: 7, fin: 7, pasajeros: 4, jornada: 12, respuesta: 'confirmar' },
    { c: empresa1, ruta: rutas.mocoaHormiga, servicio: 'disponibilidad', inicio: 14, fin: 18, pasajeros: 3, jornada: 12, respuesta: 'ajustar', valor: 2600000, motivo: 'Descuento por contrato de 5 días' },
    { c: empresa2, ruta: rutas.hormigaOrito, servicio: 'disponibilidad', inicio: 10, fin: 12, pasajeros: 4, jornada: 8 },
    { c: empresa2, ruta: rutas.mocoaPa, servicio: 'ida', inicio: 5, fin: 5, pasajeros: 12, jornada: 12, respuesta: 'rechazar', motivo: 'No hay van disponible esa fecha; se ofreció otra' },
    { c: persona, ruta: rutas.hormigaDorada, servicio: 'ida_vuelta', inicio: 3, fin: 3, pasajeros: 4, jornada: 4 },
    { c: persona, ruta: rutas.paHormiga, servicio: 'ida', inicio: 20, fin: 20, pasajeros: 30, jornada: 12, cancelar: true },
  ];
  const conteo = {};
  for (const k of casos) {
    const cot = await invocar(k.c.db, 'calcular-tarifa', {
      ruta_id: k.ruta,
      tipo_servicio: k.servicio,
      fecha_inicio: enDias(k.inicio),
      fecha_fin: enDias(k.fin),
      pasajeros: k.pasajeros,
      jornada_horas: k.jornada,
    });
    m.cotizaciones.push(cot.id);
    guardar();
    const s = datos(
      await k.c.db.rpc('crear_solicitud', {
        p_cotizacion_id: cot.id,
        p_nombre_contacto: 'Contacto de ejemplo',
        p_telefono_contacto: '3200000000',
        p_direccion_recogida: 'Parque principal',
        p_hora_recogida: '06:30',
        p_observaciones: NOTA,
      }),
      'crear_solicitud',
    );
    let estado = 'pendiente';
    if (k.respuesta) {
      estado = datos(
        await asesor.db.rpc('responder_solicitud', {
          p_solicitud_id: s.id,
          p_accion: k.respuesta,
          p_valor: k.valor ?? null,
          p_motivo: k.motivo ?? null,
        }),
        'responder_solicitud',
      ).estado;
    }
    if (k.cancelar) {
      estado = datos(await k.c.db.rpc('decidir_solicitud', { p_solicitud_id: s.id, p_accion: 'cancelar' }), 'cancelar').estado;
    }
    conteo[estado] = (conteo[estado] ?? 0) + 1;
  }
  console.log(`  ✔ ${casos.length} cotizaciones con solicitud: ${Object.entries(conteo).map(([e, n]) => `${n} ${e}`).join(', ')}`);

  // ─── Ventas: reservas y abonos (Goldtours) ──────────────────
  console.log('\nVentas · reservas y abonos');
  const publicados = datos(
    await servidor.from('paquetes').select('id, nombre, precio_por_persona, imagenes_paquete(id)').eq('activo', true),
    'paquetes',
  ).filter((p) => p.imagenes_paquete.length > 0);
  if (!publicados.length) {
    console.log('  − No hay paquetes publicados (activos y con foto): se omiten las reservas');
  } else {
    const paquete = publicados[0];
    const fecha = datos(
      await servidor
        .from('fechas_salida')
        .insert({ paquete_id: paquete.id, fecha_salida: enDias(40), fecha_regreso: enDias(41), cupos_totales: 20 })
        .select()
        .single(),
      'fecha de salida',
    );
    m.fechas_salida.push(fecha.id);
    guardar();

    let documento = 80000000 + Math.floor(Math.random() * 1_000_000);
    const viajeros = (n, apellido) =>
      Array.from({ length: n }, (_, i) => ({
        nombre_completo: `Viajero ${i + 1} ${apellido} (ejemplo)`,
        tipo_documento: 'CC',
        numero_documento: String(documento++),
        fecha_nacimiento: '1990-05-10',
      }));
    const reservar = async (c, n, apellido) =>
      datos(
        await c.db.rpc('crear_reserva', {
          p_fecha_salida_id: fecha.id,
          p_viajeros: viajeros(n, apellido),
          p_telefono_contacto: '3200000000',
          p_observaciones: NOTA,
        }),
        'crear_reserva',
      );
    const abonar = async (c, r, valor, referencia) => {
      const archivo = `${c.id}/${r.id}/comprobante-${referencia}.pdf`;
      const comprobante = pdf('Comprobante de transferencia', [
        `Banco de ejemplo · Referencia ${referencia}`,
        `Fecha: ${hoy}`,
        `Valor: $ ${valor.toLocaleString('es-CO')}`,
        `Destino: GOLDTRANS S.A.S. ZOMAC · Reserva ${r.codigo}`,
      ]);
      datos(await c.db.storage.from('comprobantes').upload(archivo, comprobante, { contentType: 'application/pdf' }), 'comprobante');
      m.archivos.comprobantes.push(archivo);
      guardar();
      return datos(
        await c.db.rpc('registrar_abono', {
          p_reserva_id: r.id,
          p_valor: valor,
          p_fecha_transferencia: hoy,
          p_comprobante_ruta: archivo,
          p_referencia: referencia,
        }),
        'registrar_abono',
      );
    };
    const verificar = async (abono, accionAbono, motivo) =>
      datos(await asesor.db.rpc('verificar_abono', { p_abono_id: abono.id, p_accion: accionAbono, p_motivo: motivo ?? null }), 'verificar_abono');

    // Prerreserva sin abono
    await reservar(persona, 2, 'Gómez');
    // Abono pendiente de verificar
    let r = await reservar(empresa1, 3, 'Ruiz');
    await abonar(empresa1, r, r.abono_minimo, 'TRF-1001');
    // Confirmada (abono mínimo aprobado)
    r = await reservar(empresa2, 4, 'Paz');
    await verificar(await abonar(empresa2, r, r.abono_minimo, 'TRF-1002'), 'aprobar');
    // Pagada (100 % aprobado)
    r = await reservar(persona, 1, 'Gómez');
    await verificar(await abonar(persona, r, r.valor_total, 'TRF-1003'), 'aprobar');
    // Abono rechazado
    r = await reservar(empresa1, 2, 'Ruiz');
    await verificar(await abonar(empresa1, r, r.abono_minimo, 'TRF-1004'), 'rechazar', 'El comprobante no corresponde al valor transferido');
    // Cancelada por el cliente
    r = await reservar(empresa2, 1, 'Paz');
    datos(await empresa2.db.rpc('cancelar_reserva', { p_reserva_id: r.id, p_motivo: 'Cambio de planes' }), 'cancelar_reserva');

    const estados = datos(await servidor.from('reservas').select('estado').eq('fecha_salida_id', fecha.id), 'reservas');
    const resumen = {};
    for (const e of estados) resumen[e.estado] = (resumen[e.estado] ?? 0) + 1;
    console.log(`  ✔ 6 reservas en "${paquete.nombre}" (${enDias(40)}): ${Object.entries(resumen).map(([e, n]) => `${n} ${e}`).join(', ')}`);
  }

  // ─── Portal: documentos y vigencias ─────────────────────────
  console.log('\nPortal · documentos, vigencias y licitaciones');
  const categorias = Object.fromEntries(
    datos(await servidor.from('categorias_doc').select('id, nombre'), 'categorías').map((c) => [c.nombre, c.id]),
  );
  const documentos = [
    ['Legales', 'Certificado de existencia y representación legal', 'Cámara de Comercio del Putumayo', 20],
    ['Legales', 'RUT', 'Registro Único Tributario actualizado', null],
    ['Legales', 'Cédula del representante legal', 'Copia ampliada al 150 %', null],
    ['Habilitación', 'Resolución de habilitación de transporte especial', 'Ministerio de Transporte', 400],
    ['Financieros', 'Estados financieros 2025', 'Firmados por contador y revisor fiscal', 190],
    ['Financieros', 'Certificación bancaria', 'Cuenta corriente para pagos', -10],
    ['Pólizas', 'Póliza de responsabilidad civil contractual', 'Cobertura para pasajeros', 45],
    ['Pólizas', 'Póliza de responsabilidad civil extracontractual', 'Daños a terceros', 45],
    ['Vehículos', 'SOAT camioneta DMO101', 'Seguro obligatorio', -5],
    ['Vehículos', 'Revisión técnico-mecánica DMO101', 'Certificado del CDA', 100],
    ['Conductores', 'Licencias de conducción C2', 'Conductores de planta', 300],
    ['Experiencia', 'Certificación de contrato ejecutado', 'Transporte de personal 2025', null],
  ];
  const ids = {};
  const resumenDocs = { vigente: 0, por_vencer: 0, vencido: 0, sin_vencimiento: 0 };
  for (const [categoria, nombre, descripcion, vence] of documentos) {
    const archivo = `${categorias[categoria]}/demo-${randomBytes(4).toString('hex')}.pdf`;
    datos(
      await asesor.db.storage
        .from('documentos')
        .upload(archivo, pdf(nombre, [descripcion, 'GOLDTRANS S.A.S. ZOMAC · NIT 901.760.920-1']), { contentType: 'application/pdf' }),
      `subir ${nombre}`,
    );
    m.archivos.documentos.push(archivo);
    const d = datos(
      await asesor.db.rpc('crear_documento', {
        p_categoria_id: categorias[categoria],
        p_nombre: nombre,
        p_ruta: archivo,
        p_nombre_archivo: `${nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
        p_descripcion: descripcion,
        p_notas: NOTA,
      }),
      `crear ${nombre}`,
    );
    m.documentos.push(d.id);
    guardar();
    ids[nombre] = d.id;
    if (vence !== null) {
      datos(
        await asesor.db.from('vigencias').insert({
          documento_id: d.id,
          fecha_expedicion: enDias(vence - 365),
          fecha_vencimiento: enDias(vence),
          responsable_id: asesor.id,
        }),
        `vigencia ${nombre}`,
      );
      resumenDocs[vence < 0 ? 'vencido' : vence <= 60 ? 'por_vencer' : 'vigente']++;
    } else resumenDocs.sin_vencimiento++;
  }

  // Historial: los estados financieros tienen una segunda versión.
  const nuevaVersion = `${categorias.Financieros}/demo-${randomBytes(4).toString('hex')}.pdf`;
  datos(
    await asesor.db.storage
      .from('documentos')
      .upload(nuevaVersion, pdf('Estados financieros 2025 (v2)', ['Con notas a los estados financieros']), { contentType: 'application/pdf' }),
    'subir versión',
  );
  m.archivos.documentos.push(nuevaVersion);
  guardar();
  datos(
    await asesor.db.rpc('agregar_version_documento', {
      p_documento_id: ids['Estados financieros 2025'],
      p_ruta: nuevaVersion,
      p_nombre_archivo: 'estados-financieros-2025-v2.pdf',
      p_notas: 'Se agregaron las notas',
    }),
    'agregar versión',
  );

  const alertas = await servidor.rpc('generar_alertas_vencimiento');
  console.log(
    `  ✔ ${documentos.length} documentos: ${resumenDocs.vigente} vigentes, ${resumenDocs.por_vencer} por vencer, ` +
      `${resumenDocs.vencido} vencidos, ${resumenDocs.sin_vencimiento} sin vencimiento · 1 con dos versiones` +
      (alertas.error ? ` · alertas: ${alertas.error.message}` : ' · alertas generadas'),
  );

  // ─── Portal: procesos de licitación ─────────────────────────
  const procesos = [
    {
      fila: {
        numero: 'SA-MC-021-2026',
        entidad: 'Alcaldía de Valle del Guamuez (ejemplo)',
        objeto: 'Transporte especial de funcionarios a zonas rurales del municipio',
        fecha_cierre: enDias(25),
        valor_estimado: 180000000,
        estado: 'preparacion',
        enlace: 'https://www.colombiacompra.gov.co/secop-ii',
        responsable_id: asesor.id,
        notas: NOTA,
      },
      requisitos: [
        ['Certificado de existencia y representación legal', 'Certificado de existencia y representación legal'],
        ['RUT', 'RUT'],
        ['Resolución de habilitación del Ministerio de Transporte', 'Resolución de habilitación de transporte especial'],
        ['Póliza de responsabilidad civil contractual', 'Póliza de responsabilidad civil contractual'],
        ['Estados financieros del último año', 'Estados financieros 2025'],
        ['Certificación bancaria', 'Certificación bancaria'],
        ['Carta de presentación de la oferta firmada', 'manual'],
        ['Certificación de experiencia específica', null],
      ],
    },
    {
      fila: {
        numero: 'IP-004-2026',
        entidad: 'Empresa de Servicios Públicos del Putumayo (ejemplo)',
        objeto: 'Alquiler de camionetas 4x4 con conductor por 6 meses',
        fecha_cierre: enDias(-5),
        valor_estimado: 95000000,
        estado: 'presentada',
        responsable_id: asesor.id,
        notas: `Oferta radicada. ${NOTA}`,
      },
      requisitos: [
        ['RUT', 'RUT'],
        ['Cédula del representante legal', 'Cédula del representante legal'],
        ['Licencias de los conductores', 'Licencias de conducción C2'],
        ['Certificado de experiencia', 'Certificación de contrato ejecutado'],
      ],
    },
  ];
  for (const p of procesos) {
    const proceso = datos(await asesor.db.from('procesos_licitacion').insert(p.fila).select().single(), `proceso ${p.fila.numero}`);
    m.procesos.push(proceso.id);
    guardar();
    datos(
      await asesor.db.from('items_verificacion').insert(
        p.requisitos.map(([requisito, doc], orden) => ({
          proceso_id: proceso.id,
          orden,
          requisito,
          documento_id: doc && doc !== 'manual' ? ids[doc] : null,
          cumplido_manual: doc === 'manual',
        })),
      ),
      `requisitos ${p.fila.numero}`,
    );
  }
  console.log(`  ✔ ${procesos.length} procesos de licitación (uno en preparación con requisitos pendientes, uno presentado)`);

  console.log('\nListo. Cuentas de ejemplo y lo creado: scripts/.datos-ejemplo.json (no se sube a git).');
}

// ─── Borrar ───────────────────────────────────────────────────

async function borrar() {
  if (!existsSync(MANIFIESTO)) {
    console.log('No hay datos de ejemplo registrados (scripts/.datos-ejemplo.json no existe).');
    return;
  }
  m = JSON.parse(readFileSync(MANIFIESTO, 'utf8'));
  if (m.url !== url) {
    console.error(`Los datos de ejemplo se crearon en ${m.url}, no en ${url}. Usa el .env de ese proyecto.`);
    process.exit(1);
  }
  const pasos = [
    ['procesos', () => m.procesos.length && servidor.from('procesos_licitacion').delete().in('id', m.procesos)],
    ['documentos', () => m.documentos.length && servidor.from('documentos').delete().in('id', m.documentos)],
    ['archivos de documentos', () => m.archivos.documentos.length && servidor.storage.from('documentos').remove(m.archivos.documentos)],
    ['reservas', () => m.usuarios.length && servidor.from('reservas').delete().in('usuario_id', m.usuarios)],
    ['comprobantes', () => m.archivos.comprobantes.length && servidor.storage.from('comprobantes').remove(m.archivos.comprobantes)],
    ['fechas de salida', () => m.fechas_salida.length && servidor.from('fechas_salida').delete().in('id', m.fechas_salida)],
    ['solicitudes', () => m.usuarios.length && servidor.from('solicitudes').delete().in('usuario_id', m.usuarios)],
    ['cotizaciones', () => m.cotizaciones.length && servidor.from('cotizaciones').delete().in('id', m.cotizaciones)],
    ['tarifas', () => m.tarifas.length && servidor.from('tarifas').delete().in('id', m.tarifas)],
    ['vehículos', () => m.vehiculos.length && servidor.from('vehiculos').delete().in('id', m.vehiculos)],
    ['rutas', () => m.rutas.length && servidor.from('rutas').delete().in('id', m.rutas)],
    ['usuarios', () => Promise.all(m.usuarios.map((u) => servidor.auth.admin.deleteUser(u)))],
  ];
  let fallos = 0;
  for (const [nombre, fn] of pasos) {
    try {
      const r = await fn();
      const error = Array.isArray(r) ? r.find((x) => x?.error)?.error : r?.error;
      if (error) throw error;
      console.log(`  ✔ ${nombre}`);
    } catch (e) {
      fallos++;
      console.warn(`  ✘ ${nombre}: ${e.message}`);
    }
  }
  if (fallos) {
    console.error('\nQuedaron datos sin borrar: revisa los errores y vuelve a ejecutar npm run demo:borrar');
    process.exit(1);
  }
  unlinkSync(MANIFIESTO);
  console.log('\nDatos de ejemplo borrados.');
}

console.log(`Datos de ejemplo · ${accion === '--crear' ? 'crear' : 'borrar'} en ${url} (${local ? 'local' : 'remoto'})`);
try {
  await (accion === '--crear' ? crear() : borrar());
} catch (e) {
  console.error(`\n✘ ${e.message}`);
  console.error('Lo creado hasta aquí quedó registrado: npm run demo:borrar lo elimina.');
  process.exit(1);
}
