import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Boton } from '@/components/boton';
import { CampoFecha } from '@/components/campo-fecha';
import { CampoTexto } from '@/components/campo-texto';
import { EstadoVacio } from '@/components/estado-vacio';
import { Insignia, type Tono } from '@/components/insignia';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { SelectorOpciones } from '@/components/selector-opciones';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatearPesos, hoyEnColombia } from '@/lib/cotizador';
import {
  ETIQUETA_VIGENCIA,
  TARIFA_VACIA,
  eliminarTarifa,
  estadoVigencia,
  guardarTarifa,
  listarTarifas,
  tarifaAFormulario,
  validarTarifa,
  type EstadoVigencia,
  type FormularioTarifa,
  type Tarifa,
} from '@/lib/tarifas';
import { sinErrores, type Errores } from '@/lib/validacion';
import { ETIQUETA_TIPO, TIPOS_VEHICULO, type TipoVehiculo } from '@/lib/vehiculos';

const TONO_VIGENCIA: Record<EstadoVigencia, Tono> = {
  vigente: 'exito',
  futura: 'info',
  vencida: 'neutro',
};

// HU-10 · Administrar tarifas por tipo de vehículo y vigencia.
export default function Tarifas() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // null = formulario cerrado; { id: undefined } = nueva tarifa.
  const [editando, setEditando] = useState<{ id?: string; datos: FormularioTarifa } | null>(null);
  const hoy = hoyEnColombia();

  // Cambiar "version" vuelve a consultar la lista.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    listarTarifas().then((r) => {
      if (!vigente) return;
      setCargando(false);
      if (r.ok) {
        setTarifas(r.data);
        setError(null);
      } else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [version]);

  function refrescar() {
    setCargando(true);
    setVersion((v) => v + 1);
  }

  return (
    <>
      <FlatList
        contentContainerStyle={styles.lista}
        data={tarifas}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={cargando && tarifas.length > 0} onRefresh={refrescar} />}
        ListHeaderComponent={
          <>
            <Boton
              titulo="Agregar tarifa"
              onPress={() => setEditando({ datos: { ...TARIFA_VACIA, vigenciaDesde: hoy } })}
            />
            <View style={styles.espacio} />
            <Mensaje texto={error} />
          </>
        }
        ListEmptyComponent={
          cargando ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <EstadoVacio icono="pricetags-outline" texto="Aún no hay tarifas registradas." />
          )
        }
        renderItem={({ item: t }) => {
          const estado = estadoVigencia(t, hoy);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Editar tarifa"
              onPress={() => setEditando({ id: t.id, datos: tarifaAFormulario(t) })}
              style={({ pressed }) => [styles.tarjeta, pressed && styles.presionada]}>
              <View style={styles.filaTitulo}>
                <Text style={styles.titulo}>{ETIQUETA_TIPO[t.tipo_vehiculo as TipoVehiculo]}</Text>
                <Insignia texto={ETIQUETA_VIGENCIA[estado]} tono={TONO_VIGENCIA[estado]} />
              </View>
              <Text style={styles.detalle}>
                Base {formatearPesos(t.tarifa_base)} · {formatearPesos(t.valor_km)}/km ·{' '}
                {formatearPesos(t.valor_dia)}/día
              </Text>
              <Text style={styles.detalle}>
                Recargo fin de semana {t.recargo_fin_semana_pct} % · Desde {t.vigencia_desde}
                {t.vigencia_hasta ? ` hasta ${t.vigencia_hasta}` : ' sin fecha de fin'}
              </Text>
            </Pressable>
          );
        }}
      />

      <Modal
        visible={editando !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditando(null)}>
        {editando ? (
          <FormularioTarifaModal
            id={editando.id}
            inicial={editando.datos}
            existentes={tarifas}
            onCerrar={() => setEditando(null)}
            onGuardado={() => {
              setEditando(null);
              refrescar();
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

function FormularioTarifaModal({
  id,
  inicial,
  existentes,
  onCerrar,
  onGuardado,
}: {
  id?: string;
  inicial: FormularioTarifa;
  existentes: readonly Tarifa[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [datos, setDatos] = useState(inicial);
  const [errores, setErrores] = useState<Errores<keyof FormularioTarifa>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  function cambiar<K extends keyof FormularioTarifa>(campo: K, valor: FormularioTarifa[K]) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function guardar() {
    const nuevos = validarTarifa(datos, existentes, id);
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;
    setGuardando(true);
    setError(null);
    const r = await guardarTarifa(datos, id);
    setGuardando(false);
    if (r.ok) onGuardado();
    else setError(r.error);
  }

  async function eliminar() {
    if (!id) return;
    setGuardando(true);
    const r = await eliminarTarifa(id);
    setGuardando(false);
    if (r.ok) onGuardado();
    else setError(r.error);
  }

  return (
    <PantallaFormulario titulo={id ? 'Editar tarifa' : 'Nueva tarifa'}>
      <SelectorOpciones
        etiqueta="Tipo de vehículo"
        opciones={TIPOS_VEHICULO.map((t) => ({ valor: t, texto: ETIQUETA_TIPO[t] }))}
        valor={datos.tipoVehiculo}
        onCambio={(v) => {
          cambiar('tipoVehiculo', v);
          setErrores((e) => ({ ...e, vigenciaDesde: undefined }));
        }}
      />
      <CampoTexto
        etiqueta="Tarifa base (COP)"
        keyboardType="number-pad"
        value={datos.tarifaBase}
        onChangeText={(v) => cambiar('tarifaBase', v)}
        error={errores.tarifaBase}
      />
      <CampoTexto
        etiqueta="Valor por kilómetro (COP)"
        keyboardType="number-pad"
        value={datos.valorKm}
        onChangeText={(v) => cambiar('valorKm', v)}
        error={errores.valorKm}
      />
      <CampoTexto
        etiqueta="Valor por día (COP)"
        keyboardType="number-pad"
        value={datos.valorDia}
        onChangeText={(v) => cambiar('valorDia', v)}
        error={errores.valorDia}
      />
      <CampoTexto
        etiqueta="Recargo fin de semana (%)"
        keyboardType="number-pad"
        value={datos.recargoFinSemana}
        onChangeText={(v) => cambiar('recargoFinSemana', v)}
        error={errores.recargoFinSemana}
        ayuda="Se aplica a los días del servicio que caen en sábado o domingo"
      />
      <CampoFecha
        etiqueta="Vigente desde"
        value={datos.vigenciaDesde}
        onChangeText={(v) => cambiar('vigenciaDesde', v)}
        error={errores.vigenciaDesde}
      />
      <CampoFecha
        etiqueta="Vigente hasta (opcional)"
        opcional
        value={datos.vigenciaHasta}
        onChangeText={(v) => cambiar('vigenciaHasta', v)}
        error={errores.vigenciaHasta}
        ayuda="Déjala vacía si no tiene fecha de fin"
      />

      <Mensaje texto={error} />
      <View style={styles.botones}>
        <Boton titulo="Guardar" onPress={guardar} cargando={guardando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={onCerrar} disabled={guardando} />
        {id ? (
          confirmarEliminar ? (
            <Boton titulo="Confirmar eliminación" variante="peligro" onPress={eliminar} cargando={guardando} />
          ) : (
            <Boton titulo="Eliminar tarifa" variante="texto" onPress={() => setConfirmarEliminar(true)} />
          )
        ) : null}
      </View>
    </PantallaFormulario>
  );
}

const styles = StyleSheet.create({
  lista: { padding: Spacing.md, gap: Spacing.md },
  espacio: { height: Spacing.md },
  tarjeta: {
    padding: Spacing.md,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  presionada: { backgroundColor: Colors.surface },
  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 16, fontWeight: '700', color: Colors.text },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  vacio: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.lg },
  botones: { gap: Spacing.md },
});
