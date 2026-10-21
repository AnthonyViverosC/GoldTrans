import { Stack } from 'expo-router';

import { Logo } from '@/components/logo';
import { MenuCuenta } from '@/components/menu-cuenta';
import { opcionesEncabezado } from '@/components/navegacion';

export default function ReservasLayout() {
  return (
    <Stack screenOptions={opcionesEncabezado}>
      <Stack.Screen
        name="index"
        options={{ title: 'Reservas', headerLeft: () => <Logo tamano={30} />, headerRight: () => <MenuCuenta /> }}
      />
      <Stack.Screen name="nueva" options={{ title: 'Reservar' }} />
      <Stack.Screen name="[id]" options={{ title: 'Reserva' }} />
    </Stack>
  );
}
