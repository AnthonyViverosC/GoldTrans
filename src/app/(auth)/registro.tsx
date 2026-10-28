import { Link, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { Casilla } from '@/components/casilla';
import { CamposPerfil } from '@/components/campos-perfil';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { TEXTO_AUTORIZACION } from '@/constants/privacidad';
import { Colors } from '@/constants/theme';
import { registrar } from '@/lib/auth';
import { sinErrores, validarRegistro, type DatosRegistro, type Errores } from '@/lib/validacion';

const INICIAL: DatosRegistro = {
  tipoPersona: 'persona',
  nombreCompleto: '',
  tipoDocumento: 'CC',
  numeroDocumento: '',
  razonSocial: '',
  nit: '',
  telefono: '',
  ciudad: '',
  email: '',
  password: '',
  confirmacion: '',
  autorizaDatos: false,
};

// HU-01 · Registrar usuario como persona natural o empresa con NIT.
export default function Registro() {
  const [datos, setDatos] = useState(INICIAL);
  const [errores, setErrores] = useState<Errores<keyof DatosRegistro>>({});
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function cambiar<K extends keyof DatosRegistro>(campo: K, valor: DatosRegistro[K]) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function enviar() {
    const nuevos = validarRegistro(datos);
    setErrores(nuevos);
    if (!sinErrores(nuevos)) {
      setError('Revisa los campos marcados');
      return;
    }
    setEnviando(true);
    setError(null);
    const resultado = await registrar(datos, Linking.createURL('/login'));
    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    if (resultado.data.requiereConfirmacion) {
      setExito(`Te enviamos un correo a ${datos.email.trim()}. Confírmalo y luego inicia sesión.`);
    }
    // Sin confirmación de correo la sesión ya está activa y la navegación cambia sola.
  }

  if (exito) {
    return (
      <PantallaFormulario titulo="¡Cuenta creada!" margenSuperior={false}>
        <Mensaje tipo="exito" texto={exito} />
        <Boton titulo="Ir a iniciar sesión" onPress={() => router.replace('/login')} />
      </PantallaFormulario>
    );
  }

  return (
    <PantallaFormulario
      titulo="Crear cuenta"
      subtitulo="Regístrate como persona natural o como empresa"
      margenSuperior={false}>
      <CamposPerfil datos={datos} errores={errores} onCambio={cambiar} />

      <CampoTexto
        etiqueta="Correo electrónico"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        value={datos.email}
        onChangeText={(v) => cambiar('email', v)}
        error={errores.email}
      />
      <CampoTexto
        etiqueta="Contraseña"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        value={datos.password}
        onChangeText={(v) => cambiar('password', v)}
        error={errores.password}
        ayuda="Mínimo 8 caracteres, con letras y números"
      />
      <CampoTexto
        etiqueta="Confirmar contraseña"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        value={datos.confirmacion}
        onChangeText={(v) => cambiar('confirmacion', v)}
        error={errores.confirmacion}
      />

      {/* RNF-03 · Autorización expresa (Ley 1581 de 2012): sin marcar no se puede registrar. */}
      <Casilla
        marcada={datos.autorizaDatos}
        onCambio={(v) => cambiar('autorizaDatos', v)}
        texto={TEXTO_AUTORIZACION}
        error={errores.autorizaDatos}>
        <Link href="/privacidad" style={styles.enlace}>
          Leer el aviso de privacidad
        </Link>
      </Casilla>

      <Mensaje texto={error} />
      <Boton titulo="Registrarme" onPress={enviar} cargando={enviando} />
    </PantallaFormulario>
  );
}

const styles = StyleSheet.create({
  enlace: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
});
