import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { CampoTexto } from '@/components/campo-texto';
import { Mensaje } from '@/components/mensaje';
import { SelectorOpciones } from '@/components/selector-opciones';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatearPesos, hoyEnColombia } from '@/lib/cotizador';
import {
  FILTROS_INICIALES,
  destinosDe,
  duracionTexto,
  estadoFecha,
  filtrarCatalogo,
  listarCatalogo,
  portada,
  proximaSalida,
  type FiltroDuracion,
  type FiltrosCatalogo,
  type OrdenCatalogo,
  type PaqueteCompleto,
} from '@/lib/paquetes';

const DURACIONES: { valor: FiltroDuracion; texto: string }[] = [
  { valor: 'todas', texto: 'Cualquier duración' },
  { valor: '1', texto: '1 día' },
  { valor: '2-3', texto: '2 a 3 días' },
  { valor: '4+', texto: '4 días o más' },
];

const ORDENES: { valor: OrdenCatalogo; texto: string }[] = [
  { valor: 'salida', texto: 'Próxima salida' },
  { valor: 'precio', texto: 'Menor precio' },
  { valor: 'precio_desc', texto: 'Mayor precio' },
];

// HU-18 · Catálogo de paquetes turísticos con filtros. Público: visitantes y cualquier rol.
export default function Catalogo() {
  const hoy = hoyEnColombia();
  const [paquetes, setPaquetes] = useState<PaqueteCompleto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosCatalogo>(FILTROS_INICIALES);

  useEffect(() => {
    let vigente = true;
    listarCatalogo().then((r) => {
      if (!vigente) return;
      setCargando(false);
      if (r.ok) setPaquetes(r.data);
      else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const destinos = useMemo(
    () => [{ valor: '', texto: 'Todos' }, ...destinosDe(paquetes).map((d) => ({ valor: d, texto: d }))],
    [paquetes],
  );
  const visibles = filtrarCatalogo(paquetes, filtros, hoy);

  function cambiar<K extends keyof FiltrosCatalogo>(campo: K, valor: FiltrosCatalogo[K]) {
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  return (
    <FlatList
      contentContainerStyle={styles.lista}
      data={visibles}
      keyExtractor={(p) => p.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.ancho}>
          <Text style={styles.titulo}>Goldtours</Text>
          <Text style={styles.subtitulo}>Paquetes turísticos desde el Putumayo</Text>
          <CampoTexto
            etiqueta="Buscar"
            placeholder="Nombre o destino"
            value={filtros.texto}
            onChangeText={(v) => cambiar('texto', v)}
          />
          {destinos.length > 2 ? (
            <SelectorOpciones etiqueta="Destino" opciones={destinos} valor={filtros.destino} onCambio={(v) => cambiar('destino', v)} />
          ) : null}
          <SelectorOpciones etiqueta="Duración" opciones={DURACIONES} valor={filtros.duracion} onCambio={(v) => cambiar('duracion', v)} />
          <SelectorOpciones etiqueta="Ordenar por" opciones={ORDENES} valor={filtros.orden} onCambio={(v) => cambiar('orden', v)} />
          <Mensaje texto={error} />
        </View>
      }
      ListEmptyComponent={
        cargando ? (
          <ActivityIndicator color={Colors.primary} />
        ) : error ? null : (
          <Text style={styles.vacio}>
            {paquetes.length === 0
              ? 'Pronto publicaremos nuestros paquetes turísticos.'
              : 'Ningún paquete coincide con los filtros.'}
          </Text>
        )
      }
      renderItem={({ item: p }) => {
        const salida = proximaSalida(p, hoy);
        const foto = portada(p);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${p.nombre}, ${p.destino}`}
            onPress={() => router.push({ pathname: '/paquete/[id]', params: { id: p.id } })}
            style={({ pressed }) => [styles.tarjeta, styles.ancho, pressed && styles.presionada]}>
            {foto ? <Image source={foto} style={styles.foto} contentFit="cover" transition={150} /> : null}
            <View style={styles.cuerpo}>
              <Text style={styles.nombre}>{p.nombre}</Text>
              <Text style={styles.detalle}>
                {p.destino} · {duracionTexto(p)}
              </Text>
              <Text style={styles.precio}>
                {formatearPesos(p.precio_por_persona)} <Text style={styles.porPersona}>por persona</Text>
              </Text>
              <Text style={[styles.salida, !salida && styles.sinSalida]}>
                {salida
                  ? `Próxima salida ${salida.fecha_salida} · ${salida.cupos_disponibles} ${
                      salida.cupos_disponibles === 1 ? 'cupo' : 'cupos'
                    }${estadoFecha(salida, hoy) === 'ultimos' ? ' ¡últimos!' : ''}`
                  : 'Sin salidas disponibles por ahora'}
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
  ancho: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  titulo: { fontSize: 26, fontWeight: '700', color: Colors.primaryDark },
  subtitulo: { fontSize: 15, color: Colors.muted, marginTop: Spacing.xs, marginBottom: Spacing.lg },
  vacio: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.lg, fontSize: 15 },
  tarjeta: {
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  presionada: { opacity: 0.85 },
  foto: { width: '100%', aspectRatio: 16 / 9, backgroundColor: Colors.surface },
  cuerpo: { padding: Spacing.md },
  nombre: { fontSize: 18, fontWeight: '700', color: Colors.text },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  precio: { fontSize: 18, fontWeight: '700', color: Colors.primaryDark, marginTop: Spacing.sm },
  porPersona: { fontSize: 13, fontWeight: '400', color: Colors.muted },
  salida: { fontSize: 13, color: Colors.success, marginTop: Spacing.xs, fontWeight: '600' },
  sinSalida: { color: Colors.muted, fontWeight: '400' },
});
