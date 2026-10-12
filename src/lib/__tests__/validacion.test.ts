import {
  calcularDigitoVerificacion,
  validarCodigo,
  normalizarPlaca,
  sinErrores,
  validarEmail,
  validarFecha,
  validarNit,
  validarPassword,
  validarPlaca,
  validarRegistro,
  type DatosRegistro,
} from '../validacion';

const persona: DatosRegistro = {
  tipoPersona: 'persona',
  nombreCompleto: 'Ana Pérez',
  tipoDocumento: 'CC',
  numeroDocumento: '1012345678',
  razonSocial: '',
  nit: '',
  telefono: '300 123 4567',
  ciudad: 'La Hormiga',
  email: 'ana@correo.co',
  password: 'clave1234',
  confirmacion: 'clave1234',
};

const empresa: DatosRegistro = {
  ...persona,
  tipoPersona: 'empresa',
  numeroDocumento: '',
  razonSocial: 'Transportes del Sur S.A.S.',
  nit: '900.123.456-8',
};

describe('validarEmail', () => {
  it.each(['ana@correo.co', ' luis.perez@empresa.com.co '])('acepta %s', (email) => {
    expect(validarEmail(email)).toBeUndefined();
  });

  it.each(['', 'ana', 'ana@correo', 'ana @correo.co'])('rechaza "%s"', (email) => {
    expect(validarEmail(email)).toBeDefined();
  });
});

describe('validarPassword', () => {
  it('exige mínimo 8 caracteres', () => {
    expect(validarPassword('abc123')).toMatch(/Mínimo 8/);
  });

  it('exige letras y números', () => {
    expect(validarPassword('solamenteletras')).toMatch(/letras y números/);
    expect(validarPassword('12345678')).toMatch(/letras y números/);
  });

  it('acepta una contraseña válida', () => {
    expect(validarPassword('goldtrans2026')).toBeUndefined();
  });
});

describe('NIT', () => {
  it.each([
    ['800197268', 4], // DIAN
    ['890903938', 8], // Bancolombia
    ['900123456', 8],
  ])('calcula el dígito de verificación de %s', (nit, dv) => {
    expect(calcularDigitoVerificacion(nit)).toBe(dv);
  });

  it('acepta NIT con puntos y dígito correcto', () => {
    expect(validarNit('800.197.268-4')).toBeUndefined();
  });

  it('rechaza NIT sin dígito de verificación', () => {
    expect(validarNit('800197268')).toMatch(/Formato/);
  });

  it('rechaza dígito de verificación incorrecto', () => {
    expect(validarNit('800197268-5')).toMatch(/dígito de verificación/);
  });
});

describe('validarRegistro (HU-01)', () => {
  it('acepta una persona natural completa', () => {
    expect(validarRegistro(persona)).toEqual({});
  });

  it('acepta una empresa con NIT válido', () => {
    expect(validarRegistro(empresa)).toEqual({});
  });

  it('la empresa no necesita documento personal pero sí razón social y NIT', () => {
    const errores = validarRegistro({ ...empresa, razonSocial: ' ', nit: '' });
    expect(errores.numeroDocumento).toBeUndefined();
    expect(errores.razonSocial).toBeDefined();
    expect(errores.nit).toBeDefined();
  });

  it('la persona necesita número de documento', () => {
    expect(validarRegistro({ ...persona, numeroDocumento: '' }).numeroDocumento).toBeDefined();
  });

  it('detecta contraseñas que no coinciden', () => {
    const errores = validarRegistro({ ...persona, confirmacion: 'otra1234' });
    expect(errores.confirmacion).toBe('Las contraseñas no coinciden');
    expect(sinErrores(errores)).toBe(false);
  });

  it('exige teléfono válido', () => {
    expect(validarRegistro({ ...persona, telefono: '' }).telefono).toBeDefined();
    expect(validarRegistro({ ...persona, telefono: '12ab' }).telefono).toBeDefined();
  });
});

describe('vehículos', () => {
  it('normaliza y valida placas colombianas', () => {
    expect(normalizarPlaca('abc-123')).toBe('ABC123');
    expect(validarPlaca('abc 123')).toBeUndefined();
    expect(validarPlaca('AB1234')).toBeDefined();
  });

  it('valida fechas AAAA-MM-DD opcionales', () => {
    expect(validarFecha('')).toBeUndefined();
    expect(validarFecha('2026-12-31')).toBeUndefined();
    expect(validarFecha('2026-02-30')).toBe('Fecha no válida');
    expect(validarFecha('31/12/2026')).toMatch(/Formato/);
  });
});

describe('validarCodigo (HU-07)', () => {
  it('acepta el código numérico del correo', () => {
    expect(validarCodigo('123456')).toBeUndefined();
    expect(validarCodigo(' 12345678 ')).toBeUndefined();
  });

  it.each(['', '12345', 'abc123', '12345678901'])('rechaza "%s"', (codigo) => {
    expect(validarCodigo(codigo)).toBeDefined();
  });
});
