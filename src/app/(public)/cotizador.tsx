import { useState } from 'react';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { SelectorOpciones } from '@/components/selector-opciones';
import { useAuth } from '@/hooks/use-auth';
import { requerido, sinErrores, validarEntero, validarFecha } from '@/lib/validacion';

type TipoServicio = 'ida' | 'ida_vuelta' | 'disponibilidad';

const SERVICIOS: { valor: TipoServicio; texto: string }[] = [
  { valor: 'ida', texto: 'Solo ida' },
  { valor: 'ida_vuelta', texto: 'Ida y vuelta' },
  { valor: 'disponibilidad', texto: 'Por días' },
];

// HU-05 · Cotizar sin registro previo: accesible para visitantes y para cualquier rol.
// El cálculo de la tarifa (rutas, tarifas, sugerencia de vehículo) se implementa en el Sprint 2.
export default function Cotizador() {
  const { rol } = useAuth();
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [fecha, setFecha] = useState('');
  const [pasajeros, setPasajeros] = useState('');
  const [servicio, setServicio] = useState<TipoServicio>('ida');
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});
  const [listo, setListo] = useState(false);

  function cotizar() {
    const nuevos = {
      origen: requerido(origen, 'Indica el origen'),
      destino: requerido(destino, 'Indica el destino'),
      fecha: requerido(fecha, 'Indica la fecha') ?? validarFecha(fecha),
      pasajeros: validarEntero(pasajeros, 1, 80, 'Entre 1 y 80 pasajeros'),
    };
    setErrores(nuevos);
    setListo(sinErrores(nuevos));
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
      <CampoTexto etiqueta="Origen" placeholder="La Hormiga" value={origen} onChangeText={setOrigen} error={errores.origen} />
      <CampoTexto etiqueta="Destino" placeholder="Mocoa" value={destino} onChangeText={setDestino} error={errores.destino} />
      <SelectorOpciones etiqueta="Tipo de servicio" opciones={SERVICIOS} valor={servicio} onCambio={setServicio} />
      <CampoTexto
        etiqueta="Fecha del servicio"
        placeholder="AAAA-MM-DD"
        value={fecha}
        onChangeText={setFecha}
        error={errores.fecha}
      />
      <CampoTexto
        etiqueta="Número de pasajeros"
        keyboardType="number-pad"
        value={pasajeros}
        onChangeText={setPasajeros}
        error={errores.pasajeros}
      />

      <Mensaje
        tipo="exito"
        texto={
          listo
            ? 'Datos recibidos. El cálculo automático de la tarifa estará disponible próximamente.'
            : null
        }
      />
      <Boton titulo="Cotizar" onPress={cotizar} />
    </PantallaFormulario>
  );
}
