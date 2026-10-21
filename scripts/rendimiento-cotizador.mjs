// RNF-04 · Prueba de rendimiento del cotizador: la respuesta debe llegar en menos de 5 segundos.
// Uso: npm run test:rendimiento            (lee EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY de .env)
//      PETICIONES=50 PARALELAS=10 npm run test:rendimiento
// Igual que la app, fija la región de la función a la de la base de datos (REGION, por defecto us-west-2).
// Cada petición registra una cotización de visitante en la base de datos.

const LIMITE_MS = 5000;
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const clave = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const peticiones = Number(process.env.PETICIONES ?? 20);
const paralelas = Number(process.env.PARALELAS ?? 5);
const region = process.env.REGION ?? 'us-west-2';

if (!url || !clave) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const encabezados = { apikey: clave, Authorization: `Bearer ${clave}` };

const rutas = await fetch(`${url}/rest/v1/rutas?select=id,origen,destino&activo=eq.true&limit=1`, {
  headers: encabezados,
}).then((r) => r.json());
if (!Array.isArray(rutas) || rutas.length === 0) {
  console.error('No hay rutas activas. Crea al menos una ruta, una tarifa vigente y un vehículo disponible.');
  process.exit(1);
}
const ruta = rutas[0];

// Mañana en Colombia (UTC-5).
const manana = new Date(Date.now() - 5 * 3_600_000 + 86_400_000).toISOString().slice(0, 10);
const cuerpo = JSON.stringify({ ruta_id: ruta.id, tipo_servicio: 'ida', fecha_inicio: manana, pasajeros: 1 });

async function medir() {
  const inicio = performance.now();
  const r = await fetch(`${url}/functions/v1/calcular-tarifa`, {
    method: 'POST',
    headers: { ...encabezados, 'Content-Type': 'application/json', 'x-region': region },
    body: cuerpo,
  });
  const datos = await r.json().catch(() => ({}));
  const ms = Math.round(performance.now() - inicio);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${datos.error ?? 'sin detalle'}`);
  return { ms, servidor: datos.duracion_ms };
}

function resumen(nombre, muestras) {
  const ms = muestras.map((m) => m.ms).sort((a, b) => a - b);
  const p95 = ms[Math.min(ms.length - 1, Math.ceil(ms.length * 0.95) - 1)];
  const promedio = Math.round(ms.reduce((s, x) => s + x, 0) / ms.length);
  const servidor = Math.round(muestras.reduce((s, m) => s + (m.servidor ?? 0), 0) / muestras.length);
  console.log(
    `${nombre.padEnd(22)} n=${String(ms.length).padStart(3)}  min=${ms[0]} ms  promedio=${promedio} ms  ` +
      `p95=${p95} ms  máx=${ms.at(-1)} ms  (cálculo en servidor ≈ ${servidor} ms)`,
  );
  return p95;
}

console.log(`Ruta: ${ruta.origen} → ${ruta.destino} · fecha ${manana} · región ${region}\n`);

try {
  const frio = await medir();
  console.log(`Primera petición (puede incluir arranque en frío): ${frio.ms} ms\n`);

  const secuenciales = [];
  for (let i = 0; i < peticiones; i++) secuenciales.push(await medir());

  const concurrentes = await Promise.all(Array.from({ length: paralelas }, medir));

  const peor = Math.max(
    frio.ms,
    resumen('Secuenciales', secuenciales),
    resumen(`${paralelas} simultáneas`, concurrentes),
  );

  if (peor >= LIMITE_MS) {
    console.error(`\n✗ RNF-04 NO cumple: ${peor} ms ≥ ${LIMITE_MS} ms`);
    process.exit(1);
  }
  console.log(`\n✓ RNF-04 cumple: todas las medidas (incluida la primera) por debajo de ${LIMITE_MS} ms`);
} catch (e) {
  console.error(`✗ Falló una petición: ${e.message}`);
  process.exit(1);
}
