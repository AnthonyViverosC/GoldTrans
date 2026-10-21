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
import { EstadoItemTexto, EstadoVigenciaTexto } from '@/components/estado-vigencia';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { SelectorOpciones } from '@/components/selector-opciones';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { formatearTamano } from '@/lib/archivos';
import { formatearPesos, hoyEnColombia } from '@/lib/cotizador';
import {
  estadoDocumento,
  filtrarDocumentos,
  listarDocumentos,
  listarPersonal,
  type DocumentoCompleto,
  type Personal,
} from '@/lib/documentos';
import {
  ESTADOS_PROCESO,
  ETIQUETA_ESTADO_PROCESO,
  PLANTILLA_REQUISITOS,
  PROCESO_VACIO,
  actualizarItem,
  agregarItems,
  descargarPaquete,
  diasHasta,
  eliminarItem,
  eliminarProceso,
  evaluarProceso,
  guardarProceso,
  listarProcesos,
  obtenerProceso,
  problemasPaquete,
  procesoAFormulario,
  procesoAbierto,
  validarProceso,
  type Cumplimiento,
  type EstadoProceso,
  type FormularioProceso,
  type ItemEvaluado,
  type ProcesoCompleto,
} from '@/lib/licitaciones';
import { fechaHoraColombia } from '@/lib/reservas';
import { sinErrores, type Errores } from '@/lib/validacion';

type Filtro = 'abiertos' | 'cerrados' | 'todos';

const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: 'abiertos', texto: 'En curso' },
  { valor: 'cerrados', texto: 'Finalizados' },
  { valor: 'todos', texto: 'Todos' },
];

const OPCIONES_ESTADO = ESTADOS_PROCESO.map((e) => ({ valor: e, texto: ETIQUETA_ESTADO_PROCESO[e] }));

type Abierto = { tipo: 'nuevo' } | { tipo: 'proceso'; id: string } | null;

function textoCierre(cierre: string, hoy: string): string {
  const dias = diasHasta(hoy, cierre);
  if (dias > 1) return `Cierra el ${cierre} (en ${dias} días)`;
  if (dias === 1) return `Cierra mañana (${cierre})`;
  if (dias === 0) return `Cierra hoy (${cierre})`;
  return `Cerró el ${cierre}`;
}

function BarraCumplimiento({ resumen }: { resumen: Cumplimiento }) {
  const color = resumen.porcentaje === 100 ? Colors.success : resumen.obligatoriosPendientes ? Colors.primaryDark : Colors.primary;
  return (
    <View
      accessible
      accessibilityLabel={`Cumplimiento ${resumen.porcentaje} por ciento`}
      style={styles.barraFondo}>
      <View style={[styles.barra, { width: `${resumen.porcentaje}%`, backgroundColor: color }]} />
    </View>
  );
}

