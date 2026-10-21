import { Tabs } from 'expo-router';

import { MenuCuenta } from '@/components/menu-cuenta';
import { Colors } from '@/constants/theme';

export default function AdvisorLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTintColor: Colors.primaryDark,
        headerRight: () => <MenuCuenta />,
        headerRightContainerStyle: { paddingRight: 16 },
        tabBarActiveTintColor: Colors.primaryDark,
        tabBarInactiveTintColor: Colors.muted,
        tabBarIconStyle: { display: 'none' },
        // Cuatro pestañas: etiqueta un poco más pequeña para que quepan en un teléfono.
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen name="solicitudes" options={{ title: 'Solicitudes' }} />
      <Tabs.Screen name="abonos" options={{ title: 'Reservas' }} />
      <Tabs.Screen name="documentos/index" options={{ title: 'Documentos' }} />
      <Tabs.Screen name="licitaciones" options={{ title: 'Licitaciones' }} />
    </Tabs>
  );
}
