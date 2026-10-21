import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoFecha } from '@/components/campo-fecha';
import { CampoTexto } from '@/components/campo-texto';
import { EstadoAbonoTexto, EstadoReservaTexto } from '@/components/estado-reserva';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { ResumenPagosVista } from '@/components/resumen-pagos';
import { SelectorArchivo } from '@/components/selector-archivo';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { abrirArchivo, type ArchivoElegido } from '@/lib/archivos';
import { formatearPesos, hoyEnColombia } from '@/lib/cotizador';
import {
  AYUDA_ESTADO_RESERVA,
  DATOS_TRANSFERENCIA,
  ETIQUETA_DOCUMENTO_VIAJERO,
  cancelarReserva,
  estadoVisible,
  fechaHoraColombia,
  obtenerReserva,
  plazoRestante,
  registrarAbono,
  resumenPagos,
  saldoVencido,
  validarAbono,
  type FormularioAbono,
  type ReservaCompleta,
  type TipoDocumentoViajero,
} from '@/lib/reservas';
import { sinErrores, type Errores } from '@/lib/validacion';

// HU-23 abono con comprobante · HU-25 saldo y fecha límite · HU-26 estado de la reserva.
export default function DetalleReserva() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reserva, setReserva] = useState<ReservaCompleta | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerReserva(id).then((r) => {
      if (!vigente) return;
      if (r.ok) setReserva(r.data);
      else setErrorCarga(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [id, version]);

  if (!reserva) {
    return (
      <View style={styles.centro}>
        {errorCarga ? <Mensaje texto={errorCarga} /> : <ActivityIndicator color={Colors.primary} />}
      </View>
    );
  }

  const r = reserva;
  const estado = estadoVisible(r, r.abonos);
  const pagos = resumenPagos(r, r.abonos);
  const activa = estado === 'prerreserva' || estado === 'confirmada';

  function recargar(mensaje: string) {
    setAviso(mensaje);
    setVersion((v) => v + 1);
  }

  return (
    <PantallaFormulario margenSuperior={false}>
      <Stack.Screen options={{ title: r.codigo }} />
      <View style={styles.filaTitulo}>
        <Text style={styles.codigo}>{r.codigo}</Text>
        <EstadoReservaTexto estado={estado} />
      </View>
      <Text style={styles.ayudaEstado}>{AYUDA_ESTADO_RESERVA[estado]}</Text>
      {estado === 'prerreserva' ? (
        <Text style={styles.plazo}>
          {pagos.enRevision > 0
            ? 'Tu abono está en revisión: los cupos siguen apartados mientras el asesor lo verifica.'
            : `Registra el abono antes del ${fechaHoraColombia(r.vence_at)} · ${plazoRestante(r.vence_at)}`}
        </Text>
      ) : null}
      {estado === 'confirmada' ? (
        <Text style={[styles.plazo, saldoVencido(r) && styles.alerta]}>
          {saldoVencido(r)
            ? `El plazo para pagar el saldo venció el ${r.fecha_limite_pago}. Comunícate con un asesor.`
            : `Paga el saldo hasta el ${r.fecha_limite_pago}`}
        </Text>
      ) : null}
      {r.motivo_cancelacion ? <Text style={styles.motivo}>Motivo: {r.motivo_cancelacion}</Text> : null}
      <Mensaje tipo="exito" texto={aviso} />

      <View style={styles.paquete}>
        <Text style={styles.paqueteNombre}>{r.paquete_nombre}</Text>
        <Text style={styles.detalle}>
          {r.destino} · {r.fecha_salida} → {r.fecha_regreso}
        </Text>
        <Text style={styles.detalle}>
          {r.cupos} × {formatearPesos(r.precio_por_persona)}
        </Text>
      </View>

      <Text style={styles.seccion}>Pagos</Text>
      <ResumenPagosVista resumen={pagos} />

      {activa && pagos.porPagar > 0 ? (
        <FormularioAbonoCliente
          key={version}
          reserva={r}
          resumen={pagos}
          onRegistrado={() => recargar('Recibimos tu comprobante. Un asesor lo verificará pronto.')}
        />
      ) : null}

      {r.abonos.length > 0 ? (
        <>
          <Text style={styles.seccion}>Abonos enviados</Text>
          <Mensaje texto={errorArchivo} />
          {r.abonos.map((a) => (
            <View key={a.id} style={styles.abono}>
              <View style={styles.filaTitulo}>
                <Text style={styles.abonoValor}>{formatearPesos(a.valor)}</Text>
                <EstadoAbonoTexto estado={a.estado} />
              </View>
              <Text style={styles.detalle}>
                Transferencia del {a.fecha_transferencia}
                {a.referencia ? ` · Ref. ${a.referencia}` : ''}
              </Text>
              {a.motivo ? <Text style={styles.motivo}>Asesor: {a.motivo}</Text> : null}
              <Boton
                titulo="Ver comprobante"
                variante="texto"
                onPress={async () => {
                  const x = await abrirArchivo('comprobantes', a.comprobante_ruta);
                  setErrorArchivo(x.ok ? null : x.error);
                }}
              />
            </View>
          ))}
        </>
      ) : null}

      <Text style={styles.seccion}>Viajeros</Text>
      {r.viajeros.map((v) => (
        <View key={v.id} style={styles.viajero}>
          <Text style={styles.viajeroNombre}>{v.nombre_completo}</Text>
          <Text style={styles.detalle}>
            {ETIQUETA_DOCUMENTO_VIAJERO[v.tipo_documento as TipoDocumentoViajero] ?? v.tipo_documento}{' '}
            {v.numero_documento} · nació el {v.fecha_nacimiento}
          </Text>
        </View>
      ))}
      <Text style={styles.detalle}>Contacto: {r.telefono_contacto}</Text>
      {r.observaciones ? <Text style={styles.detalle}>Observaciones: {r.observaciones}</Text> : null}

      {estado === 'prerreserva' && r.valor_abonado === 0 ? (
        <CancelarPrerreserva reservaId={r.id} onCancelada={() => recargar('Cancelaste la reserva y liberamos los cupos.')} />
      ) : null}
    </PantallaFormulario>
  );
}

function FormularioAbonoCliente({
  reserva: r,
  resumen,
  onRegistrado,
}: {
  reserva: ReservaCompleta;
  resumen: ReturnType<typeof resumenPagos>;
  onRegistrado: () => void;
}) {
  const hoy = hoyEnColombia();
  const sugerido = resumen.minimoPendiente > 0 ? resumen.minimoPendiente : resumen.porPagar;
  const [datos, setDatos] = useState<FormularioAbono>({
    valor: String(sugerido),
    fechaTransferencia: hoy,
    referencia: '',
  });
  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null);
  const [errores, setErrores] = useState<Errores<keyof FormularioAbono | 'comprobante'>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function cambiar(campo: keyof FormularioAbono, valor: string) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function enviar() {
    const nuevos = validarAbono(datos, resumen, archivo, hoy);
    setErrores(nuevos);
    if (!sinErrores(nuevos) || !archivo) return;
    setEnviando(true);
    setError(null);
    const res = await registrarAbono(r, datos, archivo);
    setEnviando(false);
    if (res.ok) onRegistrado();
    else setError(res.error);
  }

  return (
    <>
      <Text style={styles.seccion}>Registrar abono</Text>
      <View style={styles.cuenta}>
        <Text style={styles.cuentaTitulo}>Datos para la transferencia</Text>
        <Text style={styles.cuentaTexto}>
          {DATOS_TRANSFERENCIA ?? 'Pide a un asesor de GOLDTRANS los datos de la cuenta bancaria.'}
        </Text>
        <Text style={styles.cuentaTexto}>
          Escribe el código <Text style={styles.fuerte}>{r.codigo}</Text> en la descripción de la transferencia.
        </Text>
      </View>
      {resumen.minimoPendiente > 0 ? (
        <Text style={styles.detalle}>
          Para confirmar la reserva el abono debe ser de al menos {formatearPesos(resumen.minimoPendiente)}.
        </Text>
      ) : null}
      <CampoTexto
        etiqueta="Valor transferido (COP)"
        keyboardType="number-pad"
        value={datos.valor}
        onChangeText={(v) => cambiar('valor', v)}
        error={errores.valor}
        ayuda={`Saldo por pagar: ${formatearPesos(resumen.porPagar)}`}
      />
      <CampoFecha
        etiqueta="Fecha de la transferencia"
        maximo="hoy"
        value={datos.fechaTransferencia}
        onChangeText={(v) => cambiar('fechaTransferencia', v)}
        error={errores.fechaTransferencia}
      />
      <CampoTexto
        etiqueta="Número de referencia o aprobación (opcional)"
        value={datos.referencia}
        onChangeText={(v) => cambiar('referencia', v)}
      />
      <SelectorArchivo
        etiqueta="Comprobante"
        bucket="comprobantes"
        archivo={archivo}
        onCambio={(a) => {
          setArchivo(a);
          setErrores((e) => ({ ...e, comprobante: undefined }));
        }}
        error={errores.comprobante}
        deshabilitado={enviando}
      />
      <Mensaje texto={error} />
      <Boton titulo="Enviar comprobante" onPress={enviar} cargando={enviando} />
    </>
  );
}

