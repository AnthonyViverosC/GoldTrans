-- Sprint 2 · Cotizador instantáneo
-- HU-09 rutas · HU-10 tarifas con vigencia · HU-11..HU-14 cotización y desglose · RNF-04

-- Necesaria para la restricción de exclusión (tipo_vehiculo con = dentro de un índice GiST).
create extension if not exists btree_gist with schema extensions;

-- ─────────────────────────────────────────────────────────────
-- rutas (HU-09): origen → destino con distancia y peajes por trayecto.
-- ─────────────────────────────────────────────────────────────
create table public.rutas (
  id uuid primary key default gen_random_uuid(),
  origen text not null check (length(trim(origen)) > 0),
  destino text not null check (length(trim(destino)) > 0),
  distancia_km numeric(7, 1) not null check (distancia_km > 0 and distancia_km <= 5000),
  duracion_horas numeric(4, 1) check (duracion_horas > 0 and duracion_horas <= 99),
  -- Valor total de los peajes de un trayecto (pesos colombianos).
  peajes integer not null default 0 check (peajes >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rutas_origen_destino_distintos check (lower(trim(origen)) <> lower(trim(destino)))
);

create unique index rutas_origen_destino_unico on public.rutas (lower(trim(origen)), lower(trim(destino)));

create trigger rutas_set_updated_at
  before update on public.rutas
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- tarifas (HU-10): valores por tipo de vehículo con vigencia.
-- vigencia_hasta null = sin fecha de fin.
-- ─────────────────────────────────────────────────────────────
create table public.tarifas (
  id uuid primary key default gen_random_uuid(),
  tipo_vehiculo text not null
    check (tipo_vehiculo in ('automovil', 'camioneta', 'van', 'microbus', 'buseta', 'bus')),
  tarifa_base integer not null check (tarifa_base >= 0),
  valor_km integer not null check (valor_km >= 0),
  valor_dia integer not null check (valor_dia >= 0),
  recargo_fin_semana_pct integer not null default 0 check (recargo_fin_semana_pct between 0 and 100),
  vigencia_desde date not null,
  vigencia_hasta date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tarifas_vigencia_valida check (vigencia_hasta is null or vigencia_hasta >= vigencia_desde),
  -- Un tipo de vehículo no puede tener dos tarifas vigentes el mismo día.
  constraint tarifas_sin_superposicion exclude using gist (
    tipo_vehiculo with =,
    daterange(vigencia_desde, vigencia_hasta, '[]') with &&
  )
);

create trigger tarifas_set_updated_at
  before update on public.tarifas
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- cotizaciones (HU-13): cada cálculo queda registrado, también los de visitantes
-- (usuario_id null). Solo la Edge Function calcular-tarifa las crea.
-- ─────────────────────────────────────────────────────────────
create sequence public.cotizaciones_consecutivo_seq;

create table public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique
    default ('COT-' || lpad(nextval('public.cotizaciones_consecutivo_seq')::text, 6, '0')),
  usuario_id uuid references public.usuarios (id) on delete set null,
  ruta_id uuid not null references public.rutas (id),
  -- Copia de la ruta al momento de cotizar: el historial no cambia si la ruta se edita.
  origen text not null,
  destino text not null,
  tarifa_id uuid not null references public.tarifas (id),
  tipo_servicio text not null check (tipo_servicio in ('ida', 'ida_vuelta', 'disponibilidad')),
  fecha_inicio date not null,
  fecha_fin date not null,
  dias integer not null check (dias between 1 and 30),
  pasajeros integer not null check (pasajeros between 1 and 80),
  tipo_vehiculo text not null,
  capacidad_vehiculo integer not null,
  distancia_km numeric(8, 1) not null,
  valor_total integer not null check (valor_total >= 0),
  -- RNF-04: tiempo que tardó el cálculo en la Edge Function.
  duracion_ms integer,
  created_at timestamptz not null default now(),
  constraint cotizaciones_fechas check (fecha_fin >= fecha_inicio)
);

alter sequence public.cotizaciones_consecutivo_seq owned by public.cotizaciones.codigo;

