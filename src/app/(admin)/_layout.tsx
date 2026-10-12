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
        tabBarLabelStyle: { fontSize: 15, fontWeight: '600' },
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen name="usuarios" options={{ title: 'Usuarios' }} />
      <Tabs.Screen name="flota" options={{ title: 'Flota' }} />
    </Tabs>
  );
}
