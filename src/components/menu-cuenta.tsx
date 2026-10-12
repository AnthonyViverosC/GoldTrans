import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { cerrarSesion } from '@/lib/auth';

/** Acciones de cuenta para el encabezado de las pantallas con sesión. */
export function MenuCuenta() {
  return (
    <View style={styles.fila}>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/perfil')}>
        <Text style={styles.enlace}>Perfil</Text>
      </Pressable>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={cerrarSesion}>
        <Text style={styles.enlace}>Salir</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: Spacing.md },
  enlace: { color: Colors.primaryDark, fontWeight: '600', fontSize: 15 },
});
