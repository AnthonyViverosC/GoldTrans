import { Link } from 'expo-router';

import { Boton } from '@/components/boton';
import { InicioRol } from '@/components/inicio-rol';

// Inicio del rol Asesor. La bandeja de solicitudes llega con el Sprint 3 (HU-17).
export default function Solicitudes() {
  return (
    <InicioRol vacio="No hay solicitudes pendientes.">
      <Link href="/cotizador" asChild>
        <Boton titulo="Abrir cotizador" variante="secundario" />
      </Link>
    </InicioRol>
  );
}
