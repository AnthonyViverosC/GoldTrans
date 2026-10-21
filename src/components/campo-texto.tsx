import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

type Props = TextInputProps & {
  etiqueta: string;
  error?: string;
  ayuda?: string;
};

export function CampoTexto({ etiqueta, error, ayuda, style, secureTextEntry, onFocus, onBlur, ...rest }: Props) {
  const [enfocado, setEnfocado] = useState(false);
  const [visible, setVisible] = useState(false);
  const oculto = !!secureTextEntry && !visible;

  return (
    <View style={styles.contenedor}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <View style={[styles.caja, enfocado && styles.cajaEnfocada, !!error && styles.cajaError]}>
        <TextInput
          accessibilityLabel={etiqueta}
          placeholderTextColor={Colors.muted}
          style={[styles.input, rest.multiline && styles.multilinea, style]}
          secureTextEntry={oculto}
          onFocus={(e) => {
            setEnfocado(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setEnfocado(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={8}
            onPress={() => setVisible((v) => !v)}
            style={styles.ojo}>
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.filaError}>
          <Ionicons name="alert-circle" size={14} color={Colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : ayuda ? (
        <Text style={styles.ayuda}>{ayuda}</Text>
      ) : null}
    </View>
  );
}

export const estilosCampo = StyleSheet.create({
  etiqueta: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  caja: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius,
    backgroundColor: Colors.background,
  },
  cajaEnfocada: { borderColor: Colors.primary },
  cajaError: { borderColor: Colors.danger, backgroundColor: '#FFFBFB' },
  error: { flex: 1, color: Colors.danger, fontSize: 13 },
  ayuda: { color: Colors.muted, fontSize: 13, marginTop: Spacing.xs },
});

const styles = StyleSheet.create({
  ...estilosCampo,
  contenedor: { marginBottom: Spacing.md },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: 14,
    fontSize: 16,
    color: Colors.text,
    // En web el borde de la caja ya marca el foco
    outlineWidth: 0,
  },
  multilinea: { paddingVertical: 12, textAlignVertical: 'top' },
  ojo: { paddingHorizontal: 12, alignSelf: 'stretch', justifyContent: 'center' },
  filaError: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
});
