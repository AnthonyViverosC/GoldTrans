// Sprint 2 · Edge Function calcular-tarifa
// HU-12 sugerencia de vehículo · HU-13 cálculo al instante · HU-14 desglose · RNF-04 < 5 s
//
// POST { ruta_id, tipo_servicio, fecha_inicio, fecha_fin?, pasajeros, jornada_horas? (4 | 8 | 12, por defecto 12) }
// Visitantes y usuarios con sesión. Se despliega con verify_jwt = false (la app usa una
// publishable key, que no es un JWT); si llega el JWT de un usuario, la cotización queda a su nombre.
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  calcularCotizacion,
  elegirVehiculo,
  hoyEnColombia,
  tarifasAplicables,
  validarSolicitud,
  type TarifaCalculo,
} from '../_shared/calculo.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Clave con permisos de servidor: la legada (JWT) o la nueva sb_secret_. */
function claveServicio(): string {
  const legada = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legada) return legada;
  const nuevas = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
  return nuevas.default ?? Object.values(nuevas)[0] ?? '';
}

// Cliente creado una vez por instancia: las peticiones siguientes reutilizan la conexión.
const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', claveServicio(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function responder(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Id del usuario si la petición trae su JWT; null para visitantes. */
async function usuarioDeLaPeticion(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  // La publishable key (visitante) no es un JWT.
  if (token.split('.').length !== 3) return null;
  const { data } = await db.auth.getUser(token);
  return data.user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const inicio = performance.now();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return responder({ error: 'Solicitud inválida' }, 400);
  }

  const validacion = validarSolicitud(body, hoyEnColombia());
  if (!validacion.ok) return responder({ error: validacion.error }, 400);
  const s = validacion.data;

  // Todas las lecturas en paralelo: una sola ida y vuelta a la base de datos (RNF-04).
  const [usuarioId, ruta, vehiculos, tarifas] = await Promise.all([
    usuarioDeLaPeticion(req),
    db
      .from('rutas')
      .select('id, origen, destino, distancia_km')
      .eq('id', s.ruta_id)
      .eq('activo', true)
      .maybeSingle(),
    db
      .from('vehiculos')
      .select('tipo, capacidad_pasajeros')
      .eq('estado', 'disponible')
      .gte('capacidad_pasajeros', s.pasajeros),
    db
      .from('tarifas')
      .select(
        'id, tipo_vehiculo, jornada_horas, valor_jornada, km_incluidos_dia, valor_km_adicional, recargo_fin_semana_pct, ruta_id',
      )
      // Los precios especiales de otras rutas los descarta tarifasAplicables: un segundo .or()
      // no se combina de forma confiable con el de la vigencia.
      .eq('jornada_horas', s.jornada_horas)
      .lte('vigencia_desde', s.fecha_inicio)
      .or(`vigencia_hasta.is.null,vigencia_hasta.gte.${s.fecha_inicio}`),
  ]);

  const fallo = ruta.error ?? vehiculos.error ?? tarifas.error;
  if (fallo) {
    console.error('calcular-tarifa: consulta', fallo);
    return responder({ error: 'No se pudo calcular la cotización. Inténtalo de nuevo' }, 500);
  }
  if (!ruta.data) return responder({ error: 'La ruta no existe o no está disponible' }, 404);

  // Precio especial de la ruta si lo hay; si no, la tarifa general del tipo de vehículo.
  const eleccion = elegirVehiculo(
    vehiculos.data ?? [],
    tarifasAplicables((tarifas.data ?? []) as TarifaCalculo[], s.ruta_id, s.jornada_horas),
    s.pasajeros,
  );
  if (!eleccion) {
    return responder(
      {
        error: `No hay un vehículo disponible con tarifa vigente de ${s.jornada_horas} horas para ${s.pasajeros} pasajeros. Prueba otra jornada o contacta a un asesor de GOLDTRANS`,
      },
      422,
    );
  }

  const calculo = calcularCotizacion({
    tipo_servicio: s.tipo_servicio,
    fecha_inicio: s.fecha_inicio,
    fecha_fin: s.fecha_fin,
    ruta: { distancia_km: Number(ruta.data.distancia_km) },
    tarifa: eleccion.tarifa,
  });
  const duracionMs = Math.round(performance.now() - inicio);

  const { data: cotizacion, error } = await db.rpc('guardar_cotizacion', {
    p_cotizacion: {
      usuario_id: usuarioId,
      ruta_id: s.ruta_id,
      origen: ruta.data.origen,
      destino: ruta.data.destino,
      tarifa_id: eleccion.tarifa.id,
      tipo_servicio: s.tipo_servicio,
      fecha_inicio: s.fecha_inicio,
      fecha_fin: s.fecha_fin,
      dias: calculo.dias,
      pasajeros: s.pasajeros,
      tipo_vehiculo: eleccion.vehiculo.tipo,
      capacidad_vehiculo: eleccion.vehiculo.capacidad_pasajeros,
      distancia_km: calculo.distancia_km,
      valor_total: calculo.valor_total,
      duracion_ms: duracionMs,
      jornada_horas: s.jornada_horas,
      km_incluidos_dia: eleccion.tarifa.km_incluidos_dia,
      valor_km_adicional: eleccion.tarifa.valor_km_adicional,
    },
    p_detalle: calculo.desglose.map((linea, i) => ({ ...linea, orden: i + 1 })),
  });
  if (error || !cotizacion) {
    console.error('calcular-tarifa: guardar', error);
    return responder({ error: 'No se pudo guardar la cotización. Inténtalo de nuevo' }, 500);
  }

  const c = cotizacion as { id: string; codigo: string; created_at: string };
  return responder({
    id: c.id,
    codigo: c.codigo,
    created_at: c.created_at,
    ruta: { origen: ruta.data.origen, destino: ruta.data.destino },
    tipo_servicio: s.tipo_servicio,
    fecha_inicio: s.fecha_inicio,
    fecha_fin: s.fecha_fin,
    pasajeros: s.pasajeros,
    vehiculo: { tipo: eleccion.vehiculo.tipo, capacidad: eleccion.vehiculo.capacidad_pasajeros },
    distancia_km: calculo.distancia_km,
    jornada_horas: s.jornada_horas,
    km_incluidos_dia: eleccion.tarifa.km_incluidos_dia,
    valor_km_adicional: eleccion.tarifa.valor_km_adicional,
    dias: calculo.dias,
    desglose: calculo.desglose,
    valor_total: calculo.valor_total,
    duracion_ms: Math.round(performance.now() - inicio),
  });
});
