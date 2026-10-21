import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { rutaInicio } from '@/lib/roles';

/** Punto de entrada: espera a restaurar la sesión y envía a la pantalla de inicio del rol. */
export default function Index() {
  const { cargando, rol } = useAuth();

  if (cargando) {
    return (
      <View style={styles.container}>
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
  title: { fontSize: 28, fontWeight: '700', color: Colors.primaryDark },
  spinner: { marginTop: 24 },
});
