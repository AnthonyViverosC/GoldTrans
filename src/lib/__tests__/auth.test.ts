// RNF-03 · Pruebas unitarias del módulo de autenticación.
import {
  actualizarPassword,
  enviarRecuperacion,
  iniciarSesion,
  obtenerUsuarioActual,
  registrar,
  traducirError,
  verificarCodigoRecuperacion,
} from '../auth';
import type { DatosRegistro } from '../validacion';
import { VERSION_AVISO_PRIVACIDAD } from '@/constants/privacidad';

const mockAuth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  verifyOtp: jest.fn(),
  updateUser: jest.fn(),
};
const mockMaybeSingle = jest.fn();
const mockQuery = { select: jest.fn(), eq: jest.fn(), maybeSingle: mockMaybeSingle };
mockQuery.select.mockReturnValue(mockQuery);
mockQuery.eq.mockReturnValue(mockQuery);

jest.mock('@/lib/supabase', () => ({
  // Getters: el factory se ejecuta antes de que se inicialicen las constantes de arriba.
  supabase: {
    get auth() {
      return mockAuth;
    },
    from: () => mockQuery,
  },
}));

const empresa: DatosRegistro = {
  tipoPersona: 'empresa',
  nombreCompleto: ' Luis Gómez ',
  tipoDocumento: 'CC',
  numeroDocumento: '123456',
  razonSocial: 'Transportes del Sur S.A.S.',
  nit: '900.123.456-8',
  telefono: '300 123 4567',
  ciudad: '',
  email: ' Luis@Empresa.CO ',
  password: 'clave1234',
  confirmacion: 'clave1234',
  autorizaDatos: true,
};

beforeEach(() => jest.clearAllMocks());

describe('registrar (HU-01)', () => {
  it('envía los datos de la empresa como metadata normalizada', async () => {
    mockAuth.signUp.mockResolvedValue({
      data: { user: { identities: [{}] }, session: null },
      error: null,
    });

    const r = await registrar(empresa, 'goldtrans://login');

    expect(r).toEqual({ ok: true, data: { requiereConfirmacion: true } });
    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'luis@empresa.co',
      password: 'clave1234',
      options: {
        emailRedirectTo: 'goldtrans://login',
        data: {
          tipo_persona: 'empresa',
          nombre_completo: 'Luis Gómez',
          tipo_documento: null,
          numero_documento: null,
          razon_social: 'Transportes del Sur S.A.S.',
          nit: '900123456-8',
          telefono: '3001234567',
          ciudad: null,
          autoriza_datos: true,
          version_aviso_privacidad: VERSION_AVISO_PRIVACIDAD,
        },
      },
    });
  });

  it('nunca envía el rol en el registro', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: {} }, error: null });
    await registrar(empresa);
    expect(JSON.stringify(mockAuth.signUp.mock.calls[0][0])).not.toMatch(/rol/);
  });

  it('no requiere confirmación cuando Supabase devuelve sesión', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: {} }, error: null });
    await expect(registrar(empresa)).resolves.toEqual({
      ok: true,
      data: { requiereConfirmacion: false },
    });
  });

  it('detecta correo ya registrado (identities vacío)', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
    await expect(registrar(empresa)).resolves.toEqual({
      ok: false,
      error: 'Ya existe una cuenta con este correo',
    });
  });
});

describe('iniciarSesion (HU-02)', () => {
  it('normaliza el correo y devuelve la sesión', async () => {
    const session = { access_token: 'jwt' };
    mockAuth.signInWithPassword.mockResolvedValue({ data: { session }, error: null });

    await expect(iniciarSesion(' Ana@Correo.co ', 'x')).resolves.toEqual({ ok: true, data: session });
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@correo.co', password: 'x' });
  });

  it('traduce credenciales inválidas', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
    });
    await expect(iniciarSesion('a@b.co', 'mal')).resolves.toEqual({
      ok: false,
      error: 'Correo o contraseña incorrectos',
    });
  });
});

describe('recuperación de contraseña (HU-07)', () => {
  it('envía el código al correo normalizado, sin enlace de regreso', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
    await expect(enviarRecuperacion(' Ana@correo.co ')).resolves.toEqual({
      ok: true,
      data: undefined,
    });
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('ana@correo.co');
  });

  it('verifica el código como OTP de tipo recovery', async () => {
    mockAuth.verifyOtp.mockResolvedValue({ data: {}, error: null });
    await expect(verificarCodigoRecuperacion('Ana@correo.co', ' 123456 ')).resolves.toEqual({
      ok: true,
      data: undefined,
    });
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
      email: 'ana@correo.co',
      token: '123456',
      type: 'recovery',
    });
  });

  it('informa código vencido o incorrecto', async () => {
    mockAuth.verifyOtp.mockResolvedValue({
      data: {},
      error: { message: 'Token has expired or is invalid', code: 'otp_expired' },
    });
    await expect(verificarCodigoRecuperacion('a@b.co', '000000')).resolves.toEqual({
      ok: false,
      error: 'El código no es válido o ya expiró. Solicita uno nuevo',
    });
  });

  it('traduce contraseña repetida', async () => {
    mockAuth.updateUser.mockResolvedValue({ error: { message: 'x', code: 'same_password' } });
    await expect(actualizarPassword('clave1234')).resolves.toEqual({
      ok: false,
      error: 'La nueva contraseña debe ser distinta a la anterior',
    });
  });
});

describe('obtenerUsuarioActual (HU-03)', () => {
  it('devuelve rol y perfil', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'u1', email: 'a@b.co', rol: 'asesor', activo: true, perfil: null },
      error: null,
    });
    await expect(obtenerUsuarioActual('u1')).resolves.toEqual({
      ok: true,
      data: { id: 'u1', email: 'a@b.co', rol: 'asesor', activo: true, perfil: null },
    });
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('rechaza roles desconocidos', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'u1', email: 'a@b.co', rol: 'visitante', activo: true, perfil: null },
      error: null,
    });
    const r = await obtenerUsuarioActual('u1');
    expect(r.ok).toBe(false);
  });

  it('falla si la cuenta no tiene fila en usuarios', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const r = await obtenerUsuarioActual('u1');
    expect(r.ok).toBe(false);
  });
});

describe('traducirError', () => {
  it('reconoce errores de red', () => {
    expect(traducirError({ message: 'Network request failed' })).toMatch(/Sin conexión/);
  });

  it('reconoce el error del trigger de registro', () => {
    expect(traducirError({ message: 'Database error saving new user' })).toMatch(/NIT/);
  });
});
