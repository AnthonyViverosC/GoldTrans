import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EstadoVacio } from '@/components/estado-vacio';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ETIQUETA_ROL } from '@/lib/roles';

type Props = {
  /** Texto para la sección aún vacía; se omite cuando hay contenido que mostrar. */
  vacio?: string;
  /** Accesos directos bajo el saludo. */
  accesos?: ReactNode;
  children?: ReactNode;
};

/** Pantalla de inicio de cada rol: saludo + accesos directos + contenido. */
export function InicioRol({ vacio, accesos, children }: Props) {
  const { usuario, rol } = useAuth();
  const nombre = usuario?.perfil?.razon_social || usuario?.perfil?.nombre_completo || usuario?.email;

  return (
    <PantallaFormulario margenSuperior={false}>
      <View style={styles.saludo}>
        <Text style={styles.hola}>Hola,</Text>
        <Text style={styles.nombre} numberOfLines={2}>
          {nombre}
        </Text>
        <View style={styles.rol}>
          <Text style={styles.rolTexto}>{ETIQUETA_ROL[rol]}</Text>
        </View>
      </View>
      {accesos ? <View style={styles.accesos}>{accesos}</View> : null}
      {vacio ? (
        <EstadoVacio icono="document-text-outline" texto={vacio} />
      ) : null}
      <View style={styles.contenido}>{children}</View>
    </PantallaFormulario>
  );
}

const styles = StyleSheet.create({
  saludo: {
    padding: Spacing.lg,
    borderRadius: Radius + 4,
    backgroundColor: Colors.primary,
    borderBottomWidth: 4,
    borderBottomColor: Colors.accent,
  },
  hola: { fontSize: 15, color: '#C9D6F0' },
  nombre: { fontSize: 22, fontWeight: '800', color: Colors.onPrimary, marginTop: 2 },
  rol: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Colors.accent,
  },
  rolTexto: { fontSize: 12, fontWeight: '700', color: Colors.text },
  accesos: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  contenido: { gap: Spacing.md, marginTop: Spacing.md },
});
