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
import { CampoTexto } from '@/components/campo-texto';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { SelectorOpciones } from '@/components/selector-opciones';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { sinErrores, type Errores } from '@/lib/validacion';
import {
  ESTADOS_VEHICULO,
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO,
  TIPOS_VEHICULO,
  VEHICULO_VACIO,
  eliminarVehiculo,
  guardarVehiculo,
  listarVehiculos,
  validarVehiculo,
  vehiculoAFormulario,
  type EstadoVehiculo,
  type FormularioVehiculo,
  type TipoVehiculo,
  type Vehiculo,
} from '@/lib/vehiculos';

const COLOR_ESTADO: Record<EstadoVehiculo, string> = {
  disponible: Colors.success,
  mantenimiento: Colors.primaryDark,
  inactivo: Colors.danger,
};

// HU-06 · Administrar flota de vehículos.
export default function Flota() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // null = formulario cerrado; { id: undefined } = nuevo vehículo.
  const [editando, setEditando] = useState<{ id?: string; datos: FormularioVehiculo } | null>(null);

  // Cambiar "version" vuelve a consultar la lista.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    listarVehiculos().then((r) => {
      if (!vigente) return;
      setCargando(false);
      if (r.ok) {
        setVehiculos(r.data);
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
        data={vehiculos}
        keyExtractor={(v) => v.id}
        refreshControl={<RefreshControl refreshing={cargando && vehiculos.length > 0} onRefresh={refrescar} />}
        ListHeaderComponent={
          <>
            <Boton
              titulo="Agregar vehículo"
              onPress={() => setEditando({ datos: VEHICULO_VACIO })}
            />
            <View style={styles.espacio} />
            <Mensaje texto={error} />
          </>
        }
        ListEmptyComponent={
          cargando ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <Text style={styles.vacio}>Aún no hay vehículos registrados.</Text>
          )
        }
        renderItem={({ item: v }) => {
          const estado = v.estado as EstadoVehiculo;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Editar vehículo"
              onPress={() => setEditando({ id: v.id, datos: vehiculoAFormulario(v) })}
              style={({ pressed }) => [styles.tarjeta, pressed && styles.presionada]}>
              <View style={styles.filaTitulo}>
                <Text style={styles.placa}>{v.placa}</Text>
                <Text style={[styles.estado, { color: COLOR_ESTADO[estado] }]}>
                  {ETIQUETA_ESTADO[estado]}
                </Text>
              </View>
              <Text style={styles.detalle}>
                {ETIQUETA_TIPO[v.tipo as TipoVehiculo]} · {v.marca} {v.modelo} {v.anio}
              </Text>
              <Text style={styles.detalle}>{v.capacidad_pasajeros} pasajeros</Text>
              {v.soat_vence || v.tecnomecanica_vence ? (
                <Text style={styles.detalle}>
                  {v.soat_vence ? `SOAT ${v.soat_vence}` : ''}
                  {v.soat_vence && v.tecnomecanica_vence ? ' · ' : ''}
                  {v.tecnomecanica_vence ? `RTM ${v.tecnomecanica_vence}` : ''}
                </Text>
              ) : null}
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
          <FormularioVehiculoModal
            id={editando.id}
            inicial={editando.datos}
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

function FormularioVehiculoModal({
  id,
  inicial,
  onCerrar,
  onGuardado,
}: {
  id?: string;
  inicial: FormularioVehiculo;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [datos, setDatos] = useState(inicial);
  const [errores, setErrores] = useState<Errores<keyof FormularioVehiculo>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  function cambiar<K extends keyof FormularioVehiculo>(campo: K, valor: FormularioVehiculo[K]) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function guardar() {
    const nuevos = validarVehiculo(datos);
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;
    setGuardando(true);
    setError(null);
    const r = await guardarVehiculo(datos, id);
    setGuardando(false);
    if (r.ok) onGuardado();
    else setError(r.error);
  }

  async function eliminar() {
    if (!id) return;
    setGuardando(true);
    const r = await eliminarVehiculo(id);
    setGuardando(false);
    if (r.ok) onGuardado();
    else setError(r.error);
  }

  return (
    <PantallaFormulario titulo={id ? 'Editar vehículo' : 'Nuevo vehículo'}>
      <CampoTexto
        etiqueta="Placa"
        placeholder="ABC123"
        autoCapitalize="characters"
        value={datos.placa}
        onChangeText={(v) => cambiar('placa', v)}
        error={errores.placa}
      />
      <SelectorOpciones
        etiqueta="Tipo"
        opciones={TIPOS_VEHICULO.map((t) => ({ valor: t, texto: ETIQUETA_TIPO[t] }))}
        valor={datos.tipo}
        onCambio={(v) => cambiar('tipo', v)}
      />
      <CampoTexto etiqueta="Marca" value={datos.marca} onChangeText={(v) => cambiar('marca', v)} error={errores.marca} />
      <CampoTexto etiqueta="Línea / modelo" value={datos.modelo} onChangeText={(v) => cambiar('modelo', v)} error={errores.modelo} />
      <CampoTexto
        etiqueta="Año"
        keyboardType="number-pad"
        value={datos.anio}
        onChangeText={(v) => cambiar('anio', v)}
        error={errores.anio}
      />
      <CampoTexto
        etiqueta="Capacidad de pasajeros"
        keyboardType="number-pad"
        value={datos.capacidad}
        onChangeText={(v) => cambiar('capacidad', v)}
        error={errores.capacidad}
      />
      <SelectorOpciones
        etiqueta="Estado"
        opciones={ESTADOS_VEHICULO.map((e) => ({ valor: e, texto: ETIQUETA_ESTADO[e] }))}
        valor={datos.estado}
        onCambio={(v) => cambiar('estado', v)}
      />
      <CampoTexto
        etiqueta="Vencimiento SOAT (opcional)"
        placeholder="AAAA-MM-DD"
        value={datos.soatVence}
        onChangeText={(v) => cambiar('soatVence', v)}
        error={errores.soatVence}
      />
      <CampoTexto
        etiqueta="Vencimiento revisión técnico-mecánica (opcional)"
        placeholder="AAAA-MM-DD"
        value={datos.tecnomecanicaVence}
        onChangeText={(v) => cambiar('tecnomecanicaVence', v)}
        error={errores.tecnomecanicaVence}
      />

      <Mensaje texto={error} />
      <View style={styles.botones}>
        <Boton titulo="Guardar" onPress={guardar} cargando={guardando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={onCerrar} disabled={guardando} />
        {id ? (
          confirmarEliminar ? (
            <Boton titulo="Confirmar eliminación" variante="peligro" onPress={eliminar} cargando={guardando} />
          ) : (
            <Boton titulo="Eliminar vehículo" variante="texto" onPress={() => setConfirmarEliminar(true)} />
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
  placa: { fontSize: 18, fontWeight: '700', color: Colors.text, letterSpacing: 1 },
  estado: { fontSize: 13, fontWeight: '600' },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  vacio: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.lg },
  botones: { gap: Spacing.md },
});
