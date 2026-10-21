import Ionicons from '@expo/vector-icons/Ionicons';
import type { Stack, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';

import type { NombreIcono } from '@/components/boton';
import { Logo } from '@/components/logo';
import { MenuCuenta } from '@/components/menu-cuenta';
import { Colors, Spacing } from '@/constants/theme';

type SinFuncion<T> = Exclude<NonNullable<T>, (...args: never[]) => unknown>;
type NativeStackNavigationOptions = SinFuncion<ComponentProps<typeof Stack>['screenOptions']>;
type BottomTabNavigationOptions = SinFuncion<ComponentProps<typeof Tabs>['screenOptions']>;

/** Encabezado común: blanco, título en negrilla, flecha y acciones en azul de marca. */
export const opcionesEncabezado: NativeStackNavigationOptions = {
  headerTintColor: Colors.primary,
  headerTitleStyle: { fontWeight: '700', color: Colors.text },
  headerStyle: { backgroundColor: Colors.background },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: Colors.page },
};

/** Pestañas de cada rol: logo a la izquierda, cuenta a la derecha e íconos en la barra. */
export const opcionesPestanas: BottomTabNavigationOptions = {
  headerTintColor: Colors.primary,
  headerTitleStyle: { fontWeight: '700', color: Colors.text },
  headerStyle: { backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerShadowVisible: false,
  headerLeft: () => <LogoEncabezado />,
  headerRight: () => <MenuCuenta />,
  headerRightContainerStyle: { paddingRight: Spacing.md },
  tabBarActiveTintColor: Colors.primary,
  tabBarInactiveTintColor: Colors.muted,
  tabBarStyle: { borderTopColor: Colors.border, backgroundColor: Colors.background },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
  sceneStyle: { backgroundColor: Colors.page },
};

export function LogoEncabezado() {
  return (
    <View style={styles.logo}>
      <Logo tamano={30} />
    </View>
  );
}

/** Ícono de pestaña: contorno inactivo, relleno cuando está activa. */
export function iconoPestana(nombre: string) {
  function Icono({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    const icono = (focused ? nombre : `${nombre}-outline`) as NombreIcono;
    return <Ionicons name={icono} size={size - 2} color={color as string} />;
  }
  return Icono;
}

const styles = StyleSheet.create({
  logo: { paddingLeft: Spacing.md },
});
