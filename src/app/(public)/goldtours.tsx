import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { CampoTexto } from '@/components/campo-texto';
import { EstadoVacio } from '@/components/estado-vacio';
import { Insignia } from '@/components/insignia';
import { Mensaje } from '@/components/mensaje';
import { SelectorOpciones } from '@/components/selector-opciones';
import { Colors, Radius, Sombra, Spacing } from '@/constants/theme';
import { fechaCorta } from '@/lib/calendario';
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
          <EstadoVacio
            icono={paquetes.length === 0 ? 'earth-outline' : 'search-outline'}
            texto={
              paquetes.length === 0
                ? 'Pronto publicaremos nuestros paquetes turísticos.'
                : 'Ningún paquete coincide con los filtros.'
            }
          />
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
              <View style={styles.dato}>
                <Ionicons name="location-outline" size={15} color={Colors.primary} />
                <Text style={styles.detalle}>
                  {p.destino} · {duracionTexto(p)}
                </Text>
              </View>
              <View style={styles.pie}>
                <View>
                  <Text style={styles.porPersona}>Por persona</Text>
                  <Text style={styles.precio}>{formatearPesos(p.precio_por_persona)}</Text>
                </View>
                {salida ? (
                  <Insignia
                    texto={`${salida.cupos_disponibles} ${salida.cupos_disponibles === 1 ? 'cupo' : 'cupos'}${
                      estadoFecha(salida, hoy) === 'ultimos' ? ' · ¡últimos!' : ''
                    }`}
                    tono={estadoFecha(salida, hoy) === 'ultimos' ? 'advertencia' : 'exito'}
                  />
                ) : null}
              </View>
              <View style={styles.dato}>
                <Ionicons name="calendar-outline" size={15} color={Colors.muted} />
                <Text style={styles.detalle}>
                  {salida ? `Próxima salida: ${fechaCorta(salida.fecha_salida)}` : 'Sin salidas disponibles por ahora'}
                </Text>
              </View>
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
  titulo: { fontSize: 26, fontWeight: '800', color: Colors.text },
  subtitulo: { fontSize: 15, color: Colors.muted, marginTop: Spacing.xs, marginBottom: Spacing.lg },
  tarjeta: {
    borderRadius: Radius + 4,
    backgroundColor: Colors.background,
    overflow: 'hidden',
    ...Sombra,
  },
  presionada: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  foto: { width: '100%', aspectRatio: 16 / 9, backgroundColor: Colors.surface },
  cuerpo: { padding: Spacing.md, gap: Spacing.xs },
  nombre: { fontSize: 18, fontWeight: '800', color: Colors.text },
  dato: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detalle: { fontSize: 14, color: Colors.muted },
  pie: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginVertical: Spacing.xs },
  precio: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  porPersona: { fontSize: 12, color: Colors.muted },
});