create index cotizaciones_usuario_idx on public.cotizaciones (usuario_id, created_at desc);
create index cotizaciones_ruta_idx on public.cotizaciones (ruta_id);
create index cotizaciones_tarifa_idx on public.cotizaciones (tarifa_id);

-- ─────────────────────────────────────────────────────────────
-- detalle_cotizacion (HU-14): una línea por concepto del desglose.
-- ─────────────────────────────────────────────────────────────
create table public.detalle_cotizacion (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones (id) on delete cascade,
  orden smallint not null,
  concepto text not null check (concepto in ('tarifa_base', 'kilometraje', 'dias', 'peajes', 'recargo')),
  descripcion text not null,
  cantidad numeric(8, 1) not null,
  valor_unitario integer not null,
  subtotal integer not null,
  unique (cotizacion_id, orden)
);

-- ─────────────────────────────────────────────────────────────
-- Guarda cotización + desglose en una sola transacción.
-- Solo para la Edge Function (service role).
-- ─────────────────────────────────────────────────────────────
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
    pasajeros, tipo_vehiculo, capacidad_vehiculo, distancia_km, valor_total, duracion_ms
  )
  select
    r.usuario_id, r.ruta_id, r.origen, r.destino, r.tarifa_id, r.tipo_servicio, r.fecha_inicio,
    r.fecha_fin, r.dias, r.pasajeros, r.tipo_vehiculo, r.capacidad_vehiculo, r.distancia_km, r.valor_total, r.duracion_ms
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

-- ─────────────────────────────────────────────────────────────
-- RLS (RNF-02)
-- ─────────────────────────────────────────────────────────────
alter table public.rutas enable row level security;
alter table public.tarifas enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.detalle_cotizacion enable row level security;

revoke all on public.rutas, public.tarifas, public.cotizaciones, public.detalle_cotizacion
  from anon, authenticated;
revoke all on sequence public.cotizaciones_consecutivo_seq from anon, authenticated;

grant select on public.rutas to anon, authenticated;
grant insert, update, delete on public.rutas to authenticated;
grant select, insert, update, delete on public.tarifas to authenticated;
-- Las cotizaciones solo se leen desde la app; las crea la Edge Function.
grant select on public.cotizaciones, public.detalle_cotizacion to authenticated;

-- rutas: cualquiera (también visitantes) ve las activas para cotizar; asesor y admin ven todas.
create policy "rutas: lectura de rutas activas"
  on public.rutas for select
  to anon, authenticated
  using (activo);

create policy "rutas: asesor y admin ven todas"
  on public.rutas for select
  to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));

create policy "rutas: admin crea"
  on public.rutas for insert
  to authenticated
  with check ((select public.tiene_rol('admin')));

create policy "rutas: admin actualiza"
  on public.rutas for update
  to authenticated
  using ((select public.tiene_rol('admin')))
  with check ((select public.tiene_rol('admin')));

create policy "rutas: admin elimina"
  on public.rutas for delete
  to authenticated
  using ((select public.tiene_rol('admin')));

-- tarifas: información interna; asesor consulta, admin administra.
create policy "tarifas: asesor y admin consultan"
  on public.tarifas for select
  to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));

create policy "tarifas: admin crea"
  on public.tarifas for insert
  to authenticated
  with check ((select public.tiene_rol('admin')));

create policy "tarifas: admin actualiza"
  on public.tarifas for update
  to authenticated
  using ((select public.tiene_rol('admin')))
  with check ((select public.tiene_rol('admin')));

create policy "tarifas: admin elimina"
  on public.tarifas for delete
  to authenticated
  using ((select public.tiene_rol('admin')));

-- cotizaciones: el cliente ve las suyas; asesor y admin ven todas.
create policy "cotizaciones: ver las propias"
  on public.cotizaciones for select
  to authenticated
  using (usuario_id = (select auth.uid()) and (select public.rol_actual()) <> 'visitante');

create policy "cotizaciones: asesor y admin ven todas"
  on public.cotizaciones for select
  to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));

-- detalle: visible si la cotización lo es (la subconsulta aplica el RLS de cotizaciones).
create policy "detalle_cotizacion: según la cotización"
  on public.detalle_cotizacion for select
  to authenticated
  using (exists (select 1 from public.cotizaciones c where c.id = cotizacion_id));
