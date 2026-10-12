import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

type Props = TextInputProps & {
  etiqueta: string;
  error?: string;
  ayuda?: string;
};

export function CampoTexto({ etiqueta, error, ayuda, style, ...rest }: Props) {
  return (
    <View style={styles.contenedor}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <TextInput
        accessibilityLabel={etiqueta}
        placeholderTextColor={Colors.muted}
        style={[styles.input, !!error && styles.inputError, style]}
        {...rest}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : ayuda ? (
        <Text style={styles.ayuda}>{ayuda}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginBottom: Spacing.md },
  etiqueta: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: Spacing.xs },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius,
    paddingHorizontal: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  inputError: { borderColor: Colors.danger },
  error: { color: Colors.danger, fontSize: 13, marginTop: Spacing.xs },
  ayuda: { color: Colors.muted, fontSize: 13, marginTop: Spacing.xs },
});
