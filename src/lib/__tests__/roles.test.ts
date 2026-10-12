import { esRolAsignable, puedeAcceder, ROLES, rutaInicio } from '../roles';

describe('roles (HU-03)', () => {
  it('define exactamente cuatro roles', () => {
    expect(ROLES).toEqual(['visitante', 'cliente', 'asesor', 'admin']);
  });

  it('visitante no es asignable a una cuenta registrada', () => {
    expect(esRolAsignable('visitante')).toBe(false);
    expect(esRolAsignable('cliente')).toBe(true);
    expect(esRolAsignable('superadmin')).toBe(false);
  });

  it('cada rol tiene una pantalla de inicio distinta', () => {
    const rutas = ROLES.map(rutaInicio);
    expect(new Set(rutas).size).toBe(ROLES.length);
  });

  it('todos pueden cotizar, incluso sin registro (HU-05)', () => {
    for (const rol of ROLES) expect(puedeAcceder(rol, 'cotizador')).toBe(true);
  });

  it('no hay acceso cruzado a módulos de otros roles', () => {
    expect(puedeAcceder('visitante', 'perfil')).toBe(false);
    expect(puedeAcceder('cliente', 'gestion-solicitudes')).toBe(false);
    expect(puedeAcceder('cliente', 'documentos')).toBe(false);
    expect(puedeAcceder('asesor', 'usuarios')).toBe(false);
    expect(puedeAcceder('asesor', 'flota')).toBe(false);
    expect(puedeAcceder('admin', 'usuarios')).toBe(true);
    expect(puedeAcceder('asesor', 'documentos')).toBe(true);
  });
});
