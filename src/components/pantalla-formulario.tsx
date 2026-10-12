import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

type Props = {
  titulo?: string;
  subtitulo?: string;
  children: ReactNode;
  /** false cuando la pantalla ya tiene encabezado de navegación. */
  margenSuperior?: boolean;
};

export function PantallaFormulario({ titulo, subtitulo, children, margenSuperior = true }: Props) {
  return (
    <SafeAreaView
      style={styles.safe}
      edges={margenSuperior ? ['top', 'bottom', 'left', 'right'] : ['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          <View style={styles.ancho}>
            {titulo ? <Text style={styles.titulo}>{titulo}</Text> : null}
            {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  contenido: { flexGrow: 1, padding: Spacing.lg },
  ancho: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  titulo: { fontSize: 26, fontWeight: '700', color: Colors.primaryDark },
  subtitulo: { fontSize: 15, color: Colors.muted, marginTop: Spacing.xs, marginBottom: Spacing.lg },
});
