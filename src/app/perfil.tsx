import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { CamposPerfil } from '@/components/campos-perfil';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { cerrarSesion } from '@/lib/auth';
import { ETIQUETA_ROL } from '@/lib/roles';
import { actualizarPerfil, perfilAFormulario } from '@/lib/usuarios';
import { sinErrores, validarPerfil, type DatosPerfil, type Errores } from '@/lib/validacion';

// HU-04 · Consultar y editar perfil (todos los roles con sesión).
export default function Perfil() {
  const { usuario, recargarUsuario } = useAuth();
  const [datos, setDatos] = useState<DatosPerfil>(() => perfilAFormulario(usuario?.perfil ?? null));
  const [errores, setErrores] = useState<Errores<keyof DatosPerfil>>({});
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (!usuario) return null;

  function cambiar<K extends keyof DatosPerfil>(campo: K, valor: DatosPerfil[K]) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
    setExito(null);
  }

  async function guardar() {
    if (!usuario) return;
    const nuevos = validarPerfil(datos);
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;
    setGuardando(true);
    setError(null);
    const r = await actualizarPerfil(usuario.id, datos);
    setGuardando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setExito('Perfil actualizado');
    await recargarUsuario();
  }

  return (
    <PantallaFormulario margenSuperior={false}>
      <View style={styles.cuenta}>
        <Text style={styles.email}>{usuario.email}</Text>
        <Text style={styles.rol}>{ETIQUETA_ROL[usuario.rol]}</Text>
      </View>

      <CamposPerfil datos={datos} errores={errores} onCambio={cambiar} tipoBloqueado />

      <Mensaje texto={error} />
      <Mensaje tipo="exito" texto={exito} />
      <Boton titulo="Guardar cambios" onPress={guardar} cargando={guardando} />
      <View style={styles.espacio} />
      <Boton titulo="Cerrar sesión" variante="peligro" onPress={cerrarSesion} />
    </PantallaFormulario>
  );
}

const styles = StyleSheet.create({
  cuenta: {
    padding: Spacing.md,
    borderRadius: Radius,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.lg,
  },
  email: { fontSize: 16, fontWeight: '600', color: Colors.text },
  rol: { fontSize: 14, color: Colors.primaryDark, marginTop: Spacing.xs },
  espacio: { height: Spacing.md },
});
