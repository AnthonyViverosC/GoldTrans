import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Stack, type Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, type ColorValue } from 'react-native';

import type { NombreIcono } from '@/components/boton';
import { Logo } from '@/components/logo';
import { AccionEncabezado, MenuCuenta } from '@/components/menu-cuenta';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { rutaInicio, type Rol } from '@/lib/roles';

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

/** Vuelve a la pantalla principal del rol cerrando lo que haya encima (o la abre si no está). */
export function irAlInicio(rol: Rol) {
  router.dismissTo(rutaInicio(rol));
}

/** Logo del encabezado: al tocarlo lleva a la pantalla principal del rol. */
export function LogoEncabezado({ margen = true }: { margen?: boolean }) {
  const { rol } = useAuth();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ir al inicio"
      hitSlop={8}
      onPress={() => irAlInicio(rol)}
      style={({ pressed }) => [margen ? styles.logo : styles.enPila, pressed && styles.presionado]}>
      <Logo tamano={30} />
    </Pressable>
  );
}

/** Acceso a la pantalla principal desde las pantallas públicas (solo con sesión). */
export function BotonInicio() {
  const { rol } = useAuth();
  if (rol === 'visitante') return null;
  return <AccionEncabezado icono="home-outline" texto="Inicio" onPress={() => irAlInicio(rol)} />;
}

function BotonAtras({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Atrás"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.atras, pressed && styles.presionado]}>
      {/* Mismo ícono que la flecha nativa de cada plataforma */}
      <Ionicons name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} size={24} color={Colors.primary} />
    </Pressable>
  );
}

type PropsPila = {
  route: { key: string };
  navigation: { canGoBack(): boolean; goBack(): void; getState(): { routes: readonly { key: string }[] } };
};

/**
 * Encabezado de pila que nunca deja al usuario sin salida. La primera pantalla de una pila
 * anidada no muestra flecha aunque haya historial debajo, y una pantalla abierta por enlace
 * directo (web o notificación) no tiene historial: en el primer caso se pone una flecha
 * propia y en el segundo el logo, que lleva al inicio.
 */
export function opcionesPila({ route, navigation }: PropsPila): NativeStackNavigationOptions {
  if (navigation.getState().routes[0]?.key !== route.key) return opcionesEncabezado;
  return {
    ...opcionesEncabezado,
    headerLeft: navigation.canGoBack()
      ? () => <BotonAtras onPress={() => navigation.goBack()} />
      : () => <LogoEncabezado margen={false} />,
  };
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
  // En web el encabezado de pila no deja margen al elemento de la izquierda; en móvil sí.
  enPila: { paddingLeft: Platform.OS === 'web' ? Spacing.md : 0, paddingRight: Spacing.sm },
  atras: { marginLeft: Platform.OS === 'web' ? Spacing.sm : 0, padding: 4, borderRadius: 8 },
  presionado: { opacity: 0.6 },
});
