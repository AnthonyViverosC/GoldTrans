import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { SelectorOpciones } from '@/components/selector-opciones';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { formatearPesos, hoyEnColombia } from '@/lib/cotizador';
import { admiteReservas, estadoFecha, obtenerPaquete, type FechaSalida, type PaqueteCompleto } from '@/lib/paquetes';
import {
  ABONO_MINIMO_PORCENTAJE,
  ETIQUETA_DOCUMENTO_VIAJERO,
  HORAS_PRERRESERVA,
  MAX_VIAJEROS,
  TIPOS_DOCUMENTO_VIAJERO,
  VIAJERO_VACIO,
  abonoMinimo,
  crearReserva,
  fechaLimitePago,
  reservaSinErrores,
  validarReserva,
  type ErroresReserva,
  type FormularioViajero,
  type TipoDocumentoViajero,
} from '@/lib/reservas';

const OPCIONES_DOCUMENTO = TIPOS_DOCUMENTO_VIAJERO.map((t) => ({ valor: t, texto: t }));

// HU-22 · Crear reserva con los datos de cada viajero.
export default function NuevaReserva() {
  const { paquete: paqueteId, fecha: fechaId } = useLocalSearchParams<{ paquete: string; fecha: string }>();
  const { usuario } = useAuth();
  const perfil = usuario?.perfil;
  const hoy = hoyEnColombia();

  const [paquete, setPaquete] = useState<PaqueteCompleto | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [viajeros, setViajeros] = useState<FormularioViajero[]>([
    {
      ...VIAJERO_VACIO,
      nombreCompleto: perfil?.tipo_persona === 'persona' ? perfil.nombre_completo : '',
      tipoDocumento: (TIPOS_DOCUMENTO_VIAJERO as readonly string[]).includes(perfil?.tipo_documento ?? '')
        ? (perfil?.tipo_documento as TipoDocumentoViajero)
        : 'CC',
      numeroDocumento: perfil?.numero_documento ?? '',
    },
  ]);
  const [telefono, setTelefono] = useState(perfil?.telefono ?? '');
  const [observaciones, setObservaciones] = useState('');
  const [errores, setErrores] = useState<ErroresReserva>({ viajeros: [] });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vigente = true;
    obtenerPaquete(paqueteId).then((r) => {
      if (!vigente) return;
      if (r.ok) setPaquete(r.data);
      else setErrorCarga(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [paqueteId]);

  const fecha: FechaSalida | undefined = paquete?.fechas.find((f) => f.id === fechaId);

  if (!paquete || !fecha || !admiteReservas(estadoFecha(fecha, hoy))) {
    return (
      <View style={styles.centro}>
        {errorCarga ? (
          <Mensaje texto={errorCarga} />
        ) : paquete ? (
          <Mensaje texto="Esta fecha de salida ya no admite reservas. Vuelve a la ficha del paquete y elige otra." />
        ) : (
          <ActivityIndicator color={Colors.primary} />
        )}
      </View>
    );
  }

  const disponibles = fecha.cupos_disponibles;
  const maximo = Math.min(MAX_VIAJEROS, disponibles);
  const total = viajeros.length * paquete.precio_por_persona;

  function cambiar(i: number, campo: keyof FormularioViajero, valor: string) {
    setViajeros((vs) => vs.map((v, j) => (j === i ? { ...v, [campo]: valor } : v)));
    setErrores((e) => ({
      ...e,
      general: undefined,
      viajeros: e.viajeros.map((ev, j) => (j === i ? { ...ev, [campo]: undefined } : ev)),
    }));
  }

  function quitar(i: number) {
    setViajeros((vs) => vs.filter((_, j) => j !== i));
    setErrores((e) => ({ ...e, general: undefined, viajeros: e.viajeros.filter((_, j) => j !== i) }));
  }

  async function reservar() {
    if (!fecha) return;
    const nuevos = validarReserva(viajeros, telefono, disponibles, hoy);
    setErrores(nuevos);
    if (!reservaSinErrores(nuevos)) {
      setError('Revisa los datos marcados');
      return;
    }
    setEnviando(true);
    setError(null);
    const r = await crearReserva(fecha.id, viajeros, telefono, observaciones);
    setEnviando(false);
    if (r.ok) router.replace({ pathname: '/reservas/[id]', params: { id: r.data.id } });
    else setError(r.error);
  }

  return (
    <PantallaFormulario margenSuperior={false}>
      <View style={styles.resumen}>
        <Text style={styles.paquete}>{paquete.nombre}</Text>
        <Text style={styles.detalle}>
          {paquete.destino} · {fecha.fecha_salida} → {fecha.fecha_regreso}
        </Text>
        <Text style={styles.detalle}>
          {formatearPesos(paquete.precio_por_persona)} por persona · {disponibles}{' '}
          {disponibles === 1 ? 'cupo disponible' : 'cupos disponibles'}
        </Text>
      </View>

      {viajeros.map((v, i) => {
        const ev = errores.viajeros[i] ?? {};
        return (
          <View key={i} style={styles.viajero}>
            <View style={styles.filaTitulo}>
              <Text style={styles.seccion}>Viajero {i + 1}</Text>
              {viajeros.length > 1 ? (
                <Boton titulo="Quitar" variante="texto" onPress={() => quitar(i)} disabled={enviando} />
              ) : null}
            </View>
            <CampoTexto
              etiqueta="Nombre completo"
              autoCapitalize="words"
              value={v.nombreCompleto}
              onChangeText={(t) => cambiar(i, 'nombreCompleto', t)}
              error={ev.nombreCompleto}
            />
            <SelectorOpciones
              etiqueta={`Documento: ${ETIQUETA_DOCUMENTO_VIAJERO[v.tipoDocumento]}`}
              opciones={OPCIONES_DOCUMENTO}
              valor={v.tipoDocumento}
              onCambio={(t) => cambiar(i, 'tipoDocumento', t)}
            />
            <CampoTexto
              etiqueta="Número de documento"
              autoCapitalize="characters"
              value={v.numeroDocumento}
              onChangeText={(t) => cambiar(i, 'numeroDocumento', t)}
              error={ev.numeroDocumento}
            />
            <CampoTexto
              etiqueta="Fecha de nacimiento"
              placeholder="AAAA-MM-DD"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              value={v.fechaNacimiento}
              onChangeText={(t) => cambiar(i, 'fechaNacimiento', t)}
              error={ev.fechaNacimiento}
            />
          </View>
        );
      })}

      {viajeros.length < maximo ? (
        <Boton
          titulo="Agregar viajero"
          variante="secundario"
          onPress={() => setViajeros((vs) => [...vs, { ...VIAJERO_VACIO }])}
          disabled={enviando}
        />
      ) : (
        <Text style={styles.ayuda}>
          {maximo === disponibles
            ? 'Ya agregaste todos los cupos disponibles de esta salida.'
            : `Máximo ${MAX_VIAJEROS} viajeros por reserva.`}
        </Text>
      )}

      <Text style={styles.seccion}>Contacto</Text>
      <CampoTexto
        etiqueta="Teléfono / WhatsApp"
        keyboardType="phone-pad"
        value={telefono}
        onChangeText={(t) => {
          setTelefono(t);
          setErrores((e) => ({ ...e, telefono: undefined }));
        }}
        error={errores.telefono}
      />
      <CampoTexto
        etiqueta="Observaciones (opcional)"
        placeholder="Alergias, movilidad reducida, acomodación…"
        multiline
        style={styles.multilinea}
        value={observaciones}
        onChangeText={setObservaciones}
      />

      <View style={styles.total}>
        <View style={styles.filaTitulo}>
          <Text style={styles.totalTexto}>
            Total ({viajeros.length} × {formatearPesos(paquete.precio_por_persona)})
          </Text>
          <Text style={styles.totalValor}>{formatearPesos(total)}</Text>
        </View>
        <Text style={styles.regla}>
          • Al reservar apartamos tus cupos por {HORAS_PRERRESERVA} horas.{'\n'}• Para confirmarla, transfiere al
          menos el {ABONO_MINIMO_PORCENTAJE} % ({formatearPesos(abonoMinimo(total))}) y adjunta el comprobante.{'\n'}•
          El saldo se paga hasta el {fechaLimitePago(fecha.fecha_salida, hoy)}.
        </Text>
      </View>

      <Mensaje texto={errores.general ?? error} />
      <Boton titulo="Reservar" onPress={reservar} cargando={enviando} />
    </PantallaFormulario>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  resumen: { padding: Spacing.md, borderRadius: Radius, backgroundColor: Colors.surface },
  paquete: { fontSize: 18, fontWeight: '700', color: Colors.text },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  viajero: { marginTop: Spacing.sm },
  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  seccion: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  ayuda: { fontSize: 13, color: Colors.muted, textAlign: 'center' },
  multilinea: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  total: {
    padding: Spacing.md,
    marginVertical: Spacing.md,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.primaryDark,
  },
  totalTexto: { fontSize: 15, color: Colors.text, flexShrink: 1 },
  totalValor: { fontSize: 20, fontWeight: '700', color: Colors.primaryDark },
  regla: { fontSize: 14, color: Colors.text, lineHeight: 21, marginTop: Spacing.sm },
});