function CancelarPrerreserva({ reservaId, onCancelada }: { reservaId: string; onCancelada: () => void }) {
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancelar() {
    setEnviando(true);
    setError(null);
    const r = await cancelarReserva(reservaId);
    setEnviando(false);
    if (r.ok) onCancelada();
    else setError(r.error);
  }

  return (
    <View style={styles.cancelar}>
      <Mensaje texto={error} />
      {confirmar ? (
        <>
          <Text style={styles.detalle}>Los cupos quedarán libres para otros viajeros.</Text>
          <Boton titulo="Confirmar cancelación" variante="peligro" onPress={cancelar} cargando={enviando} />
          <Boton titulo="No cancelar" variante="texto" onPress={() => setConfirmar(false)} disabled={enviando} />
        </>
      ) : (
        <Boton titulo="Cancelar reserva" variante="texto" onPress={() => setConfirmar(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  codigo: { fontSize: 24, fontWeight: '700', color: Colors.primaryDark, letterSpacing: 1 },
  ayudaEstado: { fontSize: 15, color: Colors.text, marginTop: Spacing.sm },
  plazo: { fontSize: 14, color: Colors.primaryDark, fontWeight: '600', marginTop: Spacing.sm },
  alerta: { color: Colors.danger },
  motivo: {
    fontSize: 14,
    color: Colors.text,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius,
    backgroundColor: Colors.surface,
  },
  paquete: { marginTop: Spacing.md, padding: Spacing.md, borderRadius: Radius, borderWidth: 1, borderColor: Colors.border },
  paqueteNombre: { fontSize: 17, fontWeight: '700', color: Colors.text },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  seccion: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  cuenta: { padding: Spacing.md, marginBottom: Spacing.md, borderRadius: Radius, backgroundColor: Colors.surface, gap: Spacing.xs },
  cuentaTitulo: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cuentaTexto: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  fuerte: { fontWeight: '700' },
  abono: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  abonoValor: { fontSize: 16, fontWeight: '700', color: Colors.text },
  viajero: { marginBottom: Spacing.sm },
  viajeroNombre: { fontSize: 15, fontWeight: '600', color: Colors.text },
  cancelar: { marginTop: Spacing.lg, gap: Spacing.sm },
});
