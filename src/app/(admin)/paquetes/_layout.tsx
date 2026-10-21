import { Stack } from 'expo-router';

import { MenuCuenta } from '@/components/menu-cuenta';
import { Colors } from '@/constants/theme';

export default function PaquetesLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.primaryDark,
        contentStyle: { backgroundColor: Colors.background },
      }}>
      <Stack.Screen name="index" options={{ title: 'Paquetes', headerRight: () => <MenuCuenta /> }} />
      <Stack.Screen name="[id]" options={{ title: 'Paquete' }} />
    </Stack>
  );
}
