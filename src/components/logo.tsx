import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import LOGO from '@/assets/images/logo.png';
import { Colors, Spacing } from '@/constants/theme';

/** Logo de GOLDTRANS (fondo transparente: úsese sobre fondos claros). */
export function Logo({ tamano = 96 }: { tamano?: number }) {
  return (
    <Image
      source={LOGO}
      style={{ width: tamano, height: tamano }}
      contentFit="contain"
      accessibilityLabel="Logo de GOLDTRANS"
    />
  );
}

/** Logo + nombre, para el encabezado de las pantallas con pestañas. */
export function MarcaEncabezado() {
  return (
    <View style={styles.marca} accessibilityRole="header" accessibilityLabel="GOLDTRANS">
      <Logo tamano={30} />
      <Text style={styles.nombre}>
        GOLD<Text style={styles.trans}>TRANS</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  marca: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: Spacing.md },
  nombre: { fontSize: 17, fontWeight: '800', color: Colors.primary, letterSpacing: 0.5 },
  trans: { color: Colors.accentDark },
});
