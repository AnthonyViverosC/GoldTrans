// HU-04 perfil · HU-08 gestión de usuarios.
import { traducirError, type Resultado } from '@/lib/auth';
import type { RolAsignable } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { normalizarNit, normalizarTelefono, type DatosPerfil } from '@/lib/validacion';
import type { Tables, TablesUpdate } from '@/types/database';

export type UsuarioConPerfil = Tables<'usuarios'> & { perfil: Tables<'perfiles'> | null };

export function perfilAFormulario(perfil: Tables<'perfiles'> | null): DatosPerfil {
  return {
    tipoPersona: perfil?.tipo_persona === 'empresa' ? 'empresa' : 'persona',
    nombreCompleto: perfil?.nombre_completo ?? '',
    tipoDocumento: (perfil?.tipo_documento as DatosPerfil['tipoDocumento']) ?? 'CC',
    numeroDocumento: perfil?.numero_documento ?? '',
    razonSocial: perfil?.razon_social ?? '',
    nit: perfil?.nit ?? '',
    telefono: perfil?.telefono ?? '',
    ciudad: perfil?.ciudad ?? '',
  };
}

export function formularioAPerfil(d: DatosPerfil): TablesUpdate<'perfiles'> {
  const esEmpresa = d.tipoPersona === 'empresa';
  return {
    tipo_persona: d.tipoPersona,
    nombre_completo: d.nombreCompleto.trim(),
    tipo_documento: esEmpresa ? null : d.tipoDocumento,
    numero_documento: esEmpresa ? null : d.numeroDocumento.trim(),
    razon_social: esEmpresa ? d.razonSocial.trim() : null,
    nit: esEmpresa ? normalizarNit(d.nit) : null,
    telefono: normalizarTelefono(d.telefono) || null,
    ciudad: d.ciudad.trim() || null,
  };
}

export async function actualizarPerfil(
  usuarioId: string,
  datos: DatosPerfil,
): Promise<Resultado<Tables<'perfiles'>>> {
  const { data, error } = await supabase
    .from('perfiles')
    .update(formularioAPerfil(datos))
    .eq('usuario_id', usuarioId)
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ese NIT ya está registrado' };
    return { ok: false, error: traducirError(error) };
  }
  return { ok: true, data };
}

export async function listarUsuarios(): Promise<Resultado<UsuarioConPerfil[]>> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*, perfil:perfiles(*)')
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: traducirError(error) };
  return { ok: true, data };
}

export async function actualizarUsuario(
  id: string,
  cambios: { rol?: RolAsignable; activo?: boolean },
): Promise<Resultado<Tables<'usuarios'>>> {
  const { data, error } = await supabase
    .from('usuarios')
    .update(cambios)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) return { ok: false, error: traducirError(error) };
  // RLS filtra en silencio: si no volvió fila es porque no tenía permiso.
  if (!data) return { ok: false, error: 'No tienes permiso para modificar este usuario' };
  return { ok: true, data };
}

export function filtrarUsuarios(usuarios: UsuarioConPerfil[], busqueda: string) {
  const q = busqueda.trim().toLowerCase();
  if (!q) return usuarios;
  return usuarios.filter((u) =>
    [u.email, u.perfil?.nombre_completo, u.perfil?.razon_social, u.perfil?.nit, u.rol].some((v) =>
      v?.toLowerCase().includes(q),
    ),
  );
}
