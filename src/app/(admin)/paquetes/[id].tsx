import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoFecha } from '@/components/campo-fecha';
import { CampoTexto } from '@/components/campo-texto';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { SelectorOpciones } from '@/components/selector-opciones';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { esFechaValida, hoyEnColombia, sumarDias } from '@/lib/cotizador';
import {
  ETIQUETA_ESTADO_FECHA,
  PAQUETE_VACIO,
  eliminarDia,
  eliminarFecha,
  eliminarImagen,
  eliminarPaquete,
  estadoFecha,
  guardarDia,
  guardarFecha,
  guardarPaquete,
  hacerPortada,
  obtenerPaquete,
  paqueteAFormulario,
  subirImagen,
  urlImagen,
  validarDia,
  validarFechaSalida,
  validarPaquete,
  type DiaItinerario,
  type FechaSalida,
  type FormularioDia,
  type FormularioFecha,
  type FormularioPaquete,
  type ImagenPaquete,
  type Paquete,
  type PaqueteCompleto,
} from '@/lib/paquetes';
import { sinErrores, type Errores } from '@/lib/validacion';

// HU-21 crear y actualizar paquetes · HU-20 fechas de salida con cupos.
export default function EditorPaquete() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nuevo = id === 'nuevo';
  const [paquete, setPaquete] = useState<PaqueteCompleto | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cambiar "version" vuelve a consultar el paquete.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (nuevo) return;
    let vigente = true;
    obtenerPaquete(id).then((r) => {
      if (!vigente) return;
      if (r.ok) setPaquete(r.data);
      else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [id, nuevo, version]);

  const recargar = () => setVersion((v) => v + 1);

  if (!nuevo && !paquete) {
    return (
      <View style={styles.centro}>
        {error ? <Mensaje texto={error} /> : <ActivityIndicator color={Colors.primary} />}
      </View>
    );
  }

  return (
    <PantallaFormulario margenSuperior={false}>
      <Stack.Screen options={{ title: paquete?.nombre ?? 'Nuevo paquete' }} />
      <DatosPaquete
        key={paquete?.updated_at ?? 'nuevo'}
        paquete={paquete}
        onGuardado={(p) => {
          if (nuevo) router.replace({ pathname: '/paquetes/[id]', params: { id: p.id } });
          else recargar();
        }}
      />
      {paquete ? (
        <>
          <Fotos paquete={paquete} onCambio={recargar} />
          <Itinerario paquete={paquete} onCambio={recargar} />
          <Fechas paquete={paquete} onCambio={recargar} />
          <Eliminar paquete={paquete} />
        </>
      ) : (
        <Text style={styles.ayuda}>Guarda los datos para agregar fotos, itinerario y fechas de salida.</Text>
      )}
    </PantallaFormulario>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={styles.seccion}>
      <Text style={styles.seccionTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

// ─── Datos del paquete ────────────────────────────────────────

const ESTADOS: { valor: FormularioPaquete['estado']; texto: string }[] = [
  { valor: 'activo', texto: 'Activo (publicado)' },
  { valor: 'inactivo', texto: 'Inactivo' },
];

function DatosPaquete({
  paquete,
  onGuardado,
}: {
  paquete: PaqueteCompleto | null;
  onGuardado: (p: Paquete) => void;
}) {
  const [datos, setDatos] = useState<FormularioPaquete>(paquete ? paqueteAFormulario(paquete) : PAQUETE_VACIO);
  const [errores, setErrores] = useState<Errores<keyof FormularioPaquete>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function cambiar<K extends keyof FormularioPaquete>(campo: K, valor: FormularioPaquete[K]) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function guardar() {
    const nuevos = validarPaquete(datos);
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;
    setGuardando(true);
    setError(null);
    const r = await guardarPaquete(datos, paquete?.id);
    setGuardando(false);
    if (r.ok) onGuardado(r.data);
    else setError(r.error);
  }

  const sinFotos = !paquete || paquete.imagenes.length === 0;

  return (
    <Seccion titulo="Datos">
      <CampoTexto etiqueta="Nombre" value={datos.nombre} onChangeText={(v) => cambiar('nombre', v)} error={errores.nombre} />
      <CampoTexto
        etiqueta="Destino"
        placeholder="Mocoa"
        value={datos.destino}
        onChangeText={(v) => cambiar('destino', v)}
        error={errores.destino}
      />
      <CampoTexto
        etiqueta="Descripción"
        multiline
        style={styles.multilinea}
        value={datos.descripcion}
        onChangeText={(v) => cambiar('descripcion', v)}
      />
      <View style={styles.fila}>
        <View style={styles.mitad}>
          <CampoTexto etiqueta="Días" keyboardType="number-pad" value={datos.dias} onChangeText={(v) => cambiar('dias', v)} error={errores.dias} />
        </View>
        <View style={styles.mitad}>
          <CampoTexto
            etiqueta="Noches"
            keyboardType="number-pad"
            value={datos.noches}
            onChangeText={(v) => cambiar('noches', v)}
            error={errores.noches}
          />
        </View>
      </View>
      <CampoTexto
        etiqueta="Precio por persona (COP)"
        keyboardType="number-pad"
        value={datos.precio}
        onChangeText={(v) => cambiar('precio', v)}
        error={errores.precio}
      />
      <CampoTexto
        etiqueta="Incluye (uno por línea)"
        multiline
        style={styles.multilinea}
        placeholder={'Transporte ida y regreso\nAlojamiento\nGuía local'}
        value={datos.incluye}
        onChangeText={(v) => cambiar('incluye', v)}
      />
      <CampoTexto
        etiqueta="No incluye (uno por línea)"
        multiline
        style={styles.multilinea}
        value={datos.noIncluye}
        onChangeText={(v) => cambiar('noIncluye', v)}
      />
      <SelectorOpciones etiqueta="Estado" opciones={ESTADOS} valor={datos.estado} onCambio={(v) => cambiar('estado', v)} />
      {datos.estado === 'activo' && sinFotos ? (
        <Text style={styles.aviso}>No aparecerá en el catálogo hasta que tenga al menos una foto.</Text>
      ) : null}
      <Mensaje texto={error} />
      <Boton titulo={paquete ? 'Guardar cambios' : 'Crear paquete'} onPress={guardar} cargando={guardando} />
    </Seccion>
  );
}

// ─── Fotos ────────────────────────────────────────────────────

function Fotos({ paquete, onCambio }: { paquete: PaqueteCompleto; onCambio: () => void }) {
  const [elegida, setElegida] = useState<ImagenPaquete | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setOcupado(true);
    setError(null);
    const r = await accion();
    setOcupado(false);
    if (r.ok) {
      setElegida(null);
      onCambio();
    } else setError(r.error ?? 'No se pudo completar la acción');
  }

  async function agregar() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });
    const archivo = r.canceled ? null : r.assets[0];
    if (!archivo) return;
    if (!archivo.base64) {
      setError('No se pudo leer la imagen');
      return;
    }
    const base64 = archivo.base64;
    const siguiente = Math.max(-1, ...paquete.imagenes.map((i) => i.orden)) + 1;
    await ejecutar(() => subirImagen(paquete.id, { base64, mimeType: archivo.mimeType }, siguiente));
  }

  return (
    <Seccion titulo="Fotos">
      <Text style={styles.ayuda}>La primera es la portada del catálogo. Toca una foto para cambiarla o eliminarla.</Text>
      <View style={styles.fotos}>
        {paquete.imagenes.map((img, i) => (
          <Pressable
            key={img.id}
            accessibilityRole="button"
            accessibilityLabel={i === 0 ? 'Foto de portada' : `Foto ${i + 1}`}
            onPress={() => setElegida(elegida?.id === img.id ? null : img)}>
            <Image
              source={urlImagen(img.ruta)}
              style={[styles.miniatura, elegida?.id === img.id && styles.miniaturaElegida]}
              contentFit="cover"
            />
            {i === 0 ? <Text style={styles.etiquetaPortada}>Portada</Text> : null}
          </Pressable>
        ))}
      </View>
      {elegida ? (
        <View style={styles.botones}>
          {paquete.imagenes[0]?.id !== elegida.id ? (
            <Boton
              titulo="Usar como portada"
              variante="secundario"
              cargando={ocupado}
              onPress={() => ejecutar(() => hacerPortada(elegida, paquete.imagenes))}
            />
          ) : null}
          <Boton titulo="Eliminar foto" variante="peligro" cargando={ocupado} onPress={() => ejecutar(() => eliminarImagen(elegida))} />
        </View>
      ) : null}
      <Mensaje texto={error} />
      <Boton titulo="Agregar foto" variante="secundario" onPress={agregar} cargando={ocupado && !elegida} />
    </Seccion>
  );
}

