// Sprint 4 · Edge Function liberar-cupos
// HU-26 · Vence las prerreservas sin abono cuyo plazo pasó y devuelve sus cupos a fechas_salida.
//
// POST (sin cuerpo). La programa pg_cron cada 15 minutos (migración del Sprint 4) con
// Authorization: Bearer <CRON_SECRET>. Se despliega con verify_jwt = false: la protege ese secreto.
// La lógica vive en public.vencer_prerreservas(), que también usa crear_reserva antes de contar cupos.
import { createClient } from 'npm:@supabase/supabase-js@2';

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
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const secreto = Deno.env.get('CRON_SECRET');
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secreto || token !== secreto) return responder({ error: 'No autorizado' }, 401);

  const inicio = performance.now();
  const { data, error } = await db.rpc('vencer_prerreservas');
  if (error) {
    console.error('[liberar-cupos]', error);
    return responder({ error: error.message }, 500);
  }

  const resultado = data?.[0] ?? { reservas_vencidas: 0, cupos_liberados: 0 };
  const respuesta = { ...resultado, duracion_ms: Math.round(performance.now() - inicio) };
  if (resultado.reservas_vencidas > 0) console.log('[liberar-cupos]', respuesta);
  return responder(respuesta);
});
