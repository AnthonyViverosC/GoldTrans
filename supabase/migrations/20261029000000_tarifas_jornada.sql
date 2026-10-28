-- Tarifas por jornada, como en las cotizaciones oficiales de GOLDTRANS (docs/tarifas.md).
--
-- Antes: valor_total = tarifa_base + (km × valor_km) + (días × valor_dia) + peajes + recargo
-- Ahora: valor_total = días × valor_jornada
--                    + max(0, km recorridos − km_incluidos_dia × días) × valor_km_adicional
--                    + recargo de fin de semana
-- El servicio es "a todo costo": vehículo, conductor, combustible, peajes y demás gastos operativos.
-- Una tarifa con ruta_id es un precio especial para esa ruta y prevalece sobre la general.

-- ─────────────────────────────────────────────────────────────
-- Tipo de vehículo "campero" (cotización SERVIEVENTOS).
-- ─────────────────────────────────────────────────────────────
alter table public.vehiculos drop constraint vehiculos_tipo_check;
alter table public.vehiculos add constraint vehiculos_tipo_check
  check (tipo in ('automovil', 'campero', 'camioneta', 'van', 'microbus', 'buseta', 'bus'));

alter table public.tarifas drop constraint tarifas_tipo_vehiculo_check;
alter table public.tarifas add constraint tarifas_tipo_vehiculo_check
  check (tipo_vehiculo in ('automovil', 'campero', 'camioneta', 'van', 'microbus', 'buseta', 'bus'));

-- ─────────────────────────────────────────────────────────────
-- tarifas: jornada, km incluidos, km adicional y ruta opcional.
-- ─────────────────────────────────────────────────────────────
alter table public.tarifas
  add column jornada_horas smallint not null default 12 check (jornada_horas in (4, 8, 12)),
  add column valor_jornada integer,
  add column km_incluidos_dia integer not null default 150 check (km_incluidos_dia between 0 and 2000),
  add column valor_km_adicional integer,
  add column ruta_id uuid references public.rutas (id) on delete cascade;

-- Las tarifas existentes pasan a jornada de 12 horas: el valor del día absorbe la tarifa base y
-- el valor por km queda como km adicional. El admin debe revisarlas después de aplicar la migración.
update public.tarifas
set valor_jornada = tarifa_base + valor_dia,
    valor_km_adicional = valor_km;

alter table public.tarifas
  alter column valor_jornada set not null,
  alter column valor_jornada set default 0,
  add constraint tarifas_valor_jornada_check check (valor_jornada >= 0),
  alter column valor_km_adicional set not null,
  alter column valor_km_adicional set default 0,
  add constraint tarifas_valor_km_adicional_check check (valor_km_adicional >= 0);

alter table public.tarifas drop constraint tarifas_sin_superposicion;
alter table public.tarifas
  drop column tarifa_base,
  drop column valor_km,
  drop column valor_dia;

-- Una sola tarifa vigente por día para cada tipo de vehículo, jornada y ruta (null = general).
alter table public.tarifas add constraint tarifas_sin_superposicion exclude using gist (
  tipo_vehiculo with =,
  jornada_horas with =,
  (coalesce(ruta_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =,
  daterange(vigencia_desde, vigencia_hasta, '[]') with &&
);

create index tarifas_ruta_idx on public.tarifas (ruta_id) where ruta_id is not null;

-- ─────────────────────────────────────────────────────────────
-- cotizaciones y desglose
-- ─────────────────────────────────────────────────────────────
-- Condiciones de la tarifa aplicada, para la nota de la cotización ("150 km diarios y $1.500 por
-- km adicional"); el cliente no puede leer la tabla tarifas. null en las cotizaciones anteriores.
alter table public.cotizaciones
  add column jornada_horas smallint check (jornada_horas in (4, 8, 12)),
  add column km_incluidos_dia integer,
  add column valor_km_adicional integer;

-- Se conservan los conceptos anteriores para el historial.
alter table public.detalle_cotizacion drop constraint detalle_cotizacion_concepto_check;
alter table public.detalle_cotizacion add constraint detalle_cotizacion_concepto_check
  check (concepto in ('jornada', 'km_adicional', 'peajes', 'recargo', 'tarifa_base', 'kilometraje', 'dias'));

create or replace function public.guardar_cotizacion(p_cotizacion jsonb, p_detalle jsonb)
returns public.cotizaciones
language plpgsql
set search_path = ''
as $$
declare
  c public.cotizaciones;
  suma integer;
begin
  insert into public.cotizaciones (
    usuario_id, ruta_id, origen, destino, tarifa_id, tipo_servicio, fecha_inicio, fecha_fin, dias,
    pasajeros, tipo_vehiculo, capacidad_vehiculo, distancia_km, valor_total, duracion_ms, jornada_horas,
    km_incluidos_dia, valor_km_adicional
  )
  select
    r.usuario_id, r.ruta_id, r.origen, r.destino, r.tarifa_id, r.tipo_servicio, r.fecha_inicio,
    r.fecha_fin, r.dias, r.pasajeros, r.tipo_vehiculo, r.capacidad_vehiculo, r.distancia_km, r.valor_total,
    r.duracion_ms, r.jornada_horas, r.km_incluidos_dia, r.valor_km_adicional
  from jsonb_populate_record(null::public.cotizaciones, p_cotizacion) r
  returning * into c;

  insert into public.detalle_cotizacion (
    cotizacion_id, orden, concepto, descripcion, cantidad, valor_unitario, subtotal
  )
  select c.id, d.orden, d.concepto, d.descripcion, d.cantidad, d.valor_unitario, d.subtotal
  from jsonb_populate_recordset(null::public.detalle_cotizacion, p_detalle) d;

  select coalesce(sum(subtotal), 0) into suma
  from public.detalle_cotizacion where cotizacion_id = c.id;
  if suma <> c.valor_total then
    raise exception 'El desglose (%) no coincide con el valor total (%)', suma, c.valor_total
      using errcode = '23514';
  end if;

  return c;
end;
$$;

revoke execute on function public.guardar_cotizacion(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.guardar_cotizacion(jsonb, jsonb) to service_role;

comment on column public.rutas.peajes is
  'Costo de referencia de los peajes de un trayecto. No se suma al cliente: el servicio es a todo costo.';
