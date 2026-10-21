import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { NombreIcono } from '@/components/boton';
import { Colors, Spacing } from '@/constants/theme';
import { cerrarSesion } from '@/lib/auth';

/** Acciones de cuenta para el encabezado de las pantallas con sesión. */
export function MenuCuenta() {
  return (
    <View style={styles.fila}>
      <Accion icono="person-circle-outline" texto="Perfil" onPress={() => router.push('/perfil')} />
      <Accion icono="log-out-outline" texto="Salir" onPress={cerrarSesion} />
    </View>
  );
}

function Accion({ icono, texto, onPress }: { icono: NombreIcono; texto: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.accion, pressed && styles.presionada]}>
      <Ionicons name={icono} size={24} color={Colors.primary} />
      <Text style={styles.texto}>{texto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: Spacing.xs },
  accion: { alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  presionada: { backgroundColor: Colors.surface },
  texto: { fontSize: 10, fontWeight: '600', color: Colors.primary },
});
