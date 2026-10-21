import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BandejaSolicitudes } from '@/components/bandeja-solicitudes';
import { Boton } from '@/components/boton';
import { Spacing } from '@/constants/theme';

// Inicio del rol Asesor · HU-17 bandeja de solicitudes.
export default function Solicitudes() {
  return (
    <BandejaSolicitudes
      encabezado={
        <View style={styles.atajos}>
          <View style={styles.boton}>
            <Link href="/cotizador" asChild>
              <Boton titulo="Cotizador" variante="secundario" />
            </Link>
          </View>
          <View style={styles.boton}>
            <Link href="/goldtours" asChild>
              <Boton titulo="Goldtours" variante="secundario" />
            </Link>
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  atajos: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  boton: { flex: 1 },
});
