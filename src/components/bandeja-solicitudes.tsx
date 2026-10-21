import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { DesgloseCotizacion } from '@/components/desglose-cotizacion';
import { EstadoSolicitudTexto } from '@/components/estado-solicitud';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { SelectorOpciones } from '@/components/selector-opciones';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { enlaceWhatsApp } from '@/lib/compartir';
import { ETIQUETA_SERVICIO, formatearPesos, type TipoServicio } from '@/lib/cotizador';
import {
  listarBandeja,
  nombreCliente,
  responderSolicitud,
  validarRespuesta,
  valorSolicitud,
  type AccionAsesor,
  type EstadoSolicitud,
  type SolicitudBandeja,
} from '@/lib/solicitudes';
import { sinErrores, type Errores } from '@/lib/validacion';
import { ETIQUETA_TIPO, type TipoVehiculo } from '@/lib/vehiculos';

type Filtro = EstadoSolicitud | 'todas';

const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: 'ajustada', texto: 'Ajustadas' },
  { valor: 'confirmada', texto: 'Confirmadas' },
  { valor: 'rechazada', texto: 'Rechazadas' },
  { valor: 'todas', texto: 'Todas' },
];

const ACCIONES: { valor: AccionAsesor; texto: string }[] = [
  { valor: 'confirmar', texto: 'Confirmar' },
  { valor: 'ajustar', texto: 'Ajustar valor' },
  { valor: 'rechazar', texto: 'Rechazar' },
];

