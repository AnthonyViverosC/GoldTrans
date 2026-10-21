import { useState } from 'react';

import { ProcesosLicitacion } from '@/components/procesos-licitacion';
import { RepositorioDocumentos } from '@/components/repositorio-documentos';
import { Segmentos } from '@/components/segmentos';

type Vista = 'documentos' | 'licitaciones';

const VISTAS: { valor: Vista; texto: string }[] = [
  { valor: 'documentos', texto: 'Documentos' },
  { valor: 'licitaciones', texto: 'Licitaciones' },
];

// HU-27 a HU-33 · Portal de licitaciones del admin: repositorio documental y procesos.
// Van en una sola pestaña para que la barra del admin quepa en un teléfono.
export default function Portal() {
  const [vista, setVista] = useState<Vista>('documentos');
  const selector = <Segmentos opciones={VISTAS} valor={vista} onCambio={setVista} />;
  return vista === 'documentos' ? (
    <RepositorioDocumentos encabezado={selector} />
  ) : (
    <ProcesosLicitacion encabezado={selector} />
  );
}
