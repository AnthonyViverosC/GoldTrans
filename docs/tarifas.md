# Tarifas por jornada (modelo de las cotizaciones oficiales)

Fuente: las cuatro cotizaciones reales de GOLDTRANS en `docs/Ejemplos/`
(COOTRANSERP, FUNDESAC, Progresur y SERVIEVENTOS COLOMBIA SAS, 2025–2026).

## Qué dicen las cotizaciones

| Cliente | Vehículo | Modalidad | Valor | Kilometraje | Pago |
|---|---|---|---|---|---|
| COOTRANSERP (ago-2026) | Camioneta 4x4 doble cabina con platón | 12 horas | $580.000 por día | 150 km diarios · $1.500 km adicional | Con factura |
| FUNDESAC (ago-2026) | Camioneta 4x4 doble cabina con platón | 12 horas | $550.000 por día | 150 km diarios · $1.200 km adicional | Con factura |
| Progresur (oct-2025) | Camioneta doble cabina 4x4 (Hilux 2025) | — | $650.000 por trayecto (Puerto Asís ↔ Valle del Guamuez) | 150 km diarios · $1.500 km adicional | 50 % al inicio, 50 % al final |
| SERVIEVENTOS (may-2026) | Camioneta 4x4 y campero | 4 y 8 horas | $650.000 a $850.000 según la ruta | — | Con factura |

Conclusiones que se llevaron a la app:

1. **Se cobra por jornada, no por kilómetro.** El precio es por día de servicio en modalidad de
   4, 8 o 12 horas. Los km solo se cobran cuando pasan de los incluidos (150 por día).
2. **A todo costo.** Todas incluyen vehículo, conductor, combustible y demás gastos operativos:
   los peajes no se suman aparte.
3. **El precio cambia según la ruta.** En SERVIEVENTOS la misma camioneta de 8 horas vale $780.000
   (Puerto Asís – Valle del Guamuez) y $850.000 (Mocoa – Valle del Guamuez).
4. **El precio se negocia por cliente** ($580.000 frente a $550.000 por el mismo servicio). La app da el
   valor de referencia y el asesor lo ajusta al responder la solicitud (HU-17, que ya existía).
5. Aparece un tipo de vehículo que la app no tenía: **campero**.
6. **Formato de la carta:** encabezado con logo y control documental (SGI-OP-CT-01, versión 0), lugar y
   fecha, «Señores» con razón social y NIT, referencia, tabla (vehículo · itinerario · observación · valor),
   total, notas, firma y pie con teléfonos, correos, web y dirección.

## Fórmula

```
valor_total = días × valor_jornada
            + max(0, km recorridos − km_incluidos_dia × días) × valor_km_adicional
            + recargo de fin de semana
```

| Concepto | Regla |
|---|---|
| Jornada | 4, 8 o 12 horas. La elige quien cotiza (12 por defecto, como en las cotizaciones oficiales) |
| Km recorridos | km de la ruta × trayectos (1 en *solo ida*; 2 en *ida y vuelta* y *por días*) |
| Km incluidos | `km_incluidos_dia` × días de servicio |
| Peajes | Incluidos. El desglose muestra la línea «Peajes, combustible y conductor: incluidos» |
| Recargo fin de semana | `(jornadas + km adicionales) × % ÷ días` por cada día que cae en sábado o domingo |
| Tarifa aplicada | La vigente en la fecha de inicio para el vehículo y la jornada. Si la ruta tiene **precio especial** vigente, ese prevalece sobre la tarifa general |

La lógica vive en `supabase/functions/_shared/calculo.ts`, que comparten la Edge Function, la app y Jest.

## Administración (rol admin)

**Tarifas** → *Agregar tarifa*: vehículo, jornada, «Aplica a» (todas las rutas o una ruta), valor por
jornada, km incluidos por día, valor del km adicional, recargo y vigencia. No puede haber dos tarifas
vigentes el mismo día para el mismo vehículo, jornada y ruta (restricción `tarifas_sin_superposicion`).

Valores de referencia tomados de las cotizaciones (para cargarlos y luego ajustarlos):

| Vehículo | Jornada | Aplica a | Valor jornada | Km incluidos | Km adicional |
|---|---|---|---|---|---|
| Camioneta 4x4 doble cabina | 12 h | Todas las rutas | $580.000 | 150 | $1.500 |
| Camioneta 4x4 doble cabina | 8 h | Puerto Asís → Valle del Guamuez | $780.000 | 150 | $1.500 |
| Camioneta 4x4 doble cabina | 8 h | Mocoa → Valle del Guamuez | $850.000 | 150 | $1.500 |
| Camioneta 4x4 doble cabina | 8 h | Mocoa → Puerto Asís | $780.000 | 150 | $1.500 |
| Camioneta 4x4 doble cabina | 4 h | Valle del Guamuez → La Dorada | $650.000 | 150 | $1.500 |
| Campero | 8 h | Puerto Asís → Valle del Guamuez | $750.000 | 150 | $1.500 |

El campo **peajes** de la ruta queda como costo interno de referencia: no se cobra al cliente.

## Cotización en PDF, WhatsApp y correo

El PDF reproduce la carta oficial con los datos de `src/constants/empresa.ts`. Si el cliente tiene sesión,
el «Señores» usa su razón social y NIT (empresa) o su nombre y documento (persona). Las notas incluyen
la modalidad, la base de kilometraje de la tarifa aplicada, la forma de pago y lo que incluye el servicio.
El resultado del cotizador tiene además **Hablar con un asesor**, que abre WhatsApp con el número
comercial (3227279371) y la cotización escrita.

## Despliegue

El orden importa: la función nueva necesita las columnas nuevas, y la función anterior deja de
funcionar en cuanto se eliminan las columnas viejas.

```bash
npx supabase db push                          # migración 20261029000000_tarifas_jornada.sql
npx supabase functions deploy calcular-tarifa # en seguida, sin esperar
```

Después de aplicar la migración, revisar en **Tarifas** las tarifas existentes. La migración las
convierte a jornada de 12 horas con `valor_jornada = tarifa_base + valor_dia` y
`valor_km_adicional = valor_km`, que no necesariamente es el precio real.

Las versiones de la app ya instaladas siguen cotizando: si la petición no trae `jornada_horas`, la función
usa 12 horas.

## Pendiente (no implementado)

- **Varias líneas en una cotización.** SERVIEVENTOS cotiza 7 combinaciones de vehículo y ruta en una sola
  carta. La app cotiza una ruta a la vez; las cotizaciones de varias líneas las sigue armando el asesor.
- **Recorridos con veredas intermedias** (COOTRANSERP): se modelan como una ruta con la distancia total.
- **Firma del representante legal.** El PDF de la app firma como «Área comercial» porque es un valor de
  referencia que aún no ha confirmado un asesor.