/** HU-17 · Bandeja de solicitudes del asesor comercial (también la usa el admin). */
export function BandejaSolicitudes({ encabezado }: { encabezado?: ReactNode }) {
  const [filtro, setFiltro] = useState<Filtro>('pendiente');
  const [solicitudes, setSolicitudes] = useState<SolicitudBandeja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<SolicitudBandeja | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    listarBandeja(filtro).then((r) => {
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
  }, [filtro, version]);

  function refrescar() {
    setCargando(true);
    setVersion((v) => v + 1);
  }

  return (
    <>
      <FlatList
        contentContainerStyle={styles.lista}
        data={solicitudes}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={cargando && solicitudes.length > 0} onRefresh={refrescar} />}
        ListHeaderComponent={
          <>
            {encabezado}
            <SelectorOpciones
              opciones={FILTROS}
              valor={filtro}
              onCambio={(f) => {
                setFiltro(f);
                setCargando(true);
                setSolicitudes([]);
              }}
            />
            <Mensaje texto={error} />
          </>
        }
        ListEmptyComponent={
          cargando ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <Text style={styles.vacio}>
              {filtro === 'pendiente' ? 'No hay solicitudes pendientes.' : 'No hay solicitudes en este estado.'}
            </Text>
          )
        }
        renderItem={({ item: s }) => {
          const c = s.cotizacion;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Ver y responder la solicitud"
              onPress={() => setAbierta(s)}
              style={({ pressed }) => [styles.tarjeta, pressed && styles.presionada]}>
              <View style={styles.filaTitulo}>
                <Text style={styles.codigo}>{s.codigo}</Text>
                <EstadoSolicitudTexto estado={s.estado} />
              </View>
              <Text style={styles.cliente}>{nombreCliente(s)}</Text>
              {c ? (
                <Text style={styles.detalle}>
                  {c.origen} → {c.destino} · {c.fecha_inicio}
                  {c.fecha_fin !== c.fecha_inicio ? ` al ${c.fecha_fin}` : ''}
                </Text>
              ) : null}
              <View style={styles.filaTitulo}>
                <Text style={styles.detalle}>
                  {c ? `${c.pasajeros} pas. · ${ETIQUETA_TIPO[c.tipo_vehiculo as TipoVehiculo] ?? c.tipo_vehiculo}` : ''}
                </Text>
                <Text style={styles.valor}>{formatearPesos(valorSolicitud(s))}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <Modal
        visible={abierta !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAbierta(null)}>
        {abierta ? (
          <DetalleSolicitud
            solicitud={abierta}
            onCerrar={() => setAbierta(null)}
            onRespondida={() => {
              setAbierta(null);
              refrescar();
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string | null }) {
  if (!valor) return null;
  return (
    <View style={styles.dato}>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <Text style={styles.datoValor}>{valor}</Text>
    </View>
  );
}

function DetalleSolicitud({
  solicitud: s,
  onCerrar,
  onRespondida,
}: {
  solicitud: SolicitudBandeja;
  onCerrar: () => void;
  onRespondida: () => void;
}) {
  const [accion, setAccion] = useState<AccionAsesor>('confirmar');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<Errores<'valor' | 'motivo'>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const c = s.cotizacion;
  const p = s.cliente?.perfil;
  const documento =
    p?.tipo_persona === 'empresa' ? `NIT ${p.nit}` : p?.numero_documento ? `${p.tipo_documento} ${p.numero_documento}` : null;

  async function responder() {
    const nuevos = validarRespuesta(accion, valor, motivo);
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;
    setEnviando(true);
    setError(null);
    const r = await responderSolicitud(s.id, accion, valor, motivo);
    setEnviando(false);
    if (r.ok) onRespondida();
    else setError(r.error);
  }

  function escribir() {
    const texto = `Hola ${s.nombre_contacto}, te escribimos de GOLDTRANS sobre tu solicitud ${s.codigo}.`;
    Linking.openURL(enlaceWhatsApp(texto, s.telefono_contacto)).catch(() =>
      setError('No se pudo abrir WhatsApp'),
    );
  }

  return (
    <PantallaFormulario titulo={`Solicitud ${s.codigo}`}>
      <View style={styles.filaTitulo}>
        <EstadoSolicitudTexto estado={s.estado} />
        <Text style={styles.detalle}>Recibida {s.created_at.slice(0, 10)}</Text>
      </View>

      <Text style={styles.seccion}>Cliente</Text>
      <Dato etiqueta="Nombre" valor={nombreCliente(s)} />
      <Dato etiqueta="Documento" valor={documento} />
      <Dato etiqueta="Correo" valor={s.cliente?.email} />

      <Text style={styles.seccion}>Servicio</Text>
      {c ? (
        <>
          <Dato etiqueta="Ruta" valor={`${c.origen} → ${c.destino}`} />
          <Dato
            etiqueta="Fechas"
            valor={`${ETIQUETA_SERVICIO[c.tipo_servicio as TipoServicio]} · ${c.fecha_inicio}${
              c.fecha_fin !== c.fecha_inicio ? ` al ${c.fecha_fin}` : ''
            }`}
          />
          <Dato
            etiqueta="Pasajeros y vehículo"
            valor={`${c.pasajeros} · ${ETIQUETA_TIPO[c.tipo_vehiculo as TipoVehiculo] ?? c.tipo_vehiculo} (hasta ${c.capacidad_vehiculo})`}
          />
        </>
      ) : null}
      <Dato etiqueta="Recogida" valor={`${s.hora_recogida.slice(0, 5)} · ${s.direccion_recogida}`} />
      <Dato etiqueta="Contacto" valor={`${s.nombre_contacto} · ${s.telefono_contacto}`} />
      <Dato etiqueta="Observaciones" valor={s.observaciones} />
      <Boton titulo="Escribir por WhatsApp" variante="secundario" onPress={escribir} />

      {c ? (
        <>
          <Text style={styles.seccion}>Cotización {c.codigo}</Text>
          <DesgloseCotizacion lineas={c.detalle} valorTotal={c.valor_total} />
        </>
      ) : null}

      {s.estado === 'pendiente' ? (
        <>
          <Text style={styles.seccion}>Respuesta</Text>
          <SelectorOpciones
            opciones={ACCIONES}
            valor={accion}
            onCambio={(a) => {
              setAccion(a);
              setErrores({});
            }}
          />
          {accion === 'ajustar' ? (
            <CampoTexto
              etiqueta="Nuevo valor (COP)"
              keyboardType="number-pad"
              value={valor}
              onChangeText={(v) => {
                setValor(v);
                setErrores((e) => ({ ...e, valor: undefined }));
              }}
              error={errores.valor}
              ayuda={`Valor cotizado: ${formatearPesos(s.valor_cotizado)}`}
            />
          ) : null}
          <CampoTexto
            etiqueta={accion === 'confirmar' ? 'Nota para el cliente (opcional)' : 'Motivo'}
            multiline
            style={styles.multilinea}
            value={motivo}
            onChangeText={(v) => {
              setMotivo(v);
              setErrores((e) => ({ ...e, motivo: undefined }));
            }}
            error={errores.motivo}
          />
          <Mensaje texto={error} />
          <View style={styles.botones}>
            <Boton
              titulo={ACCIONES.find((a) => a.valor === accion)?.texto ?? 'Responder'}
              variante={accion === 'rechazar' ? 'peligro' : 'primario'}
              onPress={responder}
              cargando={enviando}
            />
            <Boton titulo="Cerrar" variante="secundario" onPress={onCerrar} disabled={enviando} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.seccion}>Respuesta</Text>
          <Dato etiqueta="Valor final" valor={s.valor_final !== null ? formatearPesos(s.valor_final) : null} />
          <Dato etiqueta="Motivo / nota" valor={s.motivo} />
          <Dato etiqueta="Respondida" valor={s.respondida_at?.slice(0, 10)} />
          <Mensaje texto={error} />
          <Boton titulo="Cerrar" variante="secundario" onPress={onCerrar} />
        </>
      )}
    </PantallaFormulario>
  );
}

const styles = StyleSheet.create({
  lista: { padding: Spacing.md, gap: Spacing.md },
  vacio: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.lg },
  tarjeta: {
    padding: Spacing.md,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  presionada: { backgroundColor: Colors.surface },
  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  codigo: { fontSize: 13, fontWeight: '600', color: Colors.primaryDark, letterSpacing: 0.5 },
  cliente: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: Spacing.xs },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  valor: { fontSize: 16, fontWeight: '700', color: Colors.primaryDark },
  seccion: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  dato: { marginBottom: Spacing.sm },
  datoEtiqueta: { fontSize: 12, color: Colors.muted },
  datoValor: { fontSize: 15, color: Colors.text },
  multilinea: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  botones: { gap: Spacing.md },
});
