import { Link } from 'expo-router';

import { Boton } from '@/components/boton';
import { InicioRol } from '@/components/inicio-rol';

// Inicio del rol Cliente. El historial de cotizaciones llega con el Sprint 2.
export default function MisCotizaciones() {
  return (
    <InicioRol vacio="Aún no tienes cotizaciones guardadas.">
      <Link href="/cotizador" asChild>
        <Boton titulo="Nueva cotización" />
      </Link>
    </InicioRol>
  );
}
