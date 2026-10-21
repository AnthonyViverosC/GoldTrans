import { Stack } from 'expo-router';

import { opcionesEncabezado } from '@/components/navegacion';
import { Colors } from '@/constants/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        ...opcionesEncabezado,
        headerTitle: '',
        headerStyle: { backgroundColor: Colors.page },
      }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="registro" />
      <Stack.Screen name="recuperar" />
    </Stack>
  );
}
