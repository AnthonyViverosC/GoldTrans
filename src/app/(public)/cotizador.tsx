import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AccionesCompartir } from '@/components/acciones-compartir';
import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { DesgloseCotizacion } from '@/components/desglose-cotizacion';
import { Mensaje } from '@/components/mensaje';
import { ModalSolicitud } from '@/components/modal-solicitud';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { SelectorOpciones } from '@/components/selector-opciones';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { desdeRespuesta } from '@/lib/compartir';
import {
  ETIQUETA_SERVICIO,
  MAX_DIAS,
  TIPOS_SERVICIO,
  cotizar,
  diasEntre,
  formatearDecimal,
  hoyEnColombia,
  sumarDias,
  type Cotizacion,
  type TipoServicio,
} from '@/lib/cotizador';
import type { Rol } from '@/lib/roles';
import { listarRutasActivas, type Ruta } from '@/lib/rutas';
import { requerido, sinErrores, validarEntero, validarFecha, type Errores } from '@/lib/validacion';
import { ETIQUETA_TIPO, type TipoVehiculo } from '@/lib/vehiculos';

const SERVICIOS = TIPOS_SERVICIO.map((s) => ({ valor: s, texto: ETIQUETA_SERVICIO[s] }));

type Campo = 'ruta' | 'fechaInicio' | 'fechaFin' | 'pasajeros';

function validarFechaServicio(valor: string, hoy: string): string | undefined {
  return (
    requerido(valor, 'Indica la fecha') ??
    validarFecha(valor) ??
    (valor.trim() < hoy ? 'La fecha ya pasó' : undefined)
  );
}

