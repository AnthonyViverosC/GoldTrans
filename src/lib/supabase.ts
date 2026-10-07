import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/database';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

if (!isSupabaseConfigured) {
  console.warn(
    '[supabase] Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY. Copia .env.example a .env y complétalo.',
  );
}

// En el render estático de web (Node) no existe window, así que AsyncStorage no está disponible.
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient<Database>(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'public-anon-key',
  {
    auth: {
      storage: isServer ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: !isServer,
      detectSessionInUrl: false,
    },
  },
);

// Refresca el token solo mientras la app está en primer plano.
// https://supabase.com/docs/reference/javascript/auth-startautorefresh
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export type SupabaseHealth = { ok: true } | { ok: false; error: string };

/** Verifica que el proyecto Supabase responda y que la anon key sea válida. */
export async function checkSupabaseConnection(
  fetchFn: typeof fetch = fetch,
): Promise<SupabaseHealth> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Variables de entorno de Supabase no configuradas' };
  }
  try {
    const response = await fetchFn(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabaseAnonKey },
    });
    if (!response.ok) {
      return { ok: false, error: `Supabase respondió ${response.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
