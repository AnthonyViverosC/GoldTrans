import { Stack } from 'expo-router';

import { MenuCuenta } from '@/components/menu-cuenta';
import { Colors } from '@/constants/theme';

export default function AdvisorLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.primaryDark,
        headerRight: () => <MenuCuenta />,
        contentStyle: { backgroundColor: Colors.background },
      }}>
      <Stack.Screen name="solicitudes" options={{ title: 'Solicitudes' }} />
    </Stack>
  );
}
