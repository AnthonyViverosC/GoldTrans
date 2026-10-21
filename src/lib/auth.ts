// RNF-01 · Autenticación JWT con Supabase Auth.
// HU-01 registro · HU-02 inicio de sesión · HU-07 recuperar contraseña con código por correo.
import type { AuthError, Session } from '@supabase/supabase-js';

import { esRolAsignable, type RolAsignable } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { normalizarNit, normalizarTelefono, type DatosRegistro } from '@/lib/validacion';
import type { Tables } from '@/types/database';

export type Resultado<T = void> = { ok: true; data: T } | { ok: false; error: string };

export type UsuarioActual = {
  id: string;
  email: string;
  rol: RolAsignable;
  activo: boolean;
  perfil: Tables<'perfiles'> | null;
};

const MENSAJES: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos',
  email_not_confirmed: 'Confirma tu correo antes de iniciar sesión',
  user_already_exists: 'Ya existe una cuenta con este correo',
  email_exists: 'Ya existe una cuenta con este correo',
  weak_password: 'La contraseña es muy débil: usa al menos 8 caracteres con letras y números',
  over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo',
  same_password: 'La nueva contraseña debe ser distinta a la anterior',
  user_banned: 'Tu cuenta está desactivada. Contacta a GOLDTRANS',
  otp_expired: 'El código no es válido o ya expiró. Solicita uno nuevo',
  otp_disabled: 'La recuperación por código no está habilitada',
  unexpected_failure: 'No se pudo completar el registro. Verifica los datos (el NIT podría ya estar registrado)',
};

/** Traduce los errores de Supabase Auth a mensajes para el usuario. */
export function traducirError(error: Pick<AuthError, 'message'> & { code?: string }): string {
  if (error.code && MENSAJES[error.code]) return MENSAJES[error.code];
  if (/database error saving new user/i.test(error.message)) return MENSAJES.unexpected_failure;
  if (/network request failed|fetch failed/i.test(error.message)) {
    return 'Sin conexión. Revisa tu internet e inténtalo de nuevo';
  }
  return error.message;
}

export async function registrar(
  datos: DatosRegistro,
  emailRedirectTo?: string,
): Promise<Resultado<{ requiereConfirmacion: boolean }>> {
  const esEmpresa = datos.tipoPersona === 'empresa';
  const { data, error } = await supabase.auth.signUp({
    email: datos.email.trim().toLowerCase(),
    password: datos.password,
    options: {
      emailRedirectTo,
      // El trigger handle_new_user copia estos datos a public.perfiles.
      data: {
        tipo_persona: datos.tipoPersona,
        nombre_completo: datos.nombreCompleto.trim(),
        tipo_documento: esEmpresa ? null : datos.tipoDocumento,
        numero_documento: esEmpresa ? null : datos.numeroDocumento.trim(),
        razon_social: esEmpresa ? datos.razonSocial.trim() : null,
        nit: esEmpresa ? normalizarNit(datos.nit) : null,
        telefono: normalizarTelefono(datos.telefono) || null,
        ciudad: datos.ciudad.trim() || null,
      },
    },
  });
  if (error) return { ok: false, error: traducirError(error) };
  // Con confirmación de correo activa, Supabase no devuelve sesión y además oculta
  // si el correo ya existía (identities vacío).
  if (data.user && data.user.identities?.length === 0) {
    return { ok: false, error: MENSAJES.user_already_exists };
  }
  return { ok: true, data: { requiereConfirmacion: !data.session } };
}

export async function iniciarSesion(email: string, password: string): Promise<Resultado<Session>> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: data.session };
}

export async function cerrarSesion(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Envía el correo de recuperación con un código de un solo uso ({{ .Token }} en la plantilla).
 * Se usa código en vez de enlace porque funciona igual en Expo Go, web y la app instalada.
 */
export async function enviarRecuperacion(email: string): Promise<Resultado> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: undefined };
}

/** Verifica el código del correo; si es válido Supabase abre una sesión para cambiar la clave. */
export async function verificarCodigoRecuperacion(email: string, codigo: string): Promise<Resultado> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: codigo.trim(),
    type: 'recovery',
  });
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: undefined };
}

export async function actualizarPassword(password: string): Promise<Resultado> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data: undefined };
}

/** Lee el usuario autenticado con su rol y perfil (RLS: solo su propia fila). */
export async function obtenerUsuarioActual(userId: string): Promise<Resultado<UsuarioActual>> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, rol, activo, perfil:perfiles(*)')
    .eq('id', userId)
    .maybeSingle();
  if (error) return { ok: false, error: traducirError(error) };
  if (!data) return { ok: false, error: 'Tu cuenta no tiene un usuario asociado. Contacta a GOLDTRANS' };
  if (!esRolAsignable(data.rol)) return { ok: false, error: `Rol desconocido: ${data.rol}` };
  return {
    ok: true,
    data: { id: data.id, email: data.email, rol: data.rol, activo: data.activo, perfil: data.perfil },
  };
}
