import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

export default function PublicLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.primaryDark,
        contentStyle: { backgroundColor: Colors.background },
      }}>
      <Stack.Screen name="cotizador" options={{ title: 'Cotizador' }} />
      <Stack.Screen name="goldtours" options={{ title: 'Goldtours' }} />
      <Stack.Screen name="paquete/[id]" options={{ title: 'Paquete' }} />
    </Stack>
  );
}
