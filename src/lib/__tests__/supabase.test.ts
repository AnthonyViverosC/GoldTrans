jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

type SupabaseModule = typeof import('../supabase');

function loadWithEnv(env: { url?: string; key?: string }): SupabaseModule {
  process.env.EXPO_PUBLIC_SUPABASE_URL = env.url ?? '';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = env.key ?? '';
  let mod!: SupabaseModule;
  jest.isolateModules(() => {
    mod = require('../supabase');
  });
  return mod;
}

const okResponse = { ok: true, status: 200 } as Response;

describe('checkSupabaseConnection', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falla sin hacer peticiones cuando faltan las variables de entorno', async () => {
    const { checkSupabaseConnection, isSupabaseConfigured } = loadWithEnv({});
    const fetchMock = jest.fn();

    expect(isSupabaseConfigured).toBe(false);
    await expect(checkSupabaseConnection(fetchMock)).resolves.toEqual({
      ok: false,
      error: 'Variables de entorno de Supabase no configuradas',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('consulta el health de Auth con la anon key', async () => {
    const { checkSupabaseConnection } = loadWithEnv({
      url: 'https://demo.supabase.co',
      key: 'anon-123',
    });
    const fetchMock = jest.fn().mockResolvedValue(okResponse);

    await expect(checkSupabaseConnection(fetchMock)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('https://demo.supabase.co/auth/v1/health', {
      headers: { apikey: 'anon-123' },
    });
  });

  it('reporta el código HTTP cuando Supabase responde con error', async () => {
    const { checkSupabaseConnection } = loadWithEnv({ url: 'https://demo.supabase.co', key: 'x' });
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 401 } as Response);

    await expect(checkSupabaseConnection(fetchMock)).resolves.toEqual({
      ok: false,
      error: 'Supabase respondió 401',
    });
  });

  it('reporta errores de red', async () => {
    const { checkSupabaseConnection } = loadWithEnv({ url: 'https://demo.supabase.co', key: 'x' });
    const fetchMock = jest.fn().mockRejectedValue(new Error('Network request failed'));

    await expect(checkSupabaseConnection(fetchMock)).resolves.toEqual({
      ok: false,
      error: 'Network request failed',
    });
  });
});
