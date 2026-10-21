import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/hooks/use-auth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

/**
 * HU-03 · Cada grupo de rutas solo existe para su rol: si el rol no coincide,
 * Expo Router redirige a la ruta inicial (index), que envía a la pantalla del rol.
 * La seguridad de los datos la imponen las políticas RLS en Supabase.
 */
function RootNavigator() {
  const { session, rol } = useAuth();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerTintColor: Colors.primaryDark,
        contentStyle: { backgroundColor: Colors.background },
      }}>
      <Stack.Screen name="index" />

      {/* Visitante */}
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="(public)" />
      {/* El enlace de recuperación crea una sesión: la pantalla debe seguir accesible. */}
      <Stack.Screen name="restablecer" />

      <Stack.Protected guard={rol === 'cliente'}>
        <Stack.Screen name="(client)" />
      </Stack.Protected>
      <Stack.Protected guard={rol === 'asesor'}>
        <Stack.Screen name="(advisor)" />
      </Stack.Protected>
      <Stack.Protected guard={rol === 'admin'}>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>

      <Stack.Protected guard={rol !== 'visitante'}>
        <Stack.Screen name="perfil" options={{ headerShown: true, title: 'Mi perfil' }} />
      </Stack.Protected>
    </Stack>
  );
}
