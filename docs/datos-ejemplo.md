# Datos de ejemplo

`scripts/datos-ejemplo.mjs` llena la app con un escenario realista para presentarla: tarifas, ventas y el
portal de licitaciones en todos sus estados. Todo lo que crea queda registrado y se borra con un comando.

```bash
npm run demo:crear     # contra el proyecto de .env
npm run demo:borrar    # elimina exactamente lo que se creó
```

Contra un proyecto remoto hay que confirmarlo con `DEMO_PRODUCCION=1` (en PowerShell:
`$env:DEMO_PRODUCCION='1'; npm run demo:crear`). Antes debe estar aplicada la migración de tarifas por
jornada y desplegada `calcular-tarifa` (ver [tarifas.md](tarifas.md)).

## Qué crea

| Área | Datos |
|---|---|
| Usuarios | 1 asesora y 3 clientes (2 empresas con NIT y 1 persona): `demo-*@goldtrans.test` |
| Flota | 4 vehículos DMO101–DMO104: camioneta 4x4, campero, van y bus |
| Rutas | Puerto Asís → La Hormiga, Mocoa → La Hormiga, Mocoa → Puerto Asís, La Hormiga → La Dorada, La Hormiga → Orito (solo las que falten) |
| Tarifas | 7 generales (4, 8 y 12 h) y 5 precios especiales por ruta, con los valores de las cotizaciones oficiales. Si ya hay una tarifa vigente igual, se respeta |
| Ventas · solicitudes | 6 cotizaciones reales del cotizador con su solicitud: confirmada, ajustada (con motivo), rechazada, cancelada y 2 pendientes |
| Ventas · reservas | Una fecha de salida nueva (en 40 días) del primer paquete publicado, con 6 reservas: prerreserva, abono por verificar, confirmada, pagada, abono rechazado y cancelada. Los comprobantes son PDF |
| Portal · documentos | 12 documentos en las 7 categorías: vigentes, por vencer, vencidos y sin vencimiento; uno con dos versiones. Se generan las alertas de vencimiento |
| Portal · licitaciones | 2 procesos: uno en preparación (requisitos cumplidos, uno que vence antes del cierre, uno vencido, uno manual y uno pendiente) y uno presentado |

Las entidades y empresas llevan "(ejemplo)" en el nombre. Las cuentas creadas, con su contraseña, quedan en
`scripts/.datos-ejemplo.json`, que está fuera de git, por si se quiere iniciar sesión como asesora o cliente.

## Si algo falla a mitad

Lo creado hasta ese punto ya está en el manifiesto: `npm run demo:borrar` lo elimina y se puede volver a crear.
