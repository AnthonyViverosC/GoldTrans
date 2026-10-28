import { StyleSheet, Text, View } from 'react-native';

import { PantallaFormulario } from '@/components/pantalla-formulario';
import { AVISO_PRIVACIDAD, VERSION_AVISO_PRIVACIDAD } from '@/constants/privacidad';
import { Colors, Radius, Spacing } from '@/constants/theme';

// RNF-03 · Aviso de privacidad (Ley 1581 de 2012). Público: se abre desde el registro y desde el perfil.
export default function Privacidad() {
  return (
    <PantallaFormulario
      titulo="Aviso de privacidad"
      subtitulo={`Tratamiento de datos personales · Ley 1581 de 2012 · Versión ${VERSION_AVISO_PRIVACIDAD}`}
      margenSuperior={false}>
      {AVISO_PRIVACIDAD.map((seccion) => (
        <View key={seccion.titulo} style={styles.seccion}>
          <Text style={styles.titulo}>{seccion.titulo}</Text>
          {seccion.parrafos.map((p) => (
            <View key={p} style={styles.item}>
              <Text style={styles.vineta}>•</Text>
              <Text style={styles.texto}>{p}</Text>
            </View>
          ))}
        </View>
      ))}
    </PantallaFormulario>
  );
}

const styles = StyleSheet.create({
  seccion: {
    backgroundColor: Colors.background,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  titulo: { fontSize: 16, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.sm },
  item: { flexDirection: 'row', marginBottom: Spacing.xs },
  vineta: { color: Colors.accentDark, marginRight: Spacing.sm, lineHeight: 21 },
  texto: { flex: 1, fontSize: 14, lineHeight: 21, color: Colors.text },
});
