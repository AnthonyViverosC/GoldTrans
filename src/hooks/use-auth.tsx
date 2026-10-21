import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { cerrarSesion, obtenerUsuarioActual, type UsuarioActual } from '@/lib/auth';
import type { Rol } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type AuthState = {
  /** true mientras se restaura la sesión guardada o se carga el usuario de una sesión nueva. */
  cargando: boolean;
  session: Session | null;
  usuario: UsuarioActual | null;
  /** Rol efectivo: "visitante" sin sesión. */
  rol: Rol;
  /** Mensaje para la pantalla de login (ej. cuenta desactivada). */
  aviso: string | null;
  recargarUsuario: () => Promise<void>;
  limpiarAviso: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<UsuarioActual | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Id del usuario cuyo perfil ya está cargado (o cargándose).
  const usuarioCargado = useRef<string | null>(null);

  const cargarUsuario = useCallback(async (s: Session | null) => {
    if (!s) {
      setUsuario(null);
      return;
    }
    const resultado = await obtenerUsuarioActual(s.user.id);
    if (!resultado.ok || !resultado.data.activo) {
      setAviso(
        resultado.ok
          ? 'Tu cuenta está desactivada. Contacta a GOLDTRANS para reactivarla.'
          : resultado.error,
      );
      setUsuario(null);
      usuarioCargado.current = null;
      await cerrarSesion();
      return;
    }
    setUsuario(resultado.data);
  }, []);

  useEffect(() => {
    let montado = true;

    // Emite INITIAL_SESSION con la sesión guardada en AsyncStorage (sesión persistente).
    const { data } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      if (!montado) return;
      setSession(nuevaSesion);

      // Solo se recarga el usuario cuando cambia la cuenta; los refrescos de token
      // y el SIGNED_IN que se emite al volver a primer plano no desmontan la navegación.
      const id = nuevaSesion?.user.id ?? null;
      if (id === usuarioCargado.current) {
        setCargando(false);
        return;
      }
      usuarioCargado.current = id;
      setCargando(true);
      // No se debe esperar otra llamada a Supabase dentro de este callback (bloquea el cliente).
      setTimeout(() => {
        cargarUsuario(nuevaSesion).finally(() => {
          if (montado) setCargando(false);
        });
      }, 0);
    });

    return () => {
      montado = false;
      data.subscription.unsubscribe();
    };
  }, [cargarUsuario]);

  const recargarUsuario = useCallback(() => cargarUsuario(session), [cargarUsuario, session]);
  const limpiarAviso = useCallback(() => setAviso(null), []);

  const value: AuthState = {
    cargando,
    session,
    usuario,
    rol: session && usuario ? usuario.rol : 'visitante',
    aviso,
    recargarUsuario,
    limpiarAviso,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
