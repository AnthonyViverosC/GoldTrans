import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { Mensaje } from '@/components/mensaje';
import { SelectorOpciones } from '@/components/selector-opciones';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ETIQUETA_ROL, ROLES_ASIGNABLES, type RolAsignable } from '@/lib/roles';
import {
  actualizarUsuario,
  filtrarUsuarios,
  listarUsuarios,
  type UsuarioConPerfil,
} from '@/lib/usuarios';

const OPCIONES_ROL = ROLES_ASIGNABLES.map((r) => ({ valor: r, texto: ETIQUETA_ROL[r] }));

// HU-08 · Gestionar usuarios: activar, desactivar y cambiar rol.
export default function Usuarios() {
  const { usuario: yo } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioConPerfil[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Cambiar "version" vuelve a consultar la lista.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    listarUsuarios().then((r) => {
      if (!vigente) return;
      setCargando(false);
      if (r.ok) {
        setUsuarios(r.data);
        setError(null);
      } else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [version]);

  function refrescar() {
    setCargando(true);
    setVersion((v) => v + 1);
  }

  async function cambiar(u: UsuarioConPerfil, cambios: { rol?: RolAsignable; activo?: boolean }) {
    setOcupado(u.id);
    setError(null);
    const r = await actualizarUsuario(u.id, cambios);
    setOcupado(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setUsuarios((lista) => lista.map((x) => (x.id === u.id ? { ...x, ...r.data } : x)));
  }

  const visibles = filtrarUsuarios(usuarios, busqueda);

  return (
    <FlatList
      contentContainerStyle={styles.lista}
      data={visibles}
      keyExtractor={(u) => u.id}
      refreshControl={<RefreshControl refreshing={cargando && usuarios.length > 0} onRefresh={refrescar} />}
      ListHeaderComponent={
        <>
          <CampoTexto
            etiqueta="Buscar"
            placeholder="Nombre, correo, NIT o rol"
            autoCapitalize="none"
            value={busqueda}
            onChangeText={setBusqueda}
          />
          <Mensaje texto={error} />
        </>
      }
      ListEmptyComponent={
        cargando ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <Text style={styles.vacio}>No hay usuarios que coincidan.</Text>
        )
      }
      renderItem={({ item: u }) => {
        const esYo = u.id === yo?.id;
        const p = u.perfil;
        return (
          <View style={[styles.tarjeta, !u.activo && styles.inactiva]}>
            <Text style={styles.nombre}>{p?.razon_social || p?.nombre_completo || u.email}</Text>
            <Text style={styles.detalle}>{u.email}</Text>
            {p?.tipo_persona === 'empresa' ? (
              <Text style={styles.detalle}>
                NIT {p.nit} · Rep. {p.nombre_completo}
              </Text>
            ) : p?.numero_documento ? (
              <Text style={styles.detalle}>
                {p.tipo_documento} {p.numero_documento}
              </Text>
            ) : null}
            <Text style={[styles.estado, { color: u.activo ? Colors.success : Colors.danger }]}>
              {u.activo ? 'Activo' : 'Desactivado'}
              {esYo ? ' · Tu cuenta' : ''}
            </Text>

            <SelectorOpciones
              opciones={OPCIONES_ROL}
              valor={u.rol as RolAsignable}
              onCambio={(rol) => rol !== u.rol && cambiar(u, { rol })}
              deshabilitado={esYo || ocupado === u.id}
            />
            {!esYo ? (
              <Boton
                titulo={u.activo ? 'Desactivar' : 'Activar'}
                variante={u.activo ? 'peligro' : 'secundario'}
                cargando={ocupado === u.id}
                onPress={() => cambiar(u, { activo: !u.activo })}
              />
            ) : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  lista: { padding: Spacing.md, gap: Spacing.md },
  tarjeta: {
    padding: Spacing.md,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  inactiva: { backgroundColor: Colors.surface },
  nombre: { fontSize: 16, fontWeight: '700', color: Colors.text },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  estado: { fontSize: 13, fontWeight: '600', marginVertical: Spacing.sm },
  vacio: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.lg },
});
