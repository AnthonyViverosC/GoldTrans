import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useSupabaseHealth } from '@/hooks/use-supabase-health';

export default function Index() {
  const health = useSupabaseHealth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GOLDTRANS S.A.S.</Text>
      <Text style={styles.subtitle}>Transporte terrestre especial</Text>

      <View style={styles.status}>
        {health.status === 'loading' ? (
          <ActivityIndicator color={Colors.primary} />
        ) : health.ok ? (
          <Text style={[styles.statusText, { color: Colors.success }]}>Supabase conectado</Text>
        ) : (
          <Text style={[styles.statusText, { color: Colors.danger }]}>
            Sin conexión a Supabase: {health.error}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.muted,
    marginTop: 4,
  },
  status: {
    marginTop: 32,
    minHeight: 24,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
