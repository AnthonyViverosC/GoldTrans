import { Tabs } from 'expo-router';

import { iconoPestana, opcionesPestanas } from '@/components/navegacion';

export default function AdminLayout() {
  return (
    <Tabs screenOptions={opcionesPestanas}>
      <Tabs.Screen name="usuarios" options={{ title: 'Usuarios', tabBarIcon: iconoPestana('people') }} />
      <Tabs.Screen name="flota" options={{ title: 'Flota', tabBarIcon: iconoPestana('bus') }} />
      <Tabs.Screen name="rutas" options={{ title: 'Rutas', tabBarIcon: iconoPestana('map') }} />
      <Tabs.Screen name="tarifas" options={{ title: 'Tarifas', tabBarIcon: iconoPestana('pricetags') }} />
      <Tabs.Screen
        name="paquetes"
        options={{ title: 'Paquetes', headerShown: false, tabBarIcon: iconoPestana('earth') }}
      />
      <Tabs.Screen name="ventas" options={{ title: 'Ventas', tabBarIcon: iconoPestana('cash') }} />
      <Tabs.Screen
        name="documentos/index"
        options={{ title: 'Portal de licitaciones', tabBarLabel: 'Portal', tabBarIcon: iconoPestana('folder-open') }}
      />
    </Tabs>
  );
}
