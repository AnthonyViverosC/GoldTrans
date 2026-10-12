import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ETIQUETA_ROL } from '@/lib/roles';

type Props = {
  /** Texto para la sección aún vacía (los módulos llegan en próximos sprints). */
  vacio: string;
  children?: ReactNode;
};

/** Pantalla de inicio de cada rol: saludo + acciones disponibles. */
export function InicioRol({ vacio, children }: Props) {
  const { usuario, rol } = useAuth();
  const nombre = usuario?.perfil?.razon_social || usuario?.perfil?.nombre_completo || usuario?.email;

  return (
    <PantallaFormulario margenSuperior={false}>
      <Text style={styles.saludo}>Hola, {nombre}</Text>
      <Text style={styles.rol}>{ETIQUETA_ROL[rol]}</Text>
      <View style={styles.vacio}>
        <Text style={styles.vacioTexto}>{vacio}</Text>
      </View>
      <View style={styles.acciones}>{children}</View>
    </PantallaFormulario>
  );
}

const styles = StyleSheet.create({
  saludo: { fontSize: 22, fontWeight: '700', color: Colors.text },
  rol: { fontSize: 14, color: Colors.primaryDark, marginTop: Spacing.xs },
  vacio: {
    marginVertical: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius,
    backgroundColor: Colors.surface,
  },
  vacioTexto: { color: Colors.muted, textAlign: 'center', fontSize: 15 },
  acciones: { gap: Spacing.md },
});
