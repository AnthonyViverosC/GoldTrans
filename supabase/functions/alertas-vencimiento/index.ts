// Sprint 5 · Edge Function alertas-vencimiento
// HU-28 · Cron diario (7:00 Colombia): crea las alertas de los documentos que vencen en 60, 30 o 15 días
// (o que ya vencieron) para su responsable. Las alertas se ven en el portal; si están configurados
// RESEND_API_KEY y ALERTAS_REMITENTE, también se envían por correo.
//
// POST (sin cuerpo) con Authorization: Bearer <CRON_SECRET>. Se despliega con verify_jwt = false.
// La lógica vive en public.generar_alertas_vencimiento() (no repite alertas).
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

type AlertaNueva = { alerta_id: string; email: string; documento: string; mensaje: string };

async function enviarCorreo(a: AlertaNueva, clave: string, remitente: string): Promise<boolean> {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: remitente,
      to: [a.email],
      subject: `GOLDTRANS · Vencimiento de «${a.documento}»`,
      text: `${a.mensaje}\n\nRevisa el tablero documental en la app de GOLDTRANS (Documentos).`,
    }),
  });
  if (!r.ok) console.error('[alertas-vencimiento] correo', a.email, r.status, await r.text());
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const secreto = Deno.env.get('CRON_SECRET');
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secreto || token !== secreto) return responder({ error: 'No autorizado' }, 401);

  const { data, error } = await db.rpc('generar_alertas_vencimiento');
  if (error) {
    console.error('[alertas-vencimiento]', error);
    return responder({ error: error.message }, 500);
  }
  const alertas = (data ?? []) as AlertaNueva[];

  const clave = Deno.env.get('RESEND_API_KEY');
  const remitente = Deno.env.get('ALERTAS_REMITENTE');
  let correos = 0;
  if (clave && remitente && alertas.length) {
    const enviados = await Promise.all(alertas.map((a) => enviarCorreo(a, clave, remitente)));
    const ids = alertas.filter((_, i) => enviados[i]).map((a) => a.alerta_id);
    correos = ids.length;
    if (ids.length) {
      await db.from('alertas').update({ correo_enviado_at: new Date().toISOString() }).in('id', ids);
    }
  }

  const respuesta = { alertas: alertas.length, correos };
  if (alertas.length) console.log('[alertas-vencimiento]', respuesta);
  return responder(respuesta);
});
