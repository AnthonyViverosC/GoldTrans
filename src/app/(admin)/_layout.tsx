import { Tabs } from 'expo-router';

import { MenuCuenta } from '@/components/menu-cuenta';
import { Colors } from '@/constants/theme';

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTintColor: Colors.primaryDark,
        headerRight: () => <MenuCuenta />,
        headerRightContainerStyle: { paddingRight: 16 },
        tabBarActiveTintColor: Colors.primaryDark,
        tabBarInactiveTintColor: Colors.muted,
        tabBarIconStyle: { display: 'none' },
        // Siete pestañas: etiqueta más pequeña para que quepan en un teléfono.
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen name="usuarios" options={{ title: 'Usuarios' }} />
      <Tabs.Screen name="flota" options={{ title: 'Flota' }} />
      <Tabs.Screen name="rutas" options={{ title: 'Rutas' }} />
      <Tabs.Screen name="tarifas" options={{ title: 'Tarifas' }} />
      <Tabs.Screen name="paquetes" options={{ title: 'Paquetes', headerShown: false }} />
      <Tabs.Screen name="ventas" options={{ title: 'Ventas' }} />
      <Tabs.Screen name="documentos/index" options={{ title: 'Portal de licitaciones', tabBarLabel: 'Portal' }} />
    </Tabs>
  );
}
