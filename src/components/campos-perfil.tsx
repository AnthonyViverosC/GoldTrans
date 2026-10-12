import { CampoTexto } from '@/components/campo-texto';
import { SelectorOpciones } from '@/components/selector-opciones';
import {
  TIPOS_DOCUMENTO,
  type DatosPerfil,
  type Errores,
  type TipoPersona,
} from '@/lib/validacion';

type Props<T extends DatosPerfil> = {
  datos: T;
  errores: Errores<keyof DatosPerfil>;
  onCambio: <K extends keyof DatosPerfil>(campo: K, valor: T[K]) => void;
  /** En el perfil el tipo de persona no se cambia después del registro. */
  tipoBloqueado?: boolean;
};

const TIPOS: { valor: TipoPersona; texto: string }[] = [
  { valor: 'persona', texto: 'Persona natural' },
  { valor: 'empresa', texto: 'Empresa (NIT)' },
];

/** Campos de persona natural o empresa compartidos por registro (HU-01) y perfil (HU-04). */
export function CamposPerfil<T extends DatosPerfil>({
  datos,
  errores,
  onCambio,
  tipoBloqueado,
}: Props<T>) {
  const esEmpresa = datos.tipoPersona === 'empresa';
  return (
    <>
      <SelectorOpciones
        etiqueta="Tipo de cliente"
        opciones={TIPOS}
        valor={datos.tipoPersona}
        onCambio={(v) => onCambio('tipoPersona', v)}
        deshabilitado={tipoBloqueado}
      />

      {esEmpresa ? (
        <>
          <CampoTexto
            etiqueta="Razón social"
            value={datos.razonSocial}
            onChangeText={(v) => onCambio('razonSocial', v)}
            error={errores.razonSocial}
          />
          <CampoTexto
            etiqueta="NIT"
            placeholder="900123456-8"
            keyboardType="numbers-and-punctuation"
            value={datos.nit}
            onChangeText={(v) => onCambio('nit', v)}
            error={errores.nit}
            ayuda="Incluye el dígito de verificación"
          />
        </>
      ) : null}

      <CampoTexto
        etiqueta={esEmpresa ? 'Nombre del representante' : 'Nombre completo'}
        autoComplete="name"
        textContentType="name"
        value={datos.nombreCompleto}
        onChangeText={(v) => onCambio('nombreCompleto', v)}
        error={errores.nombreCompleto}
      />

      {!esEmpresa ? (
        <>
          <SelectorOpciones
            etiqueta="Tipo de documento"
            opciones={TIPOS_DOCUMENTO.map((t) => ({ valor: t, texto: t }))}
            valor={datos.tipoDocumento}
            onCambio={(v) => onCambio('tipoDocumento', v)}
          />
          <CampoTexto
            etiqueta="Número de documento"
            keyboardType="number-pad"
            value={datos.numeroDocumento}
            onChangeText={(v) => onCambio('numeroDocumento', v)}
            error={errores.numeroDocumento}
          />
        </>
      ) : null}

      <CampoTexto
        etiqueta="Teléfono / WhatsApp"
        placeholder="3001234567"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        value={datos.telefono}
        onChangeText={(v) => onCambio('telefono', v)}
        error={errores.telefono}
      />
      <CampoTexto
        etiqueta="Ciudad (opcional)"
        value={datos.ciudad}
        onChangeText={(v) => onCambio('ciudad', v)}
      />
    </>
  );
}
