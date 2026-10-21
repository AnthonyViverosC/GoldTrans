import { Stack } from 'expo-router';

import { Logo } from '@/components/logo';
import { MenuCuenta } from '@/components/menu-cuenta';
import { opcionesEncabezado } from '@/components/navegacion';

export default function PaquetesLayout() {
  return (
    <Stack screenOptions={opcionesEncabezado}>
      <Stack.Screen
        name="index"
        options={{ title: 'Paquetes', headerLeft: () => <Logo tamano={30} />, headerRight: () => <MenuCuenta /> }}
      />
      <Stack.Screen name="[id]" options={{ title: 'Paquete' }} />
    </Stack>
  );
}
