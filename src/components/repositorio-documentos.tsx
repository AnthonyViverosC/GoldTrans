import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AlertasVencimiento } from '@/components/alertas-vencimiento';
import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { COLOR_VIGENCIA, EstadoVigenciaTexto } from '@/components/estado-vigencia';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { SelectorArchivo } from '@/components/selector-archivo';
import { SelectorOpciones } from '@/components/selector-opciones';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { abrirArchivo, formatearTamano, type ArchivoElegido } from '@/lib/archivos';
import { hoyEnColombia } from '@/lib/cotizador';
import {
  DOCUMENTO_VACIO,
  actualizarDocumento,
  agregarVersion,
  crearCategoria,
  crearDocumento,
  eliminarDocumento,
  estadoDocumento,
  filtrarDocumentos,
  guardarVigencia,
  listarCategorias,
  listarDocumentos,
  listarPersonal,
  quitarVigencia,
  resumenTablero,
  validarDocumento,
  validarVigencia,
  versionActual,
  vigenciaAFormulario,
  type Categoria,
  type DocumentoCompleto,
  type FormularioDocumento,
  type FormularioVigencia,
  type Personal,
} from '@/lib/documentos';
import { ESTADOS_VIGENCIA, ETIQUETA_VIGENCIA, diasHasta, type EstadoVigencia } from '@/lib/licitaciones';
import { fechaHoraColombia } from '@/lib/reservas';
import { requerido, sinErrores, type Errores } from '@/lib/validacion';

type Abierto = { tipo: 'nuevo' } | { tipo: 'documento'; id: string } | { tipo: 'categoria' } | null;

/**
 * HU-27 · Repositorio documental: carga por categoría e historial de versiones.
 * HU-28 vigencias y alertas · HU-29 tablero Vigente / Por vencer / Vencido · HU-30 buscador.
 */
