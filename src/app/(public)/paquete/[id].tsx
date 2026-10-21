import Ionicons from '@expo/vector-icons/Ionicons';
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
import { Insignia, type Tono } from '@/components/insignia';
import { Mensaje } from '@/components/mensaje';
import { Colors, Radius, Sombra, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { fechaCorta } from '@/lib/calendario';
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

const TONO_FECHA: Record<EstadoFecha, Tono> = {
  disponible: 'exito',
  ultimos: 'advertencia',
  agotada: 'peligro',
  cerrada: 'neutro',
  pasada: 'neutro',
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
        <View style={styles.datos}>
          <Dato icono="location-outline" texto={p.destino} />
          <Dato icono="time-outline" texto={duracionTexto(p)} />
        </View>
        <View style={styles.cajaPrecio}>
          <Text style={styles.desde}>Precio por persona</Text>
          <Text style={styles.precio}>{formatearPesos(p.precio_por_persona)}</Text>
        </View>
        {p.descripcion ? <Text style={styles.texto}>{p.descripcion}</Text> : null}

        <Text style={styles.seccion}>Elige tu fecha de salida</Text>
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
                <Ionicons
                  name={elegida ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={disponible ? Colors.primary : Colors.border}
                />
                <View style={styles.fechaCuerpo}>
                  <Text style={styles.fechaTexto}>
                    {fechaCorta(f.fecha_salida)}
                    {f.fecha_regreso !== f.fecha_salida ? ` → ${fechaCorta(f.fecha_regreso)}` : ''}
                  </Text>
                  <Text style={styles.detalle}>
                    {disponible
                      ? `${f.cupos_disponibles} de ${f.cupos_totales} cupos disponibles`
                      : `${f.cupos_totales} cupos`}
                  </Text>
                </View>
                <Insignia texto={ETIQUETA_ESTADO_FECHA[estado]} tono={TONO_FECHA[estado]} />
              </Pressable>
            );
          })
        )}
        {/* HU-22 · El cliente reserva la fecha elegida; el visitante debe iniciar sesión. */}
        {fechaElegida && rol === 'cliente' ? (
          <Boton
            titulo="Reservar esta fecha"
            variante="acento"
            icono="ticket-outline"
            onPress={() => router.push({ pathname: '/reservas/nueva', params: { paquete: p.id, fecha: fechaElegida } })}
          />
        ) : null}
        {fechaElegida && rol === 'visitante' ? (
          <>
            <Mensaje tipo="exito" texto="Inicia sesión o crea tu cuenta de cliente para reservar." />
            <Boton titulo="Iniciar sesión" icono="log-in-outline" onPress={() => router.push('/login')} />
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
              <View key={i} style={styles.item}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                <Text style={styles.itemTexto}>{i}</Text>
              </View>
            ))}
          </>
        ) : null}
        {p.no_incluye.length > 0 ? (
          <>
            <Text style={styles.seccion}>No incluye</Text>
            {p.no_incluye.map((i) => (
              <View key={i} style={styles.item}>
                <Ionicons name="close-circle" size={20} color={Colors.muted} />
                <Text style={[styles.itemTexto, styles.noIncluye]}>{i}</Text>
              </View>
            ))}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Dato({ icono, texto }: { icono: 'location-outline' | 'time-outline'; texto: string }) {
  return (
    <View style={styles.dato}>
      <Ionicons name={icono} size={16} color={Colors.primary} />
      <Text style={styles.detalle}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  contenido: { paddingBottom: Spacing.xl, alignItems: 'center' },
  galeria: { flexGrow: 0, backgroundColor: Colors.surface },
  ayudaGaleria: { fontSize: 12, color: Colors.muted, marginTop: Spacing.xs },
  ancho: { width: '100%', maxWidth: 560, padding: Spacing.md },
  nombre: { fontSize: 24, fontWeight: '800', color: Colors.text },
  datos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.xs },
  dato: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detalle: { fontSize: 14, color: Colors.muted },
  cajaPrecio: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius,
    backgroundColor: Colors.accentBg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
  },
  desde: { fontSize: 13, color: Colors.accentDark, fontWeight: '600' },
  precio: { fontSize: 26, fontWeight: '800', color: Colors.text, marginTop: 2 },
  texto: { fontSize: 15, color: Colors.text, lineHeight: 22, marginTop: Spacing.sm },
  seccion: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  fecha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  fechaElegida: { borderColor: Colors.primary, backgroundColor: Colors.surface, ...Sombra },
  fechaCuerpo: { flex: 1 },
  fechaInactiva: { opacity: 0.55 },
  fechaTexto: { fontSize: 15, fontWeight: '600', color: Colors.text },
  dia: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  diaNumero: {
    alignSelf: 'flex-start',
    width: 56,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: Colors.onPrimary,
    backgroundColor: Colors.primary,
  },
  diaCuerpo: { flex: 1 },
  diaTitulo: { fontSize: 15, fontWeight: '700', color: Colors.text },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  itemTexto: { flex: 1, fontSize: 15, color: Colors.text, lineHeight: 21 },
  noIncluye: { color: Colors.muted },
});
