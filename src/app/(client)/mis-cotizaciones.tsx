import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AccionesCompartir } from '@/components/acciones-compartir';
import { Boton } from '@/components/boton';
import { DesgloseCotizacion } from '@/components/desglose-cotizacion';
import { EstadoSolicitudTexto } from '@/components/estado-solicitud';
import { InicioRol } from '@/components/inicio-rol';
import { Mensaje } from '@/components/mensaje';
import { ModalSolicitud } from '@/components/modal-solicitud';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { desdeGuardada } from '@/lib/compartir';
import {
  ETIQUETA_SERVICIO,
  formatearPesos,
  hoyEnColombia,
  listarMisCotizaciones,
  type CotizacionHistorial,
  type TipoServicio,
} from '@/lib/cotizador';
import { ETIQUETA_TIPO, type TipoVehiculo } from '@/lib/vehiculos';

// Inicio del rol Cliente: historial de cotizaciones con su desglose (HU-14),
// envío por WhatsApp/correo/PDF (HU-15) y conversión en solicitud formal (HU-16).
export default function MisCotizaciones() {
  const { usuario } = useAuth();
  const [cotizaciones, setCotizaciones] = useState<CotizacionHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [solicitar, setSolicitar] = useState<CotizacionHistorial | null>(null);
  const hoy = hoyEnColombia();

  // Se recarga al volver del cotizador.
  useFocusEffect(
    useCallback(() => {
      if (!usuario) return;
      let vigente = true;
      listarMisCotizaciones(usuario.id).then((r) => {
        if (!vigente) return;
        setCargando(false);
        if (r.ok) {
          setCotizaciones(r.data);
          setError(null);
        } else setError(r.error);
      });
      return () => {
        vigente = false;
      };
    }, [usuario]),
  );

  return (
    <InicioRol
      vacio={!cargando && !error && cotizaciones.length === 0 ? 'Aún no tienes cotizaciones guardadas.' : undefined}>
      <Link href="/cotizador" asChild>
        <Boton titulo="Nueva cotización" />
      </Link>
      <Link href="/goldtours" asChild>
        <Boton titulo="Paquetes Goldtours" variante="secundario" />
      </Link>
      <Mensaje texto={error} />
      {cargando ? <ActivityIndicator color={Colors.primary} /> : null}

      {cotizaciones.map((c) => {
        const expandida = abierta === c.id;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityState={{ expanded: expandida }}
            accessibilityHint={expandida ? 'Ocultar desglose' : 'Ver desglose'}
            onPress={() => setAbierta(expandida ? null : c.id)}
            style={({ pressed }) => [styles.tarjeta, pressed && styles.presionada]}>
            <View style={styles.filaTitulo}>
              <Text style={styles.ruta}>
                {c.origen} → {c.destino}
              </Text>
              <Text style={styles.total}>{formatearPesos(c.valor_total)}</Text>
            </View>
            <Text style={styles.detalle}>
              {c.codigo} · {ETIQUETA_SERVICIO[c.tipo_servicio as TipoServicio]} · {c.fecha_inicio}
              {c.fecha_fin !== c.fecha_inicio ? ` al ${c.fecha_fin}` : ''}
            </Text>
            <Text style={styles.detalle}>
              {ETIQUETA_TIPO[c.tipo_vehiculo as TipoVehiculo] ?? c.tipo_vehiculo} · {c.pasajeros}{' '}
              {c.pasajeros === 1 ? 'pasajero' : 'pasajeros'}
            </Text>
            {c.solicitud ? (
              <View style={styles.solicitud}>
                <Text style={styles.detalle}>Solicitud {c.solicitud.codigo} · </Text>
                <EstadoSolicitudTexto estado={c.solicitud.estado} />
              </View>
            ) : null}
            {expandida ? (
              <View style={styles.desglose}>
                <DesgloseCotizacion lineas={c.detalle} valorTotal={c.valor_total} />
                <AccionesCompartir cotizacion={desdeGuardada(c)} />
                {!c.solicitud && c.fecha_inicio >= hoy ? (
                  <Boton titulo="Solicitar este servicio" onPress={() => setSolicitar(c)} />
                ) : null}
              </View>
            ) : null}
          </Pressable>
        );
      })}

      <ModalSolicitud
        cotizacion={solicitar}
        onCerrar={() => setSolicitar(null)}
        onCreada={() => {
          setSolicitar(null);
          router.push('/mis-solicitudes');
        }}
      />
    </InicioRol>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    padding: Spacing.md,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  presionada: { backgroundColor: Colors.surface },
  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  ruta: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.text },
  total: { fontSize: 16, fontWeight: '700', color: Colors.primaryDark },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  desglose: { marginTop: Spacing.sm },
  solicitud: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs },
});