/** HU-31 · HU-32 · HU-33 · Procesos de licitación con su lista de verificación (asesor y admin). */
export function ProcesosLicitacion({ encabezado }: { encabezado?: ReactNode }) {
  const { rol } = useAuth();
  const hoy = hoyEnColombia();
  const [procesos, setProcesos] = useState<ProcesoCompleto[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoCompleto[]>([]);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('abiertos');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    Promise.all([listarProcesos(), listarDocumentos(), listarPersonal()]).then(([p, d, u]) => {
      if (!vigente) return;
      setCargando(false);
      if (p.ok) setProcesos(p.data);
      if (d.ok) setDocumentos(d.data);
      if (u.ok) setPersonal(u.data);
      setError(!p.ok ? p.error : !d.ok ? d.error : null);
    });
    return () => {
      vigente = false;
    };
  }, [version]);

  function refrescar() {
    setCargando(true);
    setVersion((v) => v + 1);
  }

  const visibles = procesos.filter((p) =>
    filtro === 'todos' ? true : filtro === 'abiertos' ? procesoAbierto(p.estado) : !procesoAbierto(p.estado),
  );

  return (
    <>
      <FlatList
        contentContainerStyle={styles.lista}
        data={visibles}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={cargando && procesos.length > 0} onRefresh={refrescar} />}
        ListHeaderComponent={
          <>
            {encabezado}
            <View style={styles.boton}>
              <Boton titulo="Nuevo proceso" onPress={() => setAbierto({ tipo: 'nuevo' })} />
            </View>
            <SelectorOpciones opciones={FILTROS} valor={filtro} onCambio={setFiltro} />
            <Mensaje texto={error} />
          </>
        }
        ListEmptyComponent={
          cargando ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <Text style={styles.vacio}>
              {procesos.length === 0 ? 'Aún no hay procesos de licitación registrados.' : 'No hay procesos en este grupo.'}
            </Text>
          )
        }
        renderItem={({ item: p }) => {
          const { items, resumen } = evaluarProceso(p, hoy);
          const vencidos = items.filter((i) => i.estado === 'vencido').length;
          const cerrando = procesoAbierto(p.estado) && diasHasta(hoy, p.fecha_cierre) <= 7;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Ver la lista de verificación del proceso"
              onPress={() => setAbierto({ tipo: 'proceso', id: p.id })}
              style={({ pressed }) => [styles.tarjeta, pressed && styles.presionada]}>
              <View style={styles.fila}>
                <Text style={styles.codigo}>{p.numero}</Text>
                <Text style={styles.estadoProceso}>{ETIQUETA_ESTADO_PROCESO[p.estado as EstadoProceso] ?? p.estado}</Text>
              </View>
              <Text style={styles.entidad}>{p.entidad}</Text>
              <Text style={styles.detalle} numberOfLines={2}>
                {p.objeto}
              </Text>
              <Text style={[styles.detalle, cerrando && styles.alerta]}>{textoCierre(p.fecha_cierre, hoy)}</Text>
              <View style={styles.cumplimiento}>
                <BarraCumplimiento resumen={resumen} />
                <Text style={styles.porcentaje}>{resumen.porcentaje} %</Text>
              </View>
              <Text style={[styles.detalle, (vencidos > 0 || resumen.obligatoriosPendientes > 0) && styles.alerta]}>
                {resumen.total === 0
                  ? 'Sin lista de verificación'
                  : `${resumen.cumplidos} de ${resumen.total} requisitos` +
                    (resumen.obligatoriosPendientes ? ` · ${resumen.obligatoriosPendientes} obligatorios pendientes` : '') +
                    (vencidos ? ` · ${vencidos} vencidos` : '')}
              </Text>
            </Pressable>
          );
        }}
      />

      <Modal
        visible={abierto !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setAbierto(null);
          refrescar();
        }}>
        {abierto?.tipo === 'nuevo' ? (
          <FormularioProcesoVista
            personal={personal}
            onCerrar={() => setAbierto(null)}
            onGuardado={(id) => {
              setAbierto({ tipo: 'proceso', id });
              refrescar();
            }}
          />
        ) : null}
        {abierto?.tipo === 'proceso' ? (
          <DetalleProceso
            procesoId={abierto.id}
            documentos={documentos}
            personal={personal}
            esAdmin={rol === 'admin'}
            onCerrar={() => {
              setAbierto(null);
              refrescar();
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

function FormularioProcesoVista({
  proceso,
  personal,
  onCerrar,
  onGuardado,
}: {
  proceso?: ProcesoCompleto;
  personal: Personal[];
  onCerrar: () => void;
  onGuardado: (id: string) => void;
}) {
  const { usuario } = useAuth();
  const [datos, setDatos] = useState<FormularioProceso>(() =>
    proceso ? procesoAFormulario(proceso) : { ...PROCESO_VACIO, responsableId: usuario?.id ?? '' },
  );
  const [errores, setErrores] = useState<Errores<keyof FormularioProceso>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function cambiar(campo: keyof FormularioProceso, valor: string) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function guardar() {
    const nuevos = validarProceso(datos);
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;
    setEnviando(true);
    setError(null);
    const r = await guardarProceso(datos, proceso?.id);
    setEnviando(false);
    if (r.ok) onGuardado(r.data.id);
    else setError(r.error);
  }

  const campos = (
    <>
      <CampoTexto
        etiqueta="Número del proceso"
        placeholder="Ej.: SA-MC-012-2026"
        autoCapitalize="characters"
        value={datos.numero}
        onChangeText={(v) => cambiar('numero', v)}
        error={errores.numero}
      />
      <CampoTexto
        etiqueta="Entidad contratante"
        placeholder="Ej.: Alcaldía de Valle del Guamuez"
        value={datos.entidad}
        onChangeText={(v) => cambiar('entidad', v)}
        error={errores.entidad}
      />
      <CampoTexto
        etiqueta="Objeto"
        multiline
        style={styles.multilinea}
        value={datos.objeto}
        onChangeText={(v) => cambiar('objeto', v)}
        error={errores.objeto}
      />
      <CampoTexto
        etiqueta="Fecha de cierre (entrega de propuestas)"
        placeholder="AAAA-MM-DD"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        value={datos.fechaCierre}
        onChangeText={(v) => cambiar('fechaCierre', v)}
        error={errores.fechaCierre}
        ayuda="Los documentos deben estar vigentes en esta fecha"
      />
      <CampoTexto
        etiqueta="Valor estimado (COP, opcional)"
        keyboardType="number-pad"
        value={datos.valorEstimado}
        onChangeText={(v) => cambiar('valorEstimado', v)}
        error={errores.valorEstimado}
      />
      <SelectorOpciones
        etiqueta="Estado"
        opciones={OPCIONES_ESTADO}
        valor={datos.estado}
        onCambio={(v) => cambiar('estado', v)}
      />
      <SelectorOpciones
        etiqueta="Responsable"
        opciones={personal.map((p) => ({ valor: p.id, texto: p.nombre }))}
        valor={datos.responsableId}
        onCambio={(v) => cambiar('responsableId', v)}
      />
      <CampoTexto
        etiqueta="Enlace al proceso (SECOP, opcional)"
        placeholder="https://…"
        autoCapitalize="none"
        keyboardType="url"
        value={datos.enlace}
        onChangeText={(v) => cambiar('enlace', v)}
        error={errores.enlace}
      />
      <CampoTexto
        etiqueta="Notas de seguimiento (opcional)"
        multiline
        style={styles.multilinea}
        value={datos.notas}
        onChangeText={(v) => cambiar('notas', v)}
      />
      <Mensaje texto={error} />
      <View style={styles.botones}>
        <Boton titulo={proceso ? 'Guardar cambios' : 'Crear proceso'} onPress={guardar} cargando={enviando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={onCerrar} disabled={enviando} />
      </View>
    </>
  );

  return proceso ? campos : <PantallaFormulario titulo="Nuevo proceso">{campos}</PantallaFormulario>;
}

function DetalleProceso({
  procesoId,
  documentos,
  personal,
  esAdmin,
  onCerrar,
}: {
  procesoId: string;
  documentos: DocumentoCompleto[];
  personal: Personal[];
  esAdmin: boolean;
  onCerrar: () => void;
}) {
  const hoy = hoyEnColombia();
  const [proceso, setProceso] = useState<ProcesoCompleto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [editando, setEditando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vigente = true;
    obtenerProceso(procesoId).then((r) => {
      if (!vigente) return;
      if (r.ok) setProceso(r.data);
      else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [procesoId, version]);

  if (!proceso) {
    return (
      <PantallaFormulario titulo="Proceso">
        {error ? <Mensaje texto={error} /> : <ActivityIndicator color={Colors.primary} />}
        <Boton titulo="Cerrar" variante="secundario" onPress={onCerrar} />
      </PantallaFormulario>
    );
  }

  const p = proceso;
  const { items, resumen } = evaluarProceso(p, hoy);
  const responsable = personal.find((u) => u.id === p.responsable_id);

  function recargar(mensaje?: string) {
    setAviso(mensaje ?? null);
    setError(null);
    setVersion((v) => v + 1);
  }

  async function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>, mensaje?: string) {
    setOcupado(true);
    const r = await accion();
    setOcupado(false);
    if (r.ok) recargar(mensaje);
    else setError(r.error ?? 'No se pudo completar la acción');
  }

  async function eliminar() {
    setOcupado(true);
    const r = await eliminarProceso(p.id);
    setOcupado(false);
    if (r.ok) onCerrar();
    else setError(r.error);
  }

  return (
    <PantallaFormulario titulo={p.numero}>
      <Text style={styles.entidad}>{p.entidad}</Text>
      <Text style={styles.texto}>{p.objeto}</Text>
      <View style={styles.fila}>
        <Text style={styles.estadoProceso}>{ETIQUETA_ESTADO_PROCESO[p.estado as EstadoProceso] ?? p.estado}</Text>
        <Text style={styles.detalle}>{textoCierre(p.fecha_cierre, hoy)}</Text>
      </View>
      {p.valor_estimado !== null ? <Text style={styles.detalle}>Valor estimado: {formatearPesos(p.valor_estimado)}</Text> : null}
      {responsable ? <Text style={styles.detalle}>Responsable: {responsable.nombre}</Text> : null}
      {p.notas ? <Text style={styles.nota}>{p.notas}</Text> : null}
      {p.enlace ? (
        <Boton titulo="Abrir en SECOP" variante="texto" onPress={() => Linking.openURL(p.enlace ?? '').catch(() => undefined)} />
      ) : null}
      <Mensaje tipo="exito" texto={aviso} />
      <Mensaje texto={error} />

      <Text style={styles.seccion}>Cumplimiento</Text>
      <View style={styles.cumplimiento}>
        <BarraCumplimiento resumen={resumen} />
        <Text style={styles.porcentajeGrande}>{resumen.porcentaje} %</Text>
      </View>
      <Text style={styles.detalle}>
        {resumen.cumplidos} de {resumen.total} requisitos
        {resumen.obligatoriosPendientes ? ` · ${resumen.obligatoriosPendientes} obligatorios pendientes` : ''}
      </Text>

      <Text style={styles.seccion}>Lista de verificación</Text>
      {items.length === 0 ? (
        <>
          <Text style={styles.detalle}>Agrega los requisitos del pliego o empieza con la lista habitual.</Text>
          <View style={styles.boton}>
            <Boton
              titulo={`Usar requisitos habituales (${PLANTILLA_REQUISITOS.length})`}
              variante="secundario"
              cargando={ocupado}
              onPress={() => ejecutar(() => agregarItems(p.id, PLANTILLA_REQUISITOS, 0), 'Requisitos agregados. Vincula cada uno con su documento.')}
            />
          </View>
        </>
      ) : null}
      {items.map((item) => (
        <FilaRequisito
          key={item.id}
          item={item}
          documentos={documentos}
          hoy={hoy}
          ocupado={ocupado}
          onAccion={ejecutar}
        />
      ))}
      <NuevoRequisito
        onAgregar={(requisito, obligatorio) =>
          ejecutar(() => agregarItems(p.id, [{ requisito, obligatorio }], items.length ? items[items.length - 1].orden + 1 : 0))
        }
        ocupado={ocupado}
      />

      <Text style={styles.seccion}>Paquete de documentos</Text>
      <DescargaPaquete proceso={p} items={items} onDescargado={() => recargar()} />

      <Text style={styles.seccion}>Datos del proceso</Text>
      {editando ? (
        <FormularioProcesoVista
          proceso={p}
          personal={personal}
          onCerrar={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            recargar('Proceso actualizado.');
          }}
        />
      ) : (
        <Boton titulo="Editar datos y estado" variante="secundario" onPress={() => setEditando(true)} />
      )}

      {esAdmin ? (
        <View style={styles.pie}>
          {confirmarEliminar ? (
            <>
              <Text style={styles.detalle}>Se borran el proceso, su lista y su bitácora. Los documentos no se tocan.</Text>
              <Boton titulo="Eliminar definitivamente" variante="peligro" onPress={eliminar} cargando={ocupado} />
              <Boton titulo="No eliminar" variante="texto" onPress={() => setConfirmarEliminar(false)} />
            </>
          ) : (
            <Boton titulo="Eliminar proceso" variante="texto" onPress={() => setConfirmarEliminar(true)} />
          )}
        </View>
      ) : null}
      <View style={styles.pie}>
        <Boton titulo="Cerrar" variante="secundario" onPress={onCerrar} disabled={ocupado} />
      </View>
    </PantallaFormulario>
  );
}

function FilaRequisito({
  item,
  documentos,
  hoy,
  ocupado,
  onAccion,
}: {
  item: ItemEvaluado;
  documentos: DocumentoCompleto[];
  hoy: string;
  ocupado: boolean;
  onAccion: (accion: () => Promise<{ ok: boolean; error?: string }>, mensaje?: string) => void;
}) {
  const [eligiendo, setEligiendo] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const d = item.documento;
  const opciones = filtrarDocumentos(documentos, '', busqueda).slice(0, 8);

  return (
    <View style={[styles.requisito, item.estado === 'vencido' && styles.requisitoVencido]}>
      <View style={styles.fila}>
        <Text style={styles.requisitoTexto}>
          {item.requisito}
          {item.obligatorio ? '' : ' (opcional)'}
        </Text>
        <EstadoItemTexto estado={item.estado} />
      </View>
      {d ? (
        <Text style={styles.detalle}>
          📄 {d.nombre} · v{d.version_actual}
          {d.vigencia ? ` · vence ${d.vigencia.fecha_vencimiento}` : ' · no vence'}
        </Text>
      ) : item.cumplido_manual ? (
        <Text style={styles.detalle}>Marcado como cumplido (se entrega por fuera del repositorio)</Text>
      ) : null}

      {eligiendo ? (
        <View style={styles.selector}>
          <CampoTexto etiqueta="Buscar documento" value={busqueda} onChangeText={setBusqueda} autoFocus />
          {opciones.length === 0 ? <Text style={styles.detalle}>Ningún documento coincide.</Text> : null}
          {opciones.map((doc) => (
            <Pressable
              key={doc.id}
              accessibilityRole="button"
              onPress={() => {
                setEligiendo(false);
                onAccion(() => actualizarItem(item.id, { documento_id: doc.id }));
              }}
              style={({ pressed }) => [styles.opcionDoc, pressed && styles.presionada]}>
              <Text style={styles.opcionTexto} numberOfLines={1}>
                {doc.nombre}
              </Text>
              <EstadoVigenciaTexto estado={estadoDocumento(doc, hoy)} />
            </Pressable>
          ))}
          <Boton titulo="Cancelar" variante="texto" onPress={() => setEligiendo(false)} />
        </View>
      ) : (
        <View style={styles.accionesItem}>
          <Boton
            titulo={d ? 'Cambiar documento' : 'Vincular documento'}
            variante="texto"
            onPress={() => setEligiendo(true)}
            disabled={ocupado}
          />
          {d ? (
            <Boton
              titulo="Quitar documento"
              variante="texto"
              onPress={() => onAccion(() => actualizarItem(item.id, { documento_id: null }))}
              disabled={ocupado}
            />
          ) : (
            <Boton
              titulo={item.cumplido_manual ? 'Desmarcar' : 'Marcar cumplido'}
              variante="texto"
              onPress={() => onAccion(() => actualizarItem(item.id, { cumplido_manual: !item.cumplido_manual }))}
              disabled={ocupado}
            />
          )}
          <Boton
            titulo="Eliminar"
            variante="texto"
            onPress={() => onAccion(() => eliminarItem(item.id))}
            disabled={ocupado}
          />
        </View>
      )}
    </View>
  );
}

function NuevoRequisito({
  onAgregar,
  ocupado,
}: {
  onAgregar: (requisito: string, obligatorio: boolean) => void;
  ocupado: boolean;
}) {
  const [requisito, setRequisito] = useState('');
  const [obligatorio, setObligatorio] = useState<'si' | 'no'>('si');

  return (
    <View style={styles.nuevo}>
      <CampoTexto
        etiqueta="Nuevo requisito"
        placeholder="Ej.: Certificado de antecedentes de los conductores"
        value={requisito}
        onChangeText={setRequisito}
      />
      <SelectorOpciones
        opciones={[
          { valor: 'si', texto: 'Obligatorio' },
          { valor: 'no', texto: 'Opcional' },
        ]}
        valor={obligatorio}
        onCambio={setObligatorio}
      />
      <Boton
        titulo="Agregar requisito"
        variante="secundario"
        disabled={ocupado || !requisito.trim()}
        onPress={() => {
          onAgregar(requisito, obligatorio === 'si');
          setRequisito('');
        }}
      />
    </View>
  );
}

/** HU-33 · Advierte los documentos vencidos o faltantes antes de armar el ZIP. */
function DescargaPaquete({
  proceso: p,
  items,
  onDescargado,
}: {
  proceso: ProcesoCompleto;
  items: ItemEvaluado[];
  onDescargado: () => void;
}) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const problemas = problemasPaquete(items);
  const hayProblemas = problemas.vencidos.length + problemas.venceAntesCierre.length + problemas.sinDocumento.length > 0;
  const conDocumento = items.filter((i) => i.documento_id).length;

  async function descargar() {
    setGenerando(true);
    setError(null);
    const r = await descargarPaquete(p.id);
    setGenerando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setResultado(
      `Paquete listo: ${r.data.documentos} documentos (${formatearTamano(r.data.tamano_bytes)})` +
        (r.data.vencidos ? ` · incluye ${r.data.vencidos} vencidos` : ''),
    );
    setUrl(r.data.url);
    onDescargado();
    // Si el navegador bloquea la ventana, queda el botón «Abrir descarga».
    Linking.openURL(r.data.url).catch(() => undefined);
  }

  return (
    <>
      {conDocumento === 0 ? (
        <Text style={styles.detalle}>Vincula al menos un documento para armar el paquete.</Text>
      ) : hayProblemas ? (
        <View style={styles.advertencia}>
          <Text style={styles.advertenciaTitulo}>Antes de descargar</Text>
          {problemas.vencidos.map((i) => (
            <Text key={i.id} style={styles.advertenciaTexto}>
              ✕ Vencido: {i.documento?.nombre ?? i.requisito}
            </Text>
          ))}
          {problemas.venceAntesCierre.map((i) => (
            <Text key={i.id} style={styles.advertenciaTexto}>
              ! Vence antes del cierre: {i.documento?.nombre ?? i.requisito}
            </Text>
          ))}
          {problemas.sinDocumento.map((i) => (
            <Text key={i.id} style={styles.advertenciaTexto}>
              ○ Sin documento: {i.requisito}
            </Text>
          ))}
          <Boton titulo="Descargar de todos modos" variante="peligro" onPress={descargar} cargando={generando} />
        </View>
      ) : (
        <Boton titulo="Descargar paquete (ZIP)" onPress={descargar} cargando={generando} />
      )}
      <Mensaje tipo="exito" texto={resultado} />
      {url ? (
        <Boton
          titulo="Abrir descarga (válida 10 minutos)"
          variante="texto"
          onPress={() => Linking.openURL(url).catch(() => setError('No se pudo abrir la descarga'))}
        />
      ) : null}
      <Mensaje texto={error} />
      {p.descargas.length > 0 ? (
        <>
          <Text style={styles.subtitulo}>Descargas anteriores</Text>
          {p.descargas.slice(0, 5).map((b) => (
            <Text key={b.id} style={styles.detalle}>
              {fechaHoraColombia(b.created_at)} · {b.documentos} documentos
              {b.vencidos ? ` · ${b.vencidos} vencidos` : ''}
            </Text>
          ))}
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  lista: { padding: Spacing.md, gap: Spacing.md },
  vacio: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.lg },
  boton: { marginBottom: Spacing.md },
  tarjeta: {
    padding: Spacing.md,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  presionada: { backgroundColor: Colors.surface },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  codigo: { fontSize: 13, fontWeight: '600', color: Colors.primaryDark, letterSpacing: 0.5, flexShrink: 1 },
  estadoProceso: { fontSize: 13, fontWeight: '700', color: Colors.text },
  entidad: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: Spacing.xs },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2, flexShrink: 1 },
  texto: { fontSize: 15, color: Colors.text, marginTop: Spacing.xs },
  alerta: { color: Colors.danger, fontWeight: '600' },
  nota: {
    fontSize: 14,
    color: Colors.text,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius,
    backgroundColor: Colors.surface,
  },
  cumplimiento: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  barraFondo: { flex: 1, height: 10, borderRadius: 5, backgroundColor: Colors.border, overflow: 'hidden' },
  barra: { height: '100%', borderRadius: 5 },
  porcentaje: { fontSize: 14, fontWeight: '700', color: Colors.text, minWidth: 44, textAlign: 'right' },
  porcentajeGrande: { fontSize: 22, fontWeight: '700', color: Colors.primaryDark, minWidth: 64, textAlign: 'right' },
  seccion: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  subtitulo: { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: Spacing.md },
  requisito: {
    padding: Spacing.sm,
    paddingLeft: Spacing.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.border,
  },
  requisitoVencido: { borderLeftColor: Colors.danger },
  requisitoTexto: { fontSize: 15, fontWeight: '600', color: Colors.text, flex: 1 },
  accionesItem: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  selector: { marginTop: Spacing.sm, padding: Spacing.sm, borderRadius: Radius, backgroundColor: Colors.surface },
  opcionDoc: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  opcionTexto: { fontSize: 15, color: Colors.text, flex: 1 },
  nuevo: { marginTop: Spacing.md },
  advertencia: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius,
    backgroundColor: Colors.dangerBg,
    gap: Spacing.xs,
  },
  advertenciaTitulo: { fontSize: 15, fontWeight: '700', color: Colors.danger },
  advertenciaTexto: { fontSize: 14, color: Colors.text },
  multilinea: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
  botones: { gap: Spacing.md },
  pie: { marginTop: Spacing.lg, gap: Spacing.sm },
});
