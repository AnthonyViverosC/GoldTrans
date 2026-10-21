// HU-03 · Cuatro roles con permisos diferenciados.
// La autorización real la imponen las políticas RLS; esto solo decide qué pantallas mostrar.

export const ROLES = ['visitante', 'cliente', 'asesor', 'admin'] as const;
export type Rol = (typeof ROLES)[number];

/** Roles que se pueden asignar a una cuenta registrada (visitante = sin sesión). */
export const ROLES_ASIGNABLES = ['cliente', 'asesor', 'admin'] as const satisfies readonly Rol[];
export type RolAsignable = (typeof ROLES_ASIGNABLES)[number];

export const ETIQUETA_ROL: Record<Rol, string> = {
  visitante: 'Visitante',
  cliente: 'Cliente',
  asesor: 'Asesor comercial',
  admin: 'Administrador',
};

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor);
}

export function esRolAsignable(valor: unknown): valor is RolAsignable {
  return typeof valor === 'string' && (ROLES_ASIGNABLES as readonly string[]).includes(valor);
}

/** Pantalla de inicio de cada rol. */
export function rutaInicio(rol: Rol) {
  switch (rol) {
    case 'cliente':
      return '/mis-cotizaciones' as const;
    case 'asesor':
      return '/solicitudes' as const;
    case 'admin':
      return '/usuarios' as const;
    case 'visitante':
      return '/login' as const;
  }
}

export type Modulo =
  | 'cotizador'
  | 'goldtours-catalogo'
  | 'perfil'
  | 'solicitudes-propias'
  | 'reservas-propias'
  | 'gestion-solicitudes'
  | 'verificacion-abonos'
  | 'documentos'
  | 'usuarios'
  | 'flota'
  | 'rutas-tarifas'
  | 'paquetes';

const PERMISOS: Record<Rol, readonly Modulo[]> = {
  visitante: ['cotizador', 'goldtours-catalogo'],
  cliente: ['cotizador', 'goldtours-catalogo', 'perfil', 'solicitudes-propias', 'reservas-propias'],
  asesor: [
    'cotizador',
    'goldtours-catalogo',
    'perfil',
    'gestion-solicitudes',
    'verificacion-abonos',
    'documentos',
  ],
  admin: [
    'cotizador',
    'goldtours-catalogo',
    'perfil',
    'gestion-solicitudes',
    'verificacion-abonos',
    'documentos',
    'usuarios',
    'flota',
    'rutas-tarifas',
    'paquetes',
  ],
};

export function puedeAcceder(rol: Rol, modulo: Modulo): boolean {
  return PERMISOS[rol].includes(modulo);
}
