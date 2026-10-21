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
import { EstadoVacio } from '@/components/estado-vacio';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { SelectorOpciones } from '@/components/selector-opciones';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatearDecimal, formatearPesos } from '@/lib/cotizador';
import {
  RUTA_VACIA,
  eliminarRuta,
  guardarRuta,
  listarRutas,
  rutaAFormulario,
  validarRuta,
  type FormularioRuta,
  type Ruta,
} from '@/lib/rutas';
import { sinErrores, type Errores } from '@/lib/validacion';

const ESTADOS: { valor: FormularioRuta['estado']; texto: string }[] = [
  { valor: 'activa', texto: 'Activa' },
  { valor: 'inactiva', texto: 'Inactiva' },
];

// HU-09 · Administrar tabla de rutas.
export default function Rutas() {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // null = formulario cerrado; { id: undefined } = nueva ruta.
  const [editando, setEditando] = useState<{ id?: string; datos: FormularioRuta } | null>(null);

  // Cambiar "version" vuelve a consultar la lista.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    listarRutas().then((r) => {
      if (!vigente) return;
      setCargando(false);
      if (r.ok) {
        setRutas(r.data);
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
        data={rutas}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={cargando && rutas.length > 0} onRefresh={refrescar} />}
        ListHeaderComponent={
          <>
            <Boton titulo="Agregar ruta" onPress={() => setEditando({ datos: RUTA_VACIA })} />
            <View style={styles.espacio} />
            <Mensaje texto={error} />
          </>
        }
        ListEmptyComponent={
          cargando ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <EstadoVacio icono="map-outline" texto="Aún no hay rutas registradas." />
          )
        }
        renderItem={({ item: r }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Editar ruta"
            onPress={() => setEditando({ id: r.id, datos: rutaAFormulario(r) })}
            style={({ pressed }) => [styles.tarjeta, pressed && styles.presionada, !r.activo && styles.inactiva]}>
            <View style={styles.filaTitulo}>
              <Text style={styles.titulo}>
                {r.origen} → {r.destino}
              </Text>
              <Text style={[styles.estado, { color: r.activo ? Colors.success : Colors.danger }]}>
                {r.activo ? 'Activa' : 'Inactiva'}
              </Text>
            </View>
            <Text style={styles.detalle}>
              {formatearDecimal(r.distancia_km)} km
              {r.duracion_horas != null ? ` · ${formatearDecimal(r.duracion_horas)} h` : ''}
              {' · '}Peajes {formatearPesos(r.peajes)}
            </Text>
          </Pressable>
        )}
      />

      <Modal
        visible={editando !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditando(null)}>
        {editando ? (
          <FormularioRutaModal
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

function FormularioRutaModal({
  id,
  inicial,
  onCerrar,
  onGuardado,
}: {
  id?: string;
  inicial: FormularioRuta;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [datos, setDatos] = useState(inicial);
  const [errores, setErrores] = useState<Errores<keyof FormularioRuta>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  function cambiar<K extends keyof FormularioRuta>(campo: K, valor: FormularioRuta[K]) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function guardar() {
    const nuevos = validarRuta(datos);
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;
    setGuardando(true);
    setError(null);
    const r = await guardarRuta(datos, id);
    setGuardando(false);
    if (r.ok) onGuardado();
    else setError(r.error);
  }

  async function eliminar() {
    if (!id) return;
    setGuardando(true);
    const r = await eliminarRuta(id);
    setGuardando(false);
    if (r.ok) onGuardado();
    else setError(r.error);
  }

  return (
    <PantallaFormulario titulo={id ? 'Editar ruta' : 'Nueva ruta'}>
      <CampoTexto
        etiqueta="Origen"
        placeholder="La Hormiga"
        value={datos.origen}
        onChangeText={(v) => cambiar('origen', v)}
        error={errores.origen}
      />
      <CampoTexto
        etiqueta="Destino"
        placeholder="Mocoa"
        value={datos.destino}
        onChangeText={(v) => cambiar('destino', v)}
        error={errores.destino}
      />
      <CampoTexto
        etiqueta="Distancia (km)"
        keyboardType="decimal-pad"
        value={datos.distanciaKm}
        onChangeText={(v) => cambiar('distanciaKm', v)}
        error={errores.distanciaKm}
        ayuda="Un solo trayecto. El cotizador la duplica en servicios con regreso"
      />
      <CampoTexto
        etiqueta="Duración estimada en horas (opcional)"
        keyboardType="decimal-pad"
        value={datos.duracionHoras}
        onChangeText={(v) => cambiar('duracionHoras', v)}
        error={errores.duracionHoras}
      />
      <CampoTexto
        etiqueta="Peajes por trayecto (COP)"
        keyboardType="number-pad"
        value={datos.peajes}
        onChangeText={(v) => cambiar('peajes', v)}
        error={errores.peajes}
      />
      <SelectorOpciones
        etiqueta="Estado"
        opciones={ESTADOS}
        valor={datos.estado}
        onCambio={(v) => cambiar('estado', v)}
      />

      <Mensaje texto={error} />
      <View style={styles.botones}>
        <Boton titulo="Guardar" onPress={guardar} cargando={guardando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={onCerrar} disabled={guardando} />
        {id ? (
          confirmarEliminar ? (
            <Boton titulo="Confirmar eliminación" variante="peligro" onPress={eliminar} cargando={guardando} />
          ) : (
            <Boton titulo="Eliminar ruta" variante="texto" onPress={() => setConfirmarEliminar(true)} />
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
  inactiva: { backgroundColor: Colors.surface },
  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  titulo: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.text },
  estado: { fontSize: 13, fontWeight: '600' },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  vacio: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.lg },
  botones: { gap: Spacing.md },
});
