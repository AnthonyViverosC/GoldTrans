import { Tabs } from 'expo-router';

import { MenuCuenta } from '@/components/menu-cuenta';
import { Colors } from '@/constants/theme';

export default function ClientLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTintColor: Colors.primaryDark,
        headerRight: () => <MenuCuenta />,
        headerRightContainerStyle: { paddingRight: 16 },
        tabBarActiveTintColor: Colors.primaryDark,
        tabBarInactiveTintColor: Colors.muted,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontSize: 15, fontWeight: '600' },
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen name="mis-cotizaciones" options={{ title: 'Cotizaciones' }} />
      <Tabs.Screen name="mis-solicitudes" options={{ title: 'Solicitudes' }} />
      <Tabs.Screen name="reservas" options={{ title: 'Reservas', headerShown: false }} />
    </Tabs>
  );
}
