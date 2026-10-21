import { router } from 'expo-router';
import { useState } from 'react';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { enviarRecuperacion } from '@/lib/auth';
import { validarEmail } from '@/lib/validacion';

// HU-07 · Recuperar contraseña (paso 1: enviar el código al correo).
export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [errorCampo, setErrorCampo] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const err = validarEmail(email);
    setErrorCampo(err);
    if (err) return;
    setEnviando(true);
    setError(null);
    const resultado = await enviarRecuperacion(email);
    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    // /restablecer está fuera de (auth): al verificar el código se abre una sesión
    // y las pantallas de (auth) dejan de estar disponibles.
    router.push({ pathname: '/restablecer', params: { email: email.trim().toLowerCase() } });
  }

  return (
    <PantallaFormulario
      titulo="Recuperar contraseña"
      subtitulo="Te enviaremos un código a tu correo para crear una nueva contraseña"
      margenSuperior={false}>
      <Mensaje texto={error} />
      <CampoTexto
        etiqueta="Correo electrónico"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={enviar}
        error={errorCampo}
      />
      <Boton titulo="Enviar código" onPress={enviar} cargando={enviando} />
    </PantallaFormulario>
  );
}
