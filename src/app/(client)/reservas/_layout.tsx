import { Stack } from 'expo-router';

import { MenuCuenta } from '@/components/menu-cuenta';
import { Colors } from '@/constants/theme';

export default function ReservasLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.primaryDark,
        contentStyle: { backgroundColor: Colors.background },
      }}>
      <Stack.Screen name="index" options={{ title: 'Reservas', headerRight: () => <MenuCuenta /> }} />
      <Stack.Screen name="nueva" options={{ title: 'Reservar' }} />
      <Stack.Screen name="[id]" options={{ title: 'Reserva' }} />
    </Stack>
  );
}