// ─── Itinerario ───────────────────────────────────────────────

function Itinerario({ paquete, onCambio }: { paquete: PaqueteCompleto; onCambio: () => void }) {
  const [editando, setEditando] = useState<{ dia?: DiaItinerario } | null>(null);

  return (
    <Seccion titulo="Itinerario">
      {paquete.itinerario.length === 0 ? <Text style={styles.ayuda}>Aún no hay días en el itinerario.</Text> : null}
      {paquete.itinerario.map((d) => (
        <Pressable
          key={d.id}
          accessibilityRole="button"
          accessibilityHint="Editar día"
          onPress={() => setEditando({ dia: d })}
          style={({ pressed }) => [styles.item, pressed && styles.presionada]}>
          <Text style={styles.itemTitulo}>
            Día {d.dia} · {d.titulo}
          </Text>
          {d.descripcion ? (
            <Text style={styles.itemDetalle} numberOfLines={2}>
              {d.descripcion}
            </Text>
          ) : null}
        </Pressable>
      ))}
      <Boton titulo="Agregar día" variante="secundario" onPress={() => setEditando({})} />

      <ModalFormulario visible={editando !== null} onCerrar={() => setEditando(null)}>
        {editando ? (
          <FormularioDiaModal
            paquete={paquete}
            dia={editando.dia}
            onCerrar={() => setEditando(null)}
            onGuardado={() => {
              setEditando(null);
              onCambio();
            }}
          />
        ) : null}
      </ModalFormulario>
    </Seccion>
  );
}

