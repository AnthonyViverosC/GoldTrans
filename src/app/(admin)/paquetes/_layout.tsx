import { Stack } from 'expo-router';

import { MenuCuenta } from '@/components/menu-cuenta';
import { LogoEncabezado, opcionesPila } from '@/components/navegacion';

// Con un enlace directo al detalle, la lista queda debajo y la flecha regresa a ella.
export const unstable_settings = { initialRouteName: 'index' };

export default function PaquetesLayout() {
  return (
    <Stack screenOptions={opcionesPila}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Paquetes',
          headerLeft: () => <LogoEncabezado margen={false} />,
          headerRight: () => <MenuCuenta />,
        }}
      />
      <Stack.Screen name="[id]" options={{ title: 'Paquete' }} />
    </Stack>
  );
}
