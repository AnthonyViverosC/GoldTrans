import { useState } from 'react';

import { BandejaReservas } from '@/components/bandeja-reservas';
import { BandejaSolicitudes } from '@/components/bandeja-solicitudes';
import { Segmentos } from '@/components/segmentos';

type Vista = 'solicitudes' | 'reservas';

const VISTAS: { valor: Vista; texto: string }[] = [
  { valor: 'solicitudes', texto: 'Solicitudes' },
  { valor: 'reservas', texto: 'Reservas y abonos' },
];

// HU-17 · HU-24 · El administrador también gestiona solicitudes, reservas y abonos.
// Van en una sola pestaña para que la barra del admin quepa en un teléfono.
export default function Ventas() {
  const [vista, setVista] = useState<Vista>('solicitudes');
  const selector = <Segmentos opciones={VISTAS} valor={vista} onCambio={setVista} />;
  return vista === 'solicitudes' ? (
    <BandejaSolicitudes encabezado={selector} />
  ) : (
    <BandejaReservas encabezado={selector} />
  );
}
