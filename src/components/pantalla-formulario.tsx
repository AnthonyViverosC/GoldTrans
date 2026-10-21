import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

type Props = {
  titulo?: string;
  subtitulo?: string;
  /** Contenido sobre el título (p. ej. el logo). */
  cabecera?: ReactNode;
  children: ReactNode;
  /** false cuando la pantalla ya tiene encabezado de navegación. */
  margenSuperior?: boolean;
};

export function PantallaFormulario({ titulo, subtitulo, cabecera, children, margenSuperior = true }: Props) {
  return (
    <SafeAreaView
      style={styles.safe}
      edges={margenSuperior ? ['top', 'bottom', 'left', 'right'] : ['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
          <View style={styles.ancho}>
            {cabecera}
            {titulo ? <Text style={styles.titulo}>{titulo}</Text> : null}
            {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}
            {!subtitulo && titulo ? <View style={styles.espacio} /> : null}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.page },
  flex: { flex: 1 },
  contenido: { flexGrow: 1, padding: Spacing.lg },
  ancho: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  titulo: { fontSize: 26, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  subtitulo: { fontSize: 15, color: Colors.muted, marginTop: Spacing.xs, marginBottom: Spacing.lg, lineHeight: 21 },
  espacio: { height: Spacing.md },
});
