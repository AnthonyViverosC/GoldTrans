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
import { EstadoAbonoTexto, EstadoReservaTexto } from '@/components/estado-reserva';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { ResumenPagosVista } from '@/components/resumen-pagos';
import { SelectorOpciones } from '@/components/selector-opciones';
import { VistaComprobante } from '@/components/vista-comprobante';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { enlaceWhatsApp } from '@/lib/compartir';
import { formatearPesos } from '@/lib/cotizador';
import {
  ETIQUETA_DOCUMENTO_VIAJERO,
  cancelarReserva,
  esActiva,
  estadoVisible,
  fechaHoraColombia,
  listarBandejaReservas,
  obtenerReservaBandeja,
  plazoRestante,
  resumenPagos,
  saldoVencido,
  validarVerificacion,
  verificarAbono,
  type Abono,
  type AccionAbono,
  type FiltroBandeja,
  type ReservaBandeja,
  type TipoDocumentoViajero,
} from '@/lib/reservas';
import { nombreCliente } from '@/lib/solicitudes';

const FILTROS: { valor: FiltroBandeja; texto: string }[] = [
  { valor: 'por_verificar', texto: 'Abonos por verificar' },
  { valor: 'prerreserva', texto: 'Prerreservas' },
  { valor: 'confirmada', texto: 'Confirmadas' },
  { valor: 'pagada', texto: 'Pagadas' },
  { valor: 'vencida', texto: 'Vencidas' },
  { valor: 'cancelada', texto: 'Canceladas' },
  { valor: 'todas', texto: 'Todas' },
];

