import { Tabs } from 'expo-router';

import { iconoPestana, opcionesPestanas } from '@/components/navegacion';

export default function ClientLayout() {
  return (
    <Tabs screenOptions={opcionesPestanas}>
      <Tabs.Screen
        name="mis-cotizaciones"
        options={{ title: 'Cotizaciones', tabBarIcon: iconoPestana('calculator') }}
      />
      <Tabs.Screen
        name="mis-solicitudes"
        options={{ title: 'Solicitudes', tabBarIcon: iconoPestana('clipboard') }}
      />
      <Tabs.Screen
        name="reservas"
        options={{ title: 'Reservas', headerShown: false, tabBarIcon: iconoPestana('ticket') }}
      />
    </Tabs>
  );
}