// HU-05 cotizar sin registro · HU-11 ruta, servicio y fecha · HU-12 sugerencia de vehículo
// HU-13 cálculo al instante · HU-14 desglose. Accesible para visitantes y cualquier rol.
export default function Cotizador() {
  const { rol } = useAuth();
  const hoy = hoyEnColombia();

  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [cargandoRutas, setCargandoRutas] = useState(true);
  const [origen, setOrigen] = useState('');
  const [rutaId, setRutaId] = useState('');
  const [servicio, setServicio] = useState<TipoServicio>('ida');
  const [fechaInicio, setFechaInicio] = useState(() => sumarDias(hoy, 1));
  const [fechaFin, setFechaFin] = useState('');
  const [pasajeros, setPasajeros] = useState('');
  const [errores, setErrores] = useState<Errores<Campo>>({});
  const [error, setError] = useState<string | null>(null);
  const [cotizando, setCotizando] = useState(false);
  const [resultado, setResultado] = useState<Cotizacion | null>(null);

  useEffect(() => {
    let vigente = true;
    listarRutasActivas().then((r) => {
      if (!vigente) return;
      setCargandoRutas(false);
      if (r.ok) setRutas(r.data);
      else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const origenes = useMemo(
    () => [...new Set(rutas.map((r) => r.origen))].map((o) => ({ valor: o, texto: o })),
    [rutas],
  );
  const destinos = rutas
    .filter((r) => r.origen === origen)
    .map((r) => ({ valor: r.id, texto: r.destino }));

  /** Cualquier cambio invalida el resultado anterior. */
  function cambiar<T>(setter: (v: T) => void, campo?: Campo) {
    return (valor: T) => {
      setter(valor);
      setResultado(null);
      if (campo) setErrores((e) => ({ ...e, [campo]: undefined }));
    };
  }

  async function calcular() {
    const conFin = servicio !== 'ida';
    const nuevos: Errores<Campo> = {
      ruta: rutaId ? undefined : 'Selecciona el origen y el destino',
      fechaInicio: validarFechaServicio(fechaInicio, hoy),
      pasajeros: validarEntero(pasajeros, 1, 80, 'Entre 1 y 80 pasajeros'),
    };
    if (conFin && (servicio === 'disponibilidad' || fechaFin.trim())) {
      nuevos.fechaFin = validarFechaServicio(fechaFin, hoy);
      if (!nuevos.fechaFin && !nuevos.fechaInicio) {
        if (fechaFin.trim() < fechaInicio.trim()) {
          nuevos.fechaFin = 'Debe ser igual o posterior a la fecha de inicio';
        } else if (diasEntre(fechaInicio.trim(), fechaFin.trim()) > MAX_DIAS) {
          nuevos.fechaFin = `El servicio puede durar máximo ${MAX_DIAS} días`;
        }
      }
    }
    setErrores(nuevos);
    setError(null);
    if (!sinErrores(nuevos)) return;

    setCotizando(true);
    const r = await cotizar({
      ruta_id: rutaId,
      tipo_servicio: servicio,
      fecha_inicio: fechaInicio.trim(),
      fecha_fin: conFin ? fechaFin.trim() || null : null,
      pasajeros: Number(pasajeros),
    });
    setCotizando(false);
    if (r.ok) setResultado(r.data);
    else setError(r.error);
  }

  return (
    <PantallaFormulario
      titulo="Cotiza tu viaje"
      subtitulo={
        rol === 'visitante'
          ? 'No necesitas una cuenta para cotizar'
          : 'Calcula el valor de tu servicio de transporte'
      }
      margenSuperior={false}>
      {cargandoRutas ? (
        <ActivityIndicator style={styles.espacio} color={Colors.primary} />
      ) : rutas.length === 0 ? (
        <Mensaje texto={error ?? 'Aún no hay rutas disponibles para cotizar. Contacta a GOLDTRANS.'} />
      ) : (
        <>
          <SelectorOpciones
            etiqueta="Origen"
            opciones={origenes}
            valor={origen}
            onCambio={cambiar((o: string) => {
              setOrigen(o);
              setRutaId('');
            }, 'ruta')}
          />
          {origen ? (
            <SelectorOpciones
              etiqueta="Destino"
              opciones={destinos}
              valor={rutaId}
              onCambio={cambiar(setRutaId, 'ruta')}
            />
          ) : null}
          {errores.ruta ? <Text style={styles.error}>{errores.ruta}</Text> : null}

          <SelectorOpciones
            etiqueta="Tipo de servicio"
            opciones={SERVICIOS}
            valor={servicio}
            onCambio={cambiar(setServicio, 'fechaFin')}
          />
          <CampoTexto
            etiqueta={servicio === 'disponibilidad' ? 'Primer día de servicio' : 'Fecha del servicio'}
            placeholder="AAAA-MM-DD"
            value={fechaInicio}
            onChangeText={cambiar(setFechaInicio, 'fechaInicio')}
            error={errores.fechaInicio}
          />
          {servicio !== 'ida' ? (
            <CampoTexto
              etiqueta={servicio === 'disponibilidad' ? 'Último día de servicio' : 'Fecha de regreso (opcional)'}
              placeholder="AAAA-MM-DD"
              value={fechaFin}
              onChangeText={cambiar(setFechaFin, 'fechaFin')}
              error={errores.fechaFin}
              ayuda={servicio === 'ida_vuelta' ? 'Si regresas el mismo día, déjala vacía' : undefined}
            />
          ) : null}
          <CampoTexto
            etiqueta="Número de pasajeros"
            keyboardType="number-pad"
            value={pasajeros}
            onChangeText={cambiar(setPasajeros, 'pasajeros')}
            error={errores.pasajeros}
            ayuda="Te sugerimos el vehículo adecuado"
          />

          <Mensaje texto={error} />
          <Boton titulo="Cotizar" onPress={calcular} cargando={cotizando} />

          {resultado ? <Resultado cotizacion={resultado} rol={rol} /> : null}
        </>
      )}
    </PantallaFormulario>
  );
}

function Resultado({ cotizacion: c, rol }: { cotizacion: Cotizacion; rol: Rol }) {
  const [solicitando, setSolicitando] = useState(false);
  const vehiculo = ETIQUETA_TIPO[c.vehiculo.tipo as TipoVehiculo] ?? c.vehiculo.tipo;
  const fechas = c.fecha_fin === c.fecha_inicio ? c.fecha_inicio : `${c.fecha_inicio} al ${c.fecha_fin}`;

  return (
    <View style={styles.resultado} accessibilityLiveRegion="polite">
      <Text style={styles.codigo}>Cotización {c.codigo}</Text>
      <Text style={styles.ruta}>
        {c.ruta.origen} → {c.ruta.destino}
      </Text>
      <Text style={styles.dato}>
        {ETIQUETA_SERVICIO[c.tipo_servicio]} · {fechas} · {formatearDecimal(c.distancia_km)} km
      </Text>

      <View style={styles.vehiculo}>
        <Text style={styles.vehiculoTitulo}>Vehículo sugerido: {vehiculo}</Text>
        <Text style={styles.dato}>
          Hasta {c.vehiculo.capacidad} pasajeros · viajan {c.pasajeros}
        </Text>
      </View>

      <DesgloseCotizacion lineas={c.desglose} valorTotal={c.valor_total} />

      <Text style={styles.pie}>
        Calculado en {formatearDecimal(Math.round(c.duracion_ms / 100) / 10)} s. Valor de referencia
        sujeto a disponibilidad; un asesor lo confirma al formalizar la solicitud.
      </Text>

      <AccionesCompartir cotizacion={desdeRespuesta(c)} />

      {rol === 'visitante' ? (
        <>
          <Text style={styles.pie}>Crea una cuenta para guardar tus cotizaciones y solicitar el servicio.</Text>
          <Link href="/registro" asChild>
            <Boton titulo="Crear cuenta" variante="secundario" />
          </Link>
        </>
      ) : rol === 'cliente' ? (
        <>
          <Boton titulo="Solicitar este servicio" onPress={() => setSolicitando(true)} />
          <Text style={styles.pie}>Quedó guardada en tu historial de cotizaciones.</Text>
          <ModalSolicitud
            cotizacion={
              solicitando
                ? { id: c.id, codigo: c.codigo, origen: c.ruta.origen, destino: c.ruta.destino, valor_total: c.valor_total }
                : null
            }
            onCerrar={() => setSolicitando(false)}
            onCreada={() => {
              setSolicitando(false);
              router.push('/mis-solicitudes');
            }}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  espacio: { marginVertical: Spacing.lg },
  error: { color: Colors.danger, fontSize: 13, marginTop: -Spacing.sm, marginBottom: Spacing.md },
  resultado: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
    gap: Spacing.xs,
  },
  codigo: { fontSize: 13, fontWeight: '600', color: Colors.primaryDark, letterSpacing: 0.5 },
  ruta: { fontSize: 20, fontWeight: '700', color: Colors.text },
  dato: { fontSize: 14, color: Colors.muted },
  vehiculo: {
    marginVertical: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius,
    backgroundColor: Colors.surface,
  },
  vehiculoTitulo: { fontSize: 16, fontWeight: '700', color: Colors.text },
  pie: { fontSize: 13, color: Colors.muted, marginTop: Spacing.sm },
});