/** HU-24 · HU-25 · HU-26 · Reservas Goldtours y verificación de abonos (asesor y admin). */
export function BandejaReservas({ encabezado }: { encabezado?: ReactNode }) {
  const [filtro, setFiltro] = useState<FiltroBandeja>('por_verificar');
  const [reservas, setReservas] = useState<ReservaBandeja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    listarBandejaReservas(filtro).then((r) => {
      if (!vigente) return;
      setCargando(false);
      if (r.ok) {
        setReservas(r.data);
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
        data={reservas}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={cargando && reservas.length > 0} onRefresh={refrescar} />}
        ListHeaderComponent={
          <>
            {encabezado}
            <SelectorOpciones
              opciones={FILTROS}
              valor={filtro}
              onCambio={(f) => {
                setFiltro(f);
                setCargando(true);
                setReservas([]);
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
              {filtro === 'por_verificar' ? 'No hay abonos por verificar.' : 'No hay reservas en este estado.'}
            </Text>
          )
        }
        renderItem={({ item: r }) => {
          const pendientes = r.abonos.filter((a) => a.estado === 'pendiente').length;
          const estado = estadoVisible(r, r.abonos);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Ver la reserva y verificar abonos"
              onPress={() => setAbierta(r.id)}
              style={({ pressed }) => [styles.tarjeta, pressed && styles.presionada]}>
              <View style={styles.fila}>
                <Text style={styles.codigo}>{r.codigo}</Text>
                <EstadoReservaTexto estado={estado} />
              </View>
              <Text style={styles.cliente}>{nombreCliente(r)}</Text>
              <Text style={styles.detalle}>
                {r.paquete_nombre} · sale {r.fecha_salida} · {r.cupos} {r.cupos === 1 ? 'viajero' : 'viajeros'}
              </Text>
              <View style={styles.fila}>
                <Text style={[styles.detalle, (pendientes > 0 || saldoVencido(r)) && styles.alerta]}>
                  {pendientes > 0
                    ? `${pendientes} ${pendientes === 1 ? 'abono' : 'abonos'} por verificar`
                    : saldoVencido(r)
                      ? `Pago atrasado (límite ${r.fecha_limite_pago})`
                      : ''}
                </Text>
                <Text style={styles.valor}>
                  {esActiva(r.estado) && r.saldo > 0
                    ? `Saldo ${formatearPesos(r.saldo)}`
                    : formatearPesos(r.valor_total)}
                </Text>
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
          <DetalleReserva
            reservaId={abierta}
            onCerrar={() => {
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

function DetalleReserva({ reservaId, onCerrar }: { reservaId: string; onCerrar: () => void }) {
  const [reserva, setReserva] = useState<ReservaBandeja | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    obtenerReservaBandeja(reservaId).then((r) => {
      if (!vigente) return;
      if (r.ok) setReserva(r.data);
      else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [reservaId, version]);

  if (!reserva) {
    return (
      <PantallaFormulario titulo="Reserva">
        {error ? <Mensaje texto={error} /> : <ActivityIndicator color={Colors.primary} />}
        <Boton titulo="Cerrar" variante="secundario" onPress={onCerrar} />
      </PantallaFormulario>
    );
  }

  const r = reserva;
  const p = r.cliente?.perfil;
  const estado = estadoVisible(r, r.abonos);
  const documento =
    p?.tipo_persona === 'empresa' ? `NIT ${p.nit}` : p?.numero_documento ? `${p.tipo_documento} ${p.numero_documento}` : null;

  function recargar(mensaje: string) {
    setAviso(mensaje);
    setVersion((v) => v + 1);
  }

  function escribir() {
    const texto = `Hola, te escribimos de GOLDTRANS sobre tu reserva ${r.codigo} (${r.paquete_nombre}).`;
    Linking.openURL(enlaceWhatsApp(texto, r.telefono_contacto)).catch(() => setError('No se pudo abrir WhatsApp'));
  }

  return (
    <PantallaFormulario titulo={`Reserva ${r.codigo}`}>
      <View style={styles.fila}>
        <EstadoReservaTexto estado={estado} />
        <Text style={styles.detalle}>Creada {fechaHoraColombia(r.created_at)}</Text>
      </View>
      {estado === 'prerreserva' ? (
        <Text style={styles.plazo}>
          Plazo del primer abono: {fechaHoraColombia(r.vence_at)} · {plazoRestante(r.vence_at)}
        </Text>
      ) : null}
      {esActiva(r.estado) && r.saldo > 0 ? (
        <Text style={[styles.plazo, saldoVencido(r) && styles.alerta]}>
          Saldo hasta el {r.fecha_limite_pago}
          {saldoVencido(r) ? ' · atrasado' : ''}
        </Text>
      ) : null}
      {r.motivo_cancelacion ? <Text style={styles.nota}>Motivo: {r.motivo_cancelacion}</Text> : null}
      <Mensaje tipo="exito" texto={aviso} />
      <Mensaje texto={error} />

      <Text style={styles.seccion}>Cliente</Text>
      <Dato etiqueta="Nombre" valor={nombreCliente(r)} />
      <Dato etiqueta="Documento" valor={documento} />
      <Dato etiqueta="Correo" valor={r.cliente?.email} />
      <Dato etiqueta="Teléfono de contacto" valor={r.telefono_contacto} />
      <Dato etiqueta="Observaciones" valor={r.observaciones} />
      <Boton titulo="Escribir por WhatsApp" variante="secundario" onPress={escribir} />

      <Text style={styles.seccion}>Paquete</Text>
      <Dato etiqueta="Paquete" valor={`${r.paquete_nombre} · ${r.destino}`} />
      <Dato etiqueta="Fechas" valor={`${r.fecha_salida} → ${r.fecha_regreso}`} />
      <Dato etiqueta="Cupos" valor={`${r.cupos} × ${formatearPesos(r.precio_por_persona)}`} />

      <Text style={styles.seccion}>Pagos</Text>
      <ResumenPagosVista resumen={resumenPagos(r, r.abonos)} />
      <Text style={styles.detalle}>Abono mínimo para confirmar: {formatearPesos(r.abono_minimo)}</Text>

      <Text style={styles.seccion}>Abonos</Text>
      {r.abonos.length === 0 ? <Text style={styles.detalle}>El cliente aún no ha enviado comprobantes.</Text> : null}
      {r.abonos.map((a) => (
        <TarjetaAbono key={a.id} abono={a} onVerificado={recargar} />
      ))}

      <Text style={styles.seccion}>Viajeros</Text>
      {r.viajeros.map((v) => (
        <Dato
          key={v.id}
          etiqueta={`${v.orden}. ${v.nombre_completo}`}
          valor={`${ETIQUETA_DOCUMENTO_VIAJERO[v.tipo_documento as TipoDocumentoViajero] ?? v.tipo_documento} ${v.numero_documento} · nació el ${v.fecha_nacimiento}`}
        />
      ))}

      {esActiva(r.estado) ? (
        <CancelarReserva
          reservaId={r.id}
          conAbonos={r.valor_abonado > 0}
          onCancelada={() => recargar('Reserva cancelada. Los cupos quedaron libres.')}
        />
      ) : null}
      <View style={styles.cerrar}>
        <Boton titulo="Cerrar" variante="secundario" onPress={onCerrar} />
      </View>
    </PantallaFormulario>
  );
}

function TarjetaAbono({ abono: a, onVerificado }: { abono: Abono; onVerificado: (mensaje: string) => void }) {
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<AccionAbono | null>(null);
  const [verComprobante, setVerComprobante] = useState(a.estado === 'pendiente');

  async function verificar(accion: AccionAbono) {
    const problema = validarVerificacion(accion, motivo);
    setErrorMotivo(problema);
    if (problema) return;
    setEnviando(accion);
    setError(null);
    const r = await verificarAbono(a.id, accion, motivo);
    setEnviando(null);
    if (r.ok) onVerificado(accion === 'aprobar' ? 'Abono aprobado.' : 'Abono rechazado. El cliente verá el motivo.');
    else setError(r.error);
  }

  return (
    <View style={[styles.abono, a.estado === 'pendiente' && styles.abonoPendiente]}>
      <View style={styles.fila}>
        <Text style={styles.abonoValor}>{formatearPesos(a.valor)}</Text>
        <EstadoAbonoTexto estado={a.estado} />
      </View>
      <Text style={styles.detalle}>
        Transferencia del {a.fecha_transferencia}
        {a.referencia ? ` · Ref. ${a.referencia}` : ''} · enviado {fechaHoraColombia(a.created_at)}
      </Text>
      {a.motivo ? <Text style={styles.nota}>{a.estado === 'rechazado' ? 'Motivo' : 'Nota'}: {a.motivo}</Text> : null}

      {verComprobante ? (
        <VistaComprobante abono={a} />
      ) : (
        <Boton titulo="Ver comprobante" variante="texto" onPress={() => setVerComprobante(true)} />
      )}

      {a.estado === 'pendiente' ? (
        <View style={styles.verificar}>
          <CampoTexto
            etiqueta="Motivo (obligatorio para rechazar)"
            placeholder="Ej.: el valor del comprobante no coincide"
            multiline
            style={styles.multilinea}
            value={motivo}
            onChangeText={(v) => {
              setMotivo(v);
              setErrorMotivo(undefined);
            }}
            error={errorMotivo}
          />
          <Mensaje texto={error} />
          <View style={styles.botonesFila}>
            <View style={styles.flex}>
              <Boton
                titulo="Aprobar"
                onPress={() => verificar('aprobar')}
                cargando={enviando === 'aprobar'}
                disabled={enviando !== null}
              />
            </View>
            <View style={styles.flex}>
              <Boton
                titulo="Rechazar"
                variante="peligro"
                onPress={() => verificar('rechazar')}
                cargando={enviando === 'rechazar'}
                disabled={enviando !== null}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function CancelarReserva({
  reservaId,
  conAbonos,
  onCancelada,
}: {
  reservaId: string;
  conAbonos: boolean;
  onCancelada: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cancelar() {
    if (!motivo.trim()) {
      setErrorMotivo('Indica el motivo de la cancelación');
      return;
    }
    setEnviando(true);
    setError(null);
    const r = await cancelarReserva(reservaId, motivo);
    setEnviando(false);
    if (r.ok) onCancelada();
    else setError(r.error);
  }

  if (!abierto) {
    return (
      <View style={styles.cerrar}>
        <Boton titulo="Cancelar reserva" variante="texto" onPress={() => setAbierto(true)} />
      </View>
    );
  }

  return (
    <>
      <Text style={styles.seccion}>Cancelar reserva</Text>
      {conAbonos ? (
        <Mensaje texto="La reserva tiene abonos aprobados: la devolución del dinero se gestiona por fuera de la app." />
      ) : null}
      <CampoTexto
        etiqueta="Motivo"
        multiline
        style={styles.multilinea}
        value={motivo}
        onChangeText={(v) => {
          setMotivo(v);
          setErrorMotivo(undefined);
        }}
        error={errorMotivo}
      />
      <Mensaje texto={error} />
      <View style={styles.botones}>
        <Boton titulo="Confirmar cancelación" variante="peligro" onPress={cancelar} cargando={enviando} />
        <Boton titulo="No cancelar" variante="texto" onPress={() => setAbierto(false)} disabled={enviando} />
      </View>
    </>
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
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  codigo: { fontSize: 13, fontWeight: '600', color: Colors.primaryDark, letterSpacing: 0.5 },
  cliente: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: Spacing.xs },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2, flexShrink: 1 },
  alerta: { color: Colors.danger, fontWeight: '600' },
  valor: { fontSize: 16, fontWeight: '700', color: Colors.primaryDark },
  plazo: { fontSize: 14, color: Colors.primaryDark, fontWeight: '600', marginTop: Spacing.sm },
  nota: {
    fontSize: 14,
    color: Colors.text,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius,
    backgroundColor: Colors.surface,
  },
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
  abono: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  abonoPendiente: { borderColor: Colors.primaryDark },
  abonoValor: { fontSize: 17, fontWeight: '700', color: Colors.text },
  verificar: { marginTop: Spacing.sm },
  multilinea: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
  botonesFila: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
  botones: { gap: Spacing.md },
  cerrar: { marginTop: Spacing.lg },
});
