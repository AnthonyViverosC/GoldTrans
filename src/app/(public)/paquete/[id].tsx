import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { Boton } from '@/components/boton';
import { Mensaje } from '@/components/mensaje';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { formatearPesos, hoyEnColombia } from '@/lib/cotizador';
import {
  ETIQUETA_ESTADO_FECHA,
  admiteReservas,
  duracionTexto,
  estadoFecha,
  obtenerPaquete,
  urlImagen,
  type EstadoFecha,
  type PaqueteCompleto,
} from '@/lib/paquetes';

const COLOR_FECHA: Record<EstadoFecha, string> = {
  disponible: Colors.success,
  ultimos: Colors.primaryDark,
  agotada: Colors.danger,
  cerrada: Colors.muted,
  pasada: Colors.muted,
};

// HU-19 · Ficha detallada del paquete: fotos, itinerario, qué incluye y fechas con cupos.
export default function FichaPaquete() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rol } = useAuth();
  const hoy = hoyEnColombia();
  const { width } = useWindowDimensions();
  const anchoFoto = Math.min(width, 560);
  const [paquete, setPaquete] = useState<PaqueteCompleto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fechaElegida, setFechaElegida] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerPaquete(id).then((r) => {
      if (!vigente) return;
      if (r.ok) setPaquete(r.data);
      else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [id]);

  if (!paquete) {
    return (
      <View style={styles.centro}>
        {error ? <Mensaje texto={error} /> : <ActivityIndicator color={Colors.primary} />}
      </View>
    );
  }

  const p = paquete;
  // Solo salidas futuras; las agotadas se muestran pero no se pueden elegir.
  const fechas = p.fechas.filter((f) => estadoFecha(f, hoy) !== 'pasada');

  return (
    <ScrollView contentContainerStyle={styles.contenido}>
      <Stack.Screen options={{ title: p.nombre }} />
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={[styles.galeria, { width: anchoFoto }]}>
        {p.imagenes.map((img) => (
          <Image
            key={img.id}
            source={urlImagen(img.ruta)}
            style={{ width: anchoFoto, aspectRatio: 4 / 3 }}
            contentFit="cover"
            transition={150}
          />
        ))}
      </ScrollView>
      {p.imagenes.length > 1 ? (
        <Text style={styles.ayudaGaleria}>Desliza para ver las {p.imagenes.length} fotos</Text>
      ) : null}

      <View style={styles.ancho}>
        <Text style={styles.nombre}>{p.nombre}</Text>
        <Text style={styles.detalle}>
          {p.destino} · {duracionTexto(p)}
        </Text>
        <Text style={styles.precio}>
          {formatearPesos(p.precio_por_persona)} <Text style={styles.porPersona}>por persona</Text>
        </Text>
        {p.descripcion ? <Text style={styles.texto}>{p.descripcion}</Text> : null}

        <Text style={styles.seccion}>Fechas de salida</Text>
        {fechas.length === 0 ? (
          <Text style={styles.texto}>No hay salidas programadas por ahora.</Text>
        ) : (
          fechas.map((f) => {
            const estado = estadoFecha(f, hoy);
            const disponible = admiteReservas(estado);
            const elegida = fechaElegida === f.id;
            return (
              <Pressable
                key={f.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: elegida, disabled: !disponible }}
                disabled={!disponible}
                onPress={() => setFechaElegida(f.id)}
                style={[styles.fecha, elegida && styles.fechaElegida, !disponible && styles.fechaInactiva]}>
                <View>
                  <Text style={styles.fechaTexto}>
                    {f.fecha_salida} → {f.fecha_regreso}
                  </Text>
                  <Text style={styles.detalle}>
                    {disponible
                      ? `${f.cupos_disponibles} de ${f.cupos_totales} cupos disponibles`
                      : `${f.cupos_totales} cupos`}
                  </Text>
                </View>
                <Text style={[styles.estado, { color: COLOR_FECHA[estado] }]}>{ETIQUETA_ESTADO_FECHA[estado]}</Text>
              </Pressable>
            );
          })
        )}
        {/* HU-22 · El cliente reserva la fecha elegida; el visitante debe iniciar sesión. */}
        {fechaElegida && rol === 'cliente' ? (
          <Boton
            titulo="Reservar esta fecha"
            onPress={() => router.push({ pathname: '/reservas/nueva', params: { paquete: p.id, fecha: fechaElegida } })}
          />
        ) : null}
        {fechaElegida && rol === 'visitante' ? (
          <>
            <Mensaje tipo="exito" texto="Inicia sesión o crea tu cuenta de cliente para reservar." />
            <Boton titulo="Iniciar sesión" onPress={() => router.push('/login')} />
          </>
        ) : null}
        {fechaElegida && (rol === 'asesor' || rol === 'admin') ? (
          <Mensaje tipo="exito" texto="Los clientes reservan desde su cuenta. Las reservas llegan a la pestaña Reservas." />
        ) : null}

        {p.itinerario.length > 0 ? (
          <>
            <Text style={styles.seccion}>Itinerario</Text>
            {p.itinerario.map((d) => (
              <View key={d.id} style={styles.dia}>
                <Text style={styles.diaNumero}>Día {d.dia}</Text>
                <View style={styles.diaCuerpo}>
                  <Text style={styles.diaTitulo}>{d.titulo}</Text>
                  {d.descripcion ? <Text style={styles.texto}>{d.descripcion}</Text> : null}
                </View>
              </View>
            ))}
          </>
        ) : null}

        {p.incluye.length > 0 ? (
          <>
            <Text style={styles.seccion}>Incluye</Text>
            {p.incluye.map((i) => (
              <Text key={i} style={styles.item}>
                ✓ {i}
              </Text>
            ))}
          </>
        ) : null}
        {p.no_incluye.length > 0 ? (
          <>
            <Text style={styles.seccion}>No incluye</Text>
            {p.no_incluye.map((i) => (
              <Text key={i} style={[styles.item, styles.noIncluye]}>
                ✕ {i}
              </Text>
            ))}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  contenido: { paddingBottom: Spacing.xl, alignItems: 'center' },
  galeria: { flexGrow: 0, backgroundColor: Colors.surface },
  ayudaGaleria: { fontSize: 12, color: Colors.muted, marginTop: Spacing.xs },
  ancho: { width: '100%', maxWidth: 560, padding: Spacing.md },
  nombre: { fontSize: 24, fontWeight: '700', color: Colors.text },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  precio: { fontSize: 22, fontWeight: '700', color: Colors.primaryDark, marginTop: Spacing.sm },
  porPersona: { fontSize: 14, fontWeight: '400', color: Colors.muted },
  texto: { fontSize: 15, color: Colors.text, lineHeight: 22, marginTop: Spacing.sm },
  seccion: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  fecha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fechaElegida: { borderColor: Colors.primaryDark, backgroundColor: Colors.surface },
  fechaInactiva: { opacity: 0.55 },
  fechaTexto: { fontSize: 15, fontWeight: '600', color: Colors.text },
  estado: { fontSize: 13, fontWeight: '700' },
  dia: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  diaNumero: { width: 52, fontSize: 13, fontWeight: '700', color: Colors.primaryDark, marginTop: 2 },
  diaCuerpo: { flex: 1 },
  diaTitulo: { fontSize: 15, fontWeight: '700', color: Colors.text },
  item: { fontSize: 15, color: Colors.text, marginBottom: Spacing.xs },
  noIncluye: { color: Colors.muted },
});