function FormularioDiaModal({
  paquete,
  dia,
  onCerrar,
  onGuardado,
}: {
  paquete: PaqueteCompleto;
  dia?: DiaItinerario;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const siguiente = Math.min(paquete.duracion_dias, Math.max(0, ...paquete.itinerario.map((d) => d.dia)) + 1);
  const [datos, setDatos] = useState<FormularioDia>({
    dia: String(dia?.dia ?? siguiente),
    titulo: dia?.titulo ?? '',
    descripcion: dia?.descripcion ?? '',
  });
  const [errores, setErrores] = useState<Errores<keyof FormularioDia>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const nuevos = validarDia(datos, paquete.duracion_dias);
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;
    setGuardando(true);
    const r = await guardarDia(paquete.id, datos, dia?.id);
    setGuardando(false);
    if (r.ok) onGuardado();
    else setError(r.error);
  }

  async function eliminar() {
    if (!dia) return;
    setGuardando(true);
    const r = await eliminarDia(dia.id);
    setGuardando(false);
    if (r.ok) onGuardado();
    else setError(r.error);
  }

  return (
    <PantallaFormulario titulo={dia ? `Día ${dia.dia}` : 'Nuevo día'}>
      <CampoTexto
        etiqueta="Número de día"
        keyboardType="number-pad"
        value={datos.dia}
        onChangeText={(v) => setDatos((d) => ({ ...d, dia: v }))}
        error={errores.dia}
      />
      <CampoTexto
        etiqueta="Título"
        placeholder="Llegada y recorrido por el centro"
        value={datos.titulo}
        onChangeText={(v) => setDatos((d) => ({ ...d, titulo: v }))}
        error={errores.titulo}
      />
      <CampoTexto
        etiqueta="Descripción (opcional)"
        multiline
        style={styles.multilinea}
        value={datos.descripcion}
        onChangeText={(v) => setDatos((d) => ({ ...d, descripcion: v }))}
      />
      <Mensaje texto={error} />
      <View style={styles.botones}>
        <Boton titulo="Guardar" onPress={guardar} cargando={guardando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={onCerrar} disabled={guardando} />
        {dia ? <Boton titulo="Eliminar día" variante="texto" onPress={eliminar} disabled={guardando} /> : null}
      </View>
    </PantallaFormulario>
  );
}

// ─── Fechas de salida (HU-20) ─────────────────────────────────

const ESTADOS_FECHA: { valor: FormularioFecha['estado']; texto: string }[] = [
  { valor: 'abierta', texto: 'Abierta' },
  { valor: 'cerrada', texto: 'Cerrada' },
];

function Fechas({ paquete, onCambio }: { paquete: PaqueteCompleto; onCambio: () => void }) {
  const hoy = hoyEnColombia();
  const [editando, setEditando] = useState<{ fecha?: FechaSalida } | null>(null);

  return (
    <Seccion titulo="Fechas de salida y cupos">
      {paquete.fechas.length === 0 ? <Text style={styles.ayuda}>Aún no hay salidas programadas.</Text> : null}
      {paquete.fechas.map((f) => {
        const estado = estadoFecha(f, hoy);
        return (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            accessibilityHint="Editar fecha de salida"
            onPress={() => setEditando({ fecha: f })}
            style={({ pressed }) => [styles.item, pressed && styles.presionada]}>
            <View style={styles.filaEntre}>
              <Text style={styles.itemTitulo}>
                {f.fecha_salida} → {f.fecha_regreso}
              </Text>
              <Text style={[styles.estadoFecha, estado === 'agotada' && styles.agotada]}>
                {ETIQUETA_ESTADO_FECHA[estado]}
              </Text>
            </View>
            <Text style={styles.itemDetalle}>
              {f.cupos_reservados} reservados · {f.cupos_disponibles} disponibles de {f.cupos_totales}
            </Text>
          </Pressable>
        );
      })}
      <Boton titulo="Agregar fecha de salida" variante="secundario" onPress={() => setEditando({})} />

      <ModalFormulario visible={editando !== null} onCerrar={() => setEditando(null)}>
        {editando ? (
          <FormularioFechaModal
            paquete={paquete}
            fecha={editando.fecha}
            onCerrar={() => setEditando(null)}
            onGuardado={() => {
              setEditando(null);
              onCambio();
            }}
          />
        ) : null}
      </ModalFormulario>
    </Seccion>
  );
}

function FormularioFechaModal({
  paquete,
  fecha,
  onCerrar,
  onGuardado,
}: {
  paquete: PaqueteCompleto;
  fecha?: FechaSalida;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [datos, setDatos] = useState<FormularioFecha>({
    fechaSalida: fecha?.fecha_salida ?? '',
    fechaRegreso: fecha?.fecha_regreso ?? '',
    cupos: fecha ? String(fecha.cupos_totales) : '',
    estado: (fecha?.estado as FormularioFecha['estado']) ?? 'abierta',
  });
  const [errores, setErrores] = useState<Errores<keyof FormularioFecha>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const reservados = fecha?.cupos_reservados ?? 0;

  function cambiarSalida(v: string) {
    setDatos((d) => ({
      ...d,
      fechaSalida: v,
      // Propone el regreso según la duración del paquete.
      fechaRegreso:
        !d.fechaRegreso && esFechaValida(v.trim()) ? sumarDias(v.trim(), paquete.duracion_dias - 1) : d.fechaRegreso,
    }));
    setErrores((e) => ({ ...e, fechaSalida: undefined }));
  }

  async function guardar() {
    const nuevos = validarFechaSalida(datos, reservados);
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;
    setGuardando(true);
    const r = await guardarFecha(paquete.id, datos, fecha?.id);
    setGuardando(false);
    if (r.ok) onGuardado();
    else setError(r.error);
  }

  async function eliminar() {
    if (!fecha) return;
    setGuardando(true);
    const r = await eliminarFecha(fecha.id);
    setGuardando(false);
    if (r.ok) onGuardado();
    else setError(r.error);
  }

  return (
    <PantallaFormulario titulo={fecha ? 'Editar salida' : 'Nueva salida'}>
      <CampoFecha
        etiqueta="Fecha de salida"
        value={datos.fechaSalida}
        onChangeText={cambiarSalida}
        error={errores.fechaSalida}
      />
      <CampoFecha
        etiqueta="Fecha de regreso"
        minimo={datos.fechaSalida || undefined}
        value={datos.fechaRegreso}
        onChangeText={(v) => setDatos((d) => ({ ...d, fechaRegreso: v }))}
        error={errores.fechaRegreso}
      />
      <CampoTexto
        etiqueta="Cupos totales"
        keyboardType="number-pad"
        value={datos.cupos}
        onChangeText={(v) => setDatos((d) => ({ ...d, cupos: v }))}
        error={errores.cupos}
        ayuda={reservados ? `${reservados} cupos ya están reservados` : undefined}
      />
      <SelectorOpciones
        etiqueta="Estado"
        opciones={ESTADOS_FECHA}
        valor={datos.estado}
        onCambio={(v) => setDatos((d) => ({ ...d, estado: v }))}
      />
      <Text style={styles.ayuda}>Una salida cerrada sigue visible pero no recibe reservas.</Text>
      <Mensaje texto={error} />
      <View style={styles.botones}>
        <Boton titulo="Guardar" onPress={guardar} cargando={guardando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={onCerrar} disabled={guardando} />
        {fecha ? <Boton titulo="Eliminar salida" variante="texto" onPress={eliminar} disabled={guardando} /> : null}
      </View>
    </PantallaFormulario>
  );
}

// ─── Eliminar paquete ─────────────────────────────────────────

function Eliminar({ paquete }: { paquete: PaqueteCompleto }) {
  const [confirmar, setConfirmar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function eliminar() {
    setEliminando(true);
    const r = await eliminarPaquete(paquete);
    setEliminando(false);
    if (r.ok) router.back();
    else setError(r.error);
  }

  return (
    <View style={styles.seccion}>
      <Mensaje texto={error} />
      {confirmar ? (
        <Boton titulo="Confirmar: eliminar paquete y sus fotos" variante="peligro" onPress={eliminar} cargando={eliminando} />
      ) : (
        <Boton titulo="Eliminar paquete" variante="texto" onPress={() => setConfirmar(true)} />
      )}
    </View>
  );
}

function ModalFormulario({
  visible,
  onCerrar,
  children,
}: {
  visible: boolean;
  onCerrar: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      {children}
    </Modal>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  seccion: { marginBottom: Spacing.xl },
  seccionTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  ayuda: { fontSize: 14, color: Colors.muted, marginBottom: Spacing.md },
  aviso: { fontSize: 14, color: Colors.danger, marginBottom: Spacing.md },
  multilinea: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  fila: { flexDirection: 'row', gap: Spacing.md },
  mitad: { flex: 1 },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  botones: { gap: Spacing.md, marginBottom: Spacing.md },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  miniatura: { width: 96, height: 72, borderRadius: Radius, backgroundColor: Colors.surface },
  miniaturaElegida: { borderWidth: 3, borderColor: Colors.primaryDark },
  etiquetaPortada: { fontSize: 11, fontWeight: '700', color: Colors.primaryDark, marginTop: 2 },
  item: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presionada: { backgroundColor: Colors.surface },
  itemTitulo: { fontSize: 15, fontWeight: '700', color: Colors.text },
  itemDetalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  estadoFecha: { fontSize: 13, fontWeight: '600', color: Colors.success },
  agotada: { color: Colors.danger },
});