export function RepositorioDocumentos({ encabezado }: { encabezado?: ReactNode }) {
  const { rol } = useAuth();
  const esAdmin = rol === 'admin';
  const hoy = hoyEnColombia();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoCompleto[]>([]);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [categoria, setCategoria] = useState('');
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<EstadoVigencia | ''>('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    Promise.all([listarCategorias(), listarDocumentos(), listarPersonal()]).then(([c, d, p]) => {
      if (!vigente) return;
      setCargando(false);
      if (c.ok) setCategorias(c.data);
      if (d.ok) setDocumentos(d.data);
      if (p.ok) setPersonal(p.data);
      setError(!c.ok ? c.error : !d.ok ? d.error : null);
    });
    return () => {
      vigente = false;
    };
  }, [version]);

  function refrescar() {
    setCargando(true);
    setVersion((v) => v + 1);
  }

  function cerrar(recargar: boolean) {
    setAbierto(null);
    if (recargar) refrescar();
  }

  const nombreCategoria = (id: string) => categorias.find((c) => c.id === id)?.nombre ?? '';
  const visibles = filtrarDocumentos(documentos, categoria, texto, estado, hoy);
  const tablero = resumenTablero(documentos, hoy);
  const opciones = [{ valor: '', texto: 'Todas' }, ...categorias.map((c) => ({ valor: c.id, texto: c.nombre }))];
  const documentoAbierto = abierto?.tipo === 'documento' ? documentos.find((d) => d.id === abierto.id) : undefined;

  return (
    <>
      <FlatList
        contentContainerStyle={styles.lista}
        data={visibles}
        keyExtractor={(d) => d.id}
        refreshControl={<RefreshControl refreshing={cargando && documentos.length > 0} onRefresh={refrescar} />}
        ListHeaderComponent={
          <>
            {encabezado}
            <AlertasVencimiento />
            <View style={styles.tablero} accessibilityRole="radiogroup">
              {ESTADOS_VIGENCIA.map((e) => (
                <Pressable
                  key={e}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: estado === e }}
                  accessibilityLabel={`${ETIQUETA_VIGENCIA[e]}: ${tablero[e]}`}
                  onPress={() => setEstado(estado === e ? '' : e)}
                  style={[styles.indicador, estado === e && { borderColor: COLOR_VIGENCIA[e] }]}>
                  <Text style={[styles.indicadorNumero, { color: COLOR_VIGENCIA[e] }]}>{tablero[e]}</Text>
                  <Text style={styles.indicadorTexto}>{ETIQUETA_VIGENCIA[e]}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.acciones}>
              <View style={styles.flex}>
                <Boton titulo="Nuevo documento" onPress={() => setAbierto({ tipo: 'nuevo' })} disabled={!categorias.length} />
              </View>
              {esAdmin ? (
                <View style={styles.flex}>
                  <Boton titulo="Nueva categoría" variante="secundario" onPress={() => setAbierto({ tipo: 'categoria' })} />
                </View>
              ) : null}
            </View>
            <CampoTexto etiqueta="Buscar" placeholder="Nombre o descripción" value={texto} onChangeText={setTexto} />
            <SelectorOpciones opciones={opciones} valor={categoria} onCambio={setCategoria} />
            {estado ? (
              <Text style={styles.detalle}>
                Mostrando solo: {ETIQUETA_VIGENCIA[estado]}. Toca el indicador otra vez para quitar el filtro.
              </Text>
            ) : null}
            <Mensaje texto={error} />
          </>
        }
        ListEmptyComponent={
          cargando ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <Text style={styles.vacio}>
              {documentos.length === 0 ? 'Aún no hay documentos cargados.' : 'Ningún documento coincide con la búsqueda.'}
            </Text>
          )
        }
        renderItem={({ item: d }) => {
          const v = versionActual(d);
          const e = estadoDocumento(d, hoy);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Ver versiones y subir una nueva"
              onPress={() => setAbierto({ tipo: 'documento', id: d.id })}
              style={({ pressed }) => [styles.tarjeta, pressed && styles.presionada]}>
              <View style={styles.fila}>
                <Text style={styles.categoria}>{nombreCategoria(d.categoria_id)}</Text>
                <EstadoVigenciaTexto estado={e} />
              </View>
              <Text style={styles.nombre}>{d.nombre}</Text>
              {d.vigencia ? (
                <Text style={[styles.detalle, e === 'vencido' && styles.alerta]}>
                  {textoVencimiento(d.vigencia.fecha_vencimiento, hoy)}
                </Text>
              ) : null}
              {d.descripcion ? (
                <Text style={styles.detalle} numberOfLines={2}>
                  {d.descripcion}
                </Text>
              ) : null}
              {v ? (
                <Text style={styles.detalle}>
                  Versión {v.version} · {fechaHoraColombia(v.created_at).slice(0, 10)} · {formatearTamano(v.tamano_bytes)}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />

      <Modal
        visible={abierto !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => cerrar(false)}>
        {abierto?.tipo === 'nuevo' ? (
          <NuevoDocumento categorias={categorias} categoriaInicial={categoria} onCerrar={cerrar} />
        ) : null}
        {abierto?.tipo === 'categoria' ? <NuevaCategoria onCerrar={cerrar} /> : null}
        {documentoAbierto ? (
          <DetalleDocumento
            documento={documentoAbierto}
            categorias={categorias}
            personal={personal}
            esAdmin={esAdmin}
            onCambio={refrescar}
            onCerrar={cerrar}
          />
        ) : null}
      </Modal>
    </>
  );
}

function CamposDocumento({
  datos,
  categorias,
  errores,
  onCambio,
}: {
  datos: FormularioDocumento;
  categorias: Categoria[];
  errores: Errores<keyof FormularioDocumento | 'archivo'>;
  onCambio: (campo: keyof FormularioDocumento, valor: string) => void;
}) {
  return (
    <>
      <SelectorOpciones
        etiqueta="Categoría"
        opciones={categorias.map((c) => ({ valor: c.id, texto: c.nombre }))}
        valor={datos.categoriaId}
        onCambio={(v) => onCambio('categoriaId', v)}
      />
      {errores.categoriaId ? <Text style={styles.error}>{errores.categoriaId}</Text> : null}
      <CampoTexto
        etiqueta="Nombre del documento"
        placeholder="Ej.: Certificado de existencia y representación legal"
        value={datos.nombre}
        onChangeText={(v) => onCambio('nombre', v)}
        error={errores.nombre}
      />
      <CampoTexto
        etiqueta="Descripción (opcional)"
        multiline
        style={styles.multilinea}
        value={datos.descripcion}
        onChangeText={(v) => onCambio('descripcion', v)}
      />
    </>
  );
}

function NuevoDocumento({
  categorias,
  categoriaInicial,
  onCerrar,
}: {
  categorias: Categoria[];
  categoriaInicial: string;
  onCerrar: (recargar: boolean) => void;
}) {
  const [datos, setDatos] = useState<FormularioDocumento>({ ...DOCUMENTO_VACIO, categoriaId: categoriaInicial });
  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null);
  const [errores, setErrores] = useState<Errores<keyof FormularioDocumento | 'archivo'>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function cambiar(campo: keyof FormularioDocumento, valor: string) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function guardar() {
    const nuevos = validarDocumento(datos, archivo, true);
    setErrores(nuevos);
    if (!sinErrores(nuevos) || !archivo) return;
    setEnviando(true);
    setError(null);
    const r = await crearDocumento(datos, archivo);
    setEnviando(false);
    if (r.ok) onCerrar(true);
    else setError(r.error);
  }

  return (
    <PantallaFormulario titulo="Nuevo documento">
      <CamposDocumento datos={datos} categorias={categorias} errores={errores} onCambio={cambiar} />
      <SelectorArchivo
        etiqueta="Archivo"
        bucket="documentos"
        archivo={archivo}
        onCambio={(a) => {
          setArchivo(a);
          setErrores((e) => ({ ...e, archivo: undefined }));
        }}
        error={errores.archivo}
        deshabilitado={enviando}
      />
      <CampoTexto
        etiqueta="Notas de la versión (opcional)"
        placeholder="Ej.: expedido el 2026-10-01"
        value={datos.notas}
        onChangeText={(v) => cambiar('notas', v)}
      />
      <Mensaje texto={error} />
      <View style={styles.botones}>
        <Boton titulo="Guardar documento" onPress={guardar} cargando={enviando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={() => onCerrar(false)} disabled={enviando} />
      </View>
    </PantallaFormulario>
  );
}

function DetalleDocumento({
  documento: d,
  categorias,
  personal,
  esAdmin,
  onCambio,
  onCerrar,
}: {
  documento: DocumentoCompleto;
  categorias: Categoria[];
  personal: Personal[];
  esAdmin: boolean;
  onCambio: () => void;
  onCerrar: (recargar: boolean) => void;
}) {
  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null);
  const [notas, setNotas] = useState('');
  const [editando, setEditando] = useState(false);
  const [datos, setDatos] = useState<FormularioDocumento>({
    categoriaId: d.categoria_id,
    nombre: d.nombre,
    descripcion: d.descripcion,
    notas: '',
  });
  const [errores, setErrores] = useState<Errores<keyof FormularioDocumento | 'archivo'>>({});
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [ocupado, setOcupado] = useState<'version' | 'datos' | 'eliminar' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function subirVersion() {
    if (!archivo) {
      setErrores({ archivo: 'Adjunta el archivo de la nueva versión' });
      return;
    }
    setOcupado('version');
    setError(null);
    const r = await agregarVersion(d, archivo, notas);
    setOcupado(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setArchivo(null);
    setNotas('');
    setAviso(`Se guardó la versión ${r.data.version}. La anterior sigue en el historial.`);
    onCambio();
  }

  async function guardarDatos() {
    const nuevos = validarDocumento(datos, null, false);
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;
    setOcupado('datos');
    setError(null);
    const r = await actualizarDocumento(d.id, datos);
    setOcupado(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setEditando(false);
    setAviso('Datos actualizados.');
    onCambio();
  }

  async function eliminar() {
    setOcupado('eliminar');
    setError(null);
    const r = await eliminarDocumento(d);
    setOcupado(null);
    if (r.ok) onCerrar(true);
    else setError(r.error);
  }

  async function abrir(ruta: string) {
    setError(null);
    const r = await abrirArchivo('documentos', ruta);
    if (!r.ok) setError(r.error);
  }

  return (
    <PantallaFormulario titulo={d.nombre}>
      <Text style={styles.categoria}>{categorias.find((c) => c.id === d.categoria_id)?.nombre}</Text>
      {d.descripcion ? <Text style={styles.texto}>{d.descripcion}</Text> : null}
      <Mensaje tipo="exito" texto={aviso} />
      <Mensaje texto={error} />

      <SeccionVigencia documento={d} personal={personal} onCambio={onCambio} />

      <Text style={styles.seccion}>Versiones</Text>
      {d.versiones.map((v) => (
        <View key={v.id} style={[styles.version, v.version === d.version_actual && styles.versionActual]}>
          <View style={styles.fila}>
            <Text style={styles.versionTitulo}>
              Versión {v.version}
              {v.version === d.version_actual ? ' · vigente' : ''}
            </Text>
            <Boton titulo="Abrir" variante="texto" onPress={() => abrir(v.ruta)} />
          </View>
          <Text style={styles.detalle} numberOfLines={1}>
            {v.nombre_archivo} · {formatearTamano(v.tamano_bytes)}
          </Text>
          <Text style={styles.detalle}>
            {fechaHoraColombia(v.created_at)}
            {v.autor ? ` · ${v.autor.email}` : ''}
          </Text>
          {v.notas ? <Text style={styles.texto}>{v.notas}</Text> : null}
        </View>
      ))}

      <Text style={styles.seccion}>Subir nueva versión</Text>
      <SelectorArchivo
        etiqueta="Archivo"
        bucket="documentos"
        archivo={archivo}
        onCambio={(a) => {
          setArchivo(a);
          setErrores({});
        }}
        error={errores.archivo}
        deshabilitado={ocupado !== null}
      />
      <CampoTexto etiqueta="Notas de la versión (opcional)" value={notas} onChangeText={setNotas} />
      <Boton titulo="Guardar nueva versión" onPress={subirVersion} cargando={ocupado === 'version'} disabled={ocupado !== null} />

      <Text style={styles.seccion}>Datos del documento</Text>
      {editando ? (
        <>
          <CamposDocumento
            datos={datos}
            categorias={categorias}
            errores={errores}
            onCambio={(campo, valor) => {
              setDatos((x) => ({ ...x, [campo]: valor }));
              setErrores((e) => ({ ...e, [campo]: undefined }));
            }}
          />
          <View style={styles.botones}>
            <Boton titulo="Guardar datos" onPress={guardarDatos} cargando={ocupado === 'datos'} disabled={ocupado !== null} />
            <Boton titulo="Cancelar" variante="texto" onPress={() => setEditando(false)} disabled={ocupado !== null} />
          </View>
        </>
      ) : (
        <Boton titulo="Editar nombre, categoría o descripción" variante="secundario" onPress={() => setEditando(true)} />
      )}

      {esAdmin ? (
        <View style={styles.eliminar}>
          {confirmarEliminar ? (
            <>
              <Text style={styles.detalle}>Se borrarán el documento y sus {d.versiones.length} versiones. No se puede deshacer.</Text>
              <Boton titulo="Eliminar definitivamente" variante="peligro" onPress={eliminar} cargando={ocupado === 'eliminar'} />
              <Boton titulo="No eliminar" variante="texto" onPress={() => setConfirmarEliminar(false)} disabled={ocupado !== null} />
            </>
          ) : (
            <Boton titulo="Eliminar documento" variante="texto" onPress={() => setConfirmarEliminar(true)} />
          )}
        </View>
      ) : null}

      <View style={styles.eliminar}>
        <Boton titulo="Cerrar" variante="secundario" onPress={() => onCerrar(false)} disabled={ocupado !== null} />
      </View>
    </PantallaFormulario>
  );
}

/** "Vence en 45 días (2026-12-05)", "Vence hoy", "Venció hace 3 días (2026-10-18)". */
function textoVencimiento(vence: string, hoy: string): string {
  const dias = diasHasta(hoy, vence);
  if (dias === 0) return `Vence hoy (${vence})`;
  if (dias > 0) return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'} (${vence})`;
  return `Venció hace ${-dias} ${dias === -1 ? 'día' : 'días'} (${vence})`;
}

/** HU-28 · Fecha de vencimiento y responsable que recibe las alertas de 60, 30 y 15 días. */
function SeccionVigencia({
  documento: d,
  personal,
  onCambio,
}: {
  documento: DocumentoCompleto;
  personal: Personal[];
  onCambio: () => void;
}) {
  const { usuario } = useAuth();
  const hoy = hoyEnColombia();
  const [editando, setEditando] = useState(false);
  const [datos, setDatos] = useState<FormularioVigencia>(() => vigenciaAFormulario(d.vigencia, usuario?.id ?? ''));
  const [errores, setErrores] = useState<Errores<keyof FormularioVigencia>>({});
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const v = d.vigencia;
  const responsable = personal.find((p) => p.id === v?.responsable_id);

  function cambiar(campo: keyof FormularioVigencia, valor: string) {
    setDatos((x) => ({ ...x, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function guardar() {
    const nuevos = validarVigencia(datos);
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;
    setOcupado(true);
    setError(null);
    const r = await guardarVigencia(d.id, datos);
    setOcupado(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setEditando(false);
    onCambio();
  }

  async function quitar() {
    setOcupado(true);
    setError(null);
    const r = await quitarVigencia(d.id);
    setOcupado(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDatos(vigenciaAFormulario(null, usuario?.id ?? ''));
    setEditando(false);
    onCambio();
  }

  return (
    <>
      <Text style={styles.seccion}>Vigencia</Text>
      {!editando ? (
        <>
          {v ? (
            <View style={styles.vigencia}>
              <View style={styles.fila}>
                <Text style={styles.texto}>{textoVencimiento(v.fecha_vencimiento, hoy)}</Text>
                <EstadoVigenciaTexto estado={estadoDocumento(d, hoy)} />
              </View>
              {v.fecha_expedicion ? <Text style={styles.detalle}>Expedido el {v.fecha_expedicion}</Text> : null}
              <Text style={styles.detalle}>Alertas a: {responsable?.nombre ?? 'responsable inactivo'}</Text>
              {v.notas ? <Text style={styles.detalle}>{v.notas}</Text> : null}
            </View>
          ) : (
            <Text style={styles.detalle}>Este documento no tiene fecha de vencimiento registrada.</Text>
          )}
          <Mensaje texto={error} />
          <Boton
            titulo={v ? 'Cambiar vigencia' : 'Registrar vencimiento'}
            variante="secundario"
            onPress={() => setEditando(true)}
          />
        </>
      ) : (
        <>
          <CampoTexto
            etiqueta="Fecha de expedición (opcional)"
            placeholder="AAAA-MM-DD"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            value={datos.fechaExpedicion}
            onChangeText={(x) => cambiar('fechaExpedicion', x)}
            error={errores.fechaExpedicion}
          />
          <CampoTexto
            etiqueta="Fecha de vencimiento"
            placeholder="AAAA-MM-DD"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            value={datos.fechaVencimiento}
            onChangeText={(x) => cambiar('fechaVencimiento', x)}
            error={errores.fechaVencimiento}
            ayuda="Llegan alertas 60, 30 y 15 días antes, y el día que vence"
          />
          <SelectorOpciones
            etiqueta="Responsable de las alertas"
            opciones={personal.map((p) => ({ valor: p.id, texto: p.nombre }))}
            valor={datos.responsableId}
            onCambio={(x) => cambiar('responsableId', x)}
          />
          {errores.responsableId ? <Text style={styles.error}>{errores.responsableId}</Text> : null}
          <CampoTexto etiqueta="Notas (opcional)" value={datos.notas} onChangeText={(x) => cambiar('notas', x)} />
          <Mensaje texto={error} />
          <View style={styles.botones}>
            <Boton titulo="Guardar vigencia" onPress={guardar} cargando={ocupado} />
            {v ? <Boton titulo="Este documento no vence" variante="texto" onPress={quitar} disabled={ocupado} /> : null}
            <Boton titulo="Cancelar" variante="texto" onPress={() => setEditando(false)} disabled={ocupado} />
          </View>
        </>
      )}
    </>
  );
}

function NuevaCategoria({ onCerrar }: { onCerrar: (recargar: boolean) => void }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [errorNombre, setErrorNombre] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    const problema = requerido(nombre, 'Indica el nombre de la categoría');
    setErrorNombre(problema);
    if (problema) return;
    setEnviando(true);
    setError(null);
    const r = await crearCategoria(nombre, descripcion);
    setEnviando(false);
    if (r.ok) onCerrar(true);
    else setError(r.error);
  }

  return (
    <PantallaFormulario titulo="Nueva categoría">
      <CampoTexto
        etiqueta="Nombre"
        value={nombre}
        onChangeText={(v) => {
          setNombre(v);
          setErrorNombre(undefined);
        }}
        error={errorNombre}
      />
      <CampoTexto etiqueta="Descripción (opcional)" value={descripcion} onChangeText={setDescripcion} />
      <Mensaje texto={error} />
      <View style={styles.botones}>
        <Boton titulo="Crear categoría" onPress={guardar} cargando={enviando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={() => onCerrar(false)} disabled={enviando} />
      </View>
    </PantallaFormulario>
  );
}

const styles = StyleSheet.create({
  lista: { padding: Spacing.md, gap: Spacing.md },
  vacio: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.lg },
  acciones: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  tablero: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  indicador: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 72,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  indicadorNumero: { fontSize: 24, fontWeight: '700' },
  indicadorTexto: { fontSize: 12, color: Colors.muted, textAlign: 'center' },
  alerta: { color: Colors.danger, fontWeight: '600' },
  vigencia: { padding: Spacing.md, marginBottom: Spacing.sm, borderRadius: Radius, backgroundColor: Colors.surface },
  flex: { flex: 1 },
  tarjeta: {
    padding: Spacing.md,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  presionada: { backgroundColor: Colors.surface },
  categoria: { fontSize: 12, fontWeight: '700', color: Colors.primaryDark, textTransform: 'uppercase', letterSpacing: 0.5 },
  nombre: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: Spacing.xs },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  texto: { fontSize: 15, color: Colors.text, marginTop: Spacing.xs },
  error: { color: Colors.danger, fontSize: 13, marginTop: -Spacing.sm, marginBottom: Spacing.md },
  multilinea: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
  seccion: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  version: {
    paddingLeft: Spacing.md,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.border,
  },
  versionActual: { borderLeftColor: Colors.primary },
  versionTitulo: { fontSize: 15, fontWeight: '700', color: Colors.text },
  botones: { gap: Spacing.md },
  eliminar: { marginTop: Spacing.lg, gap: Spacing.sm },
});
