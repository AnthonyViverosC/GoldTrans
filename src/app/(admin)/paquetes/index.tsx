import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { Mensaje } from '@/components/mensaje';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatearPesos, hoyEnColombia } from '@/lib/cotizador';
import {
  duracionTexto,
  listarPaquetesAdmin,
  portada,
  proximaSalida,
  type PaqueteCompleto,
} from '@/lib/paquetes';

// HU-21 · Paquetes turísticos (administración).
export default function Paquetes() {
  const hoy = hoyEnColombia();
  const [paquetes, setPaquetes] = useState<PaqueteCompleto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    listarPaquetesAdmin().then((r) => {
      if (!vigente) return;
      setCargando(false);
      if (r.ok) {
        setPaquetes(r.data);
        setError(null);
      } else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [version]);

  // Se recarga al volver del editor.
  useFocusEffect(useCallback(() => setVersion((v) => v + 1), []));

  return (
    <FlatList
      contentContainerStyle={styles.lista}
      data={paquetes}
      keyExtractor={(p) => p.id}
      refreshControl={
        <RefreshControl
          refreshing={cargando && paquetes.length > 0}
          onRefresh={() => {
            setCargando(true);
            setVersion((v) => v + 1);
          }}
        />
      }
      ListHeaderComponent={
        <>
          <Boton
            titulo="Nuevo paquete"
            onPress={() => router.push({ pathname: '/paquetes/[id]', params: { id: 'nuevo' } })}
          />
          <View style={styles.espacio} />
          <Mensaje texto={error} />
        </>
      }
      ListEmptyComponent={
        cargando ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <Text style={styles.vacio}>Aún no hay paquetes turísticos.</Text>
        )
      }
      renderItem={({ item: p }) => {
        const foto = portada(p);
        const publicado = p.activo && p.imagenes.length > 0;
        const salida = proximaSalida(p, hoy);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Editar paquete"
            onPress={() => router.push({ pathname: '/paquetes/[id]', params: { id: p.id } })}
            style={({ pressed }) => [styles.tarjeta, pressed && styles.presionada]}>
            {foto ? (
              <Image source={foto} style={styles.foto} contentFit="cover" />
            ) : (
              <View style={[styles.foto, styles.sinFoto]}>
                <Text style={styles.sinFotoTexto}>Sin foto</Text>
              </View>
            )}
            <View style={styles.cuerpo}>
              <Text style={styles.nombre}>{p.nombre}</Text>
              <Text style={styles.detalle}>
                {p.destino} · {duracionTexto(p)}
              </Text>
              <Text style={styles.detalle}>{formatearPesos(p.precio_por_persona)} por persona</Text>
              <Text style={[styles.estado, { color: publicado ? Colors.success : Colors.muted }]}>
                {publicado ? 'Publicado' : p.activo ? 'Activo, falta foto' : 'Inactivo'}
                {salida ? ` · sale ${salida.fecha_salida}` : ' · sin salidas'}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  lista: { padding: Spacing.md, gap: Spacing.md },
  espacio: { height: Spacing.md },
  vacio: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.lg },
  tarjeta: {
    flexDirection: 'row',
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  presionada: { backgroundColor: Colors.surface },
  foto: { width: 96, minHeight: 96, backgroundColor: Colors.surface },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  sinFotoTexto: { fontSize: 12, color: Colors.muted },
  cuerpo: { flex: 1, padding: Spacing.md },
  nombre: { fontSize: 16, fontWeight: '700', color: Colors.text },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  estado: { fontSize: 13, fontWeight: '600', marginTop: Spacing.xs },
});
