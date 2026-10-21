import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { DesgloseCotizacion } from '@/components/desglose-cotizacion';
import { EstadoSolicitudTexto } from '@/components/estado-solicitud';
import { EstadoVacio } from '@/components/estado-vacio';
import { Mensaje } from '@/components/mensaje';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ETIQUETA_SERVICIO, formatearPesos, type TipoServicio } from '@/lib/cotizador';
import {
  AYUDA_ESTADO,
  decidirSolicitud,
  listarMisSolicitudes,
  valorSolicitud,
  type EstadoSolicitud,
  type SolicitudCliente,
} from '@/lib/solicitudes';

// HU-16 · Seguimiento de las solicitudes formales del cliente.
export default function MisSolicitudes() {
  const { usuario } = useAuth();
  const [solicitudes, setSolicitudes] = useState<SolicitudCliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmarCancelar, setConfirmarCancelar] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!usuario) return;
    let vigente = true;
    listarMisSolicitudes(usuario.id).then((r) => {
      if (!vigente) return;
      setCargando(false);
      if (r.ok) {
        setSolicitudes(r.data);
        setError(null);
      } else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [usuario, version]);

  // Se recarga al entrar a la pestaña (por ejemplo, después de crear una solicitud).
  useFocusEffect(useCallback(() => setVersion((v) => v + 1), []));

  async function decidir(s: SolicitudCliente, accion: 'aceptar' | 'cancelar') {
    setOcupado(s.id);
    setError(null);
    const r = await decidirSolicitud(s.id, accion);
    setOcupado(null);
    setConfirmarCancelar(null);
    if (r.ok) setVersion((v) => v + 1);
    else setError(r.error);
  }

  return (
    <FlatList
      contentContainerStyle={styles.lista}
      data={solicitudes}
      keyExtractor={(s) => s.id}
      refreshControl={
        <RefreshControl
          refreshing={cargando && solicitudes.length > 0}
          onRefresh={() => {
            setCargando(true);
            setVersion((v) => v + 1);
          }}
        />
      }
      ListHeaderComponent={<Mensaje texto={error} />}
      ListEmptyComponent={
        cargando ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <EstadoVacio
            icono="clipboard-outline"
            texto={'Aún no tienes solicitudes. Abre una cotización en la pestaña Cotizaciones y toca «Solicitar este servicio».'}
          />
        )
      }
      renderItem={({ item: s }) => {
        const c = s.cotizacion;
        const estado = s.estado as EstadoSolicitud;
        const puedeCancelar = estado === 'pendiente' || estado === 'ajustada';
        return (
          <View style={styles.tarjeta}>
            <View style={styles.filaTitulo}>
              <Text style={styles.codigo}>{s.codigo}</Text>
              <EstadoSolicitudTexto estado={s.estado} />
            </View>
            {c ? (
              <>
                <Text style={styles.ruta}>
                  {c.origen} → {c.destino}
                </Text>
                <Text style={styles.detalle}>
                  {ETIQUETA_SERVICIO[c.tipo_servicio as TipoServicio]} · {c.fecha_inicio}
                  {c.fecha_fin !== c.fecha_inicio ? ` al ${c.fecha_fin}` : ''} · recogida {s.hora_recogida.slice(0, 5)}
                </Text>
              </>
            ) : null}
            <Text style={styles.detalle}>{s.direccion_recogida}</Text>

            <View style={styles.valores}>
              {s.valor_final !== null && s.valor_final !== s.valor_cotizado ? (
                <Text style={styles.tachado}>{formatearPesos(s.valor_cotizado)}</Text>
              ) : null}
              <Text style={styles.valor}>{formatearPesos(valorSolicitud(s))}</Text>
            </View>

            <Text style={styles.ayuda}>{AYUDA_ESTADO[estado]}</Text>
            {s.motivo ? <Text style={styles.motivo}>Asesor: {s.motivo}</Text> : null}

            {estado === 'pendiente' && c ? (
              <View style={styles.desglose}>
                <DesgloseCotizacion lineas={c.detalle} valorTotal={c.valor_total} />
              </View>
            ) : null}

            <View style={styles.botones}>
              {estado === 'ajustada' ? (
                <Boton
                  titulo={`Aceptar ${formatearPesos(valorSolicitud(s))}`}
                  cargando={ocupado === s.id}
                  onPress={() => decidir(s, 'aceptar')}
                />
              ) : null}
              {puedeCancelar ? (
                confirmarCancelar === s.id ? (
                  <Boton
                    titulo="Confirmar cancelación"
                    variante="peligro"
                    cargando={ocupado === s.id}
                    onPress={() => decidir(s, 'cancelar')}
                  />
                ) : (
                  <Boton titulo="Cancelar solicitud" variante="texto" onPress={() => setConfirmarCancelar(s.id)} />
                )
              ) : null}
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  lista: { padding: Spacing.md, gap: Spacing.md },
  vacio: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.lg, fontSize: 15 },
  tarjeta: {
    padding: Spacing.md,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codigo: { fontSize: 13, fontWeight: '600', color: Colors.primaryDark, letterSpacing: 0.5 },
  ruta: { fontSize: 17, fontWeight: '700', color: Colors.text, marginTop: Spacing.xs },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  valores: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginTop: Spacing.sm },
  tachado: { fontSize: 14, color: Colors.muted, textDecorationLine: 'line-through' },
  valor: { fontSize: 20, fontWeight: '700', color: Colors.primaryDark },
  ayuda: { fontSize: 14, color: Colors.text, marginTop: Spacing.sm },
  motivo: {
    fontSize: 14,
    color: Colors.text,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius,
    backgroundColor: Colors.surface,
  },
  desglose: { marginTop: Spacing.sm },
  botones: { gap: Spacing.sm, marginTop: Spacing.sm },
});
