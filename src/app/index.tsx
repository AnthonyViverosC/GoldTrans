import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/components/logo';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { rutaInicio } from '@/lib/roles';

/** Punto de entrada: espera a restaurar la sesión y envía a la pantalla de inicio del rol. */
export default function Index() {
  const { cargando, rol } = useAuth();

  if (cargando) {
    return (
      <View style={styles.container}>
        <Logo tamano={140} />
        <Text style={styles.title}>GOLDTRANS S.A.S.</Text>
        <ActivityIndicator style={styles.spinner} color={Colors.primary} />
      </View>
    );
  }

  return <Redirect href={rutaInicio(rol)} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  title: { marginTop: Spacing.md, fontSize: 22, fontWeight: '800', color: Colors.primary, letterSpacing: 1 },
  spinner: { marginTop: Spacing.lg },
});
