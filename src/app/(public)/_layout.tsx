import { Stack } from 'expo-router';

import { BotonInicio, opcionesPila } from '@/components/navegacion';

export default function PublicLayout() {
  return (
    <Stack screenOptions={(p) => ({ ...opcionesPila(p), headerRight: () => <BotonInicio /> })}>
      <Stack.Screen name="cotizador" options={{ title: 'Cotizador' }} />
      <Stack.Screen name="goldtours" options={{ title: 'Goldtours' }} />
      <Stack.Screen name="paquete/[id]" options={{ title: 'Paquete' }} />
    </Stack>
  );
}
