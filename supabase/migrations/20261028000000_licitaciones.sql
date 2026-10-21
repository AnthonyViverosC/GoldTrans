-- Sprint 5 · Portal de licitaciones
-- HU-28 vigencias y alertas (60/30/15 días) · HU-29 tablero documental · HU-30 buscador
-- HU-31 procesos de licitación · HU-32 lista de verificación · HU-33 descarga del paquete

-- ═════════════════════════════════════════════════════════════
-- VIGENCIAS (HU-28) · una por documento; los que no vencen (p. ej. el RUT) no tienen fila.
-- Estado: vencido si ya pasó la fecha; por vencer si faltan 60 días o menos (desde la primera alerta).
-- La misma regla está en supabase/functions/_shared/licitaciones.ts (app y Edge Functions).
-- ═════════════════════════════════════════════════════════════
create table public.vigencias (
  documento_id uuid primary key references public.documentos (id) on delete cascade,
  fecha_expedicion date,
  fecha_vencimiento date not null,
  -- Quien recibe las alertas: un asesor o un administrador activo (trigger de abajo).
  responsable_id uuid not null references public.usuarios (id),
  notas text,
  actualizado_por uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vigencias_fechas check (fecha_expedicion is null or fecha_expedicion <= fecha_vencimiento)
);

create index vigencias_vencimiento_idx on public.vigencias (fecha_vencimiento);

create trigger vigencias_set_updated_at
  before update on public.vigencias
  for each row execute function public.set_updated_at();

create or replace function public.validar_responsable_vigencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.usuarios u
     where u.id = new.responsable_id and u.activo and u.rol in ('asesor', 'admin')
  ) then
    raise exception 'El responsable debe ser un asesor o administrador activo' using errcode = '23514';
  end if;
  new.actualizado_por := auth.uid();
  return new;
end;
$$;

create trigger vigencias_validar_responsable
  before insert or update on public.vigencias
  for each row execute function public.validar_responsable_vigencia();

create or replace function public.estado_vigencia(p_vence date, p_hoy date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_vence is null then 'sin_vigencia'
    when p_vence < p_hoy then 'vencido'
    when p_vence <= p_hoy + 60 then 'por_vencer'
    else 'vigente'
  end;
$$;

grant execute on function public.estado_vigencia(date, date) to authenticated;

-- ═════════════════════════════════════════════════════════════
-- ALERTAS (HU-28) · las crea la Edge Function alertas-vencimiento (cron diario).
-- Cada día se toma el umbral más cercano que ya se alcanzó (60, 30, 15 o 0 = vencido) y se crea
-- su alerta si no existe: no se repiten y, si el cron falló unos días, no llegan alertas atrasadas en cadena.
-- ═════════════════════════════════════════════════════════════
create table public.alertas (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos (id) on delete cascade,
  responsable_id uuid not null references public.usuarios (id) on delete cascade,
  umbral integer not null check (umbral in (60, 30, 15, 0)),
  fecha_vencimiento date not null,
  dias_restantes integer not null,
  mensaje text not null,
  correo_enviado_at timestamptz,
  leida_at timestamptz,
  created_at timestamptz not null default now(),
  unique (documento_id, fecha_vencimiento, umbral)
);

create index alertas_responsable_idx on public.alertas (responsable_id, created_at desc);

create or replace function public.generar_alertas_vencimiento(p_hoy date default null)
returns table (alerta_id uuid, email text, documento text, mensaje text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := coalesce(p_hoy, public.hoy_colombia());
begin
  return query
  with nuevas as (
    insert into public.alertas as a (documento_id, responsable_id, umbral, fecha_vencimiento, dias_restantes, mensaje)
    select v.documento_id, v.responsable_id, u.umbral, v.fecha_vencimiento, v.fecha_vencimiento - v_hoy,
           case
             when v.fecha_vencimiento < v_hoy then
               format('«%s» venció el %s. Renuévalo y sube la nueva versión.', d.nombre, v.fecha_vencimiento)
             when v.fecha_vencimiento = v_hoy then format('«%s» vence hoy.', d.nombre)
             else format('«%s» vence en %s días (%s).', d.nombre, v.fecha_vencimiento - v_hoy, v.fecha_vencimiento)
           end
      from public.vigencias v
      join public.documentos d on d.id = v.documento_id
      cross join lateral (
        select min(x) as umbral from unnest(array[60, 30, 15, 0]) as x where v.fecha_vencimiento - v_hoy <= x
      ) u
     where u.umbral is not null
    on conflict (documento_id, fecha_vencimiento, umbral) do nothing
    returning a.id, a.responsable_id, a.documento_id, a.mensaje
  )
  select n.id, us.email, d.nombre, n.mensaje
    from nuevas n
    join public.usuarios us on us.id = n.responsable_id
    join public.documentos d on d.id = n.documento_id;
end;
$$;

revoke execute on function public.generar_alertas_vencimiento(date) from public, anon, authenticated;
grant execute on function public.generar_alertas_vencimiento(date) to service_role;

-- ═════════════════════════════════════════════════════════════
-- PROCESOS DE LICITACIÓN (HU-31) y LISTA DE VERIFICACIÓN (HU-32)
-- Un requisito se cumple con un documento del repositorio (vigente en la fecha de cierre)
-- o, si no es un documento del repositorio (p. ej. la carta de presentación), marcándolo a mano.
-- ═════════════════════════════════════════════════════════════
create table public.procesos_licitacion (
  id uuid primary key default gen_random_uuid(),
  numero text not null check (length(trim(numero)) > 0),
  entidad text not null check (length(trim(entidad)) > 0),
  objeto text not null check (length(trim(objeto)) > 0),
  fecha_cierre date not null,
  valor_estimado bigint check (valor_estimado >= 0),
  estado text not null default 'preparacion'
    check (estado in ('preparacion', 'presentada', 'adjudicada', 'no_adjudicada', 'desierta', 'cancelada')),
  enlace text,
  notas text,
  responsable_id uuid references public.usuarios (id) on delete set null,
  creado_por uuid references public.usuarios (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index procesos_licitacion_numero_unico
  on public.procesos_licitacion (lower(entidad), lower(numero));
create index procesos_licitacion_estado_idx on public.procesos_licitacion (estado, fecha_cierre);

create trigger procesos_licitacion_set_updated_at
  before update on public.procesos_licitacion
  for each row execute function public.set_updated_at();

create table public.items_verificacion (
  id uuid primary key default gen_random_uuid(),
  proceso_id uuid not null references public.procesos_licitacion (id) on delete cascade,
  orden integer not null default 0,
  requisito text not null check (length(trim(requisito)) > 0),
  obligatorio boolean not null default true,
  -- set null: si se borra el documento, el requisito vuelve a quedar pendiente.
  documento_id uuid references public.documentos (id) on delete set null,
  cumplido_manual boolean not null default false,
  notas text,
  created_at timestamptz not null default now(),
  constraint items_verificacion_manual_sin_documento check (not (cumplido_manual and documento_id is not null))
);

create index items_verificacion_proceso_idx on public.items_verificacion (proceso_id, orden);
create index items_verificacion_documento_idx on public.items_verificacion (documento_id);

-- HU-33 · Registro de cada paquete descargado (lo escribe la Edge Function descargar-paquete).
create table public.bitacora_descargas (
  id uuid primary key default gen_random_uuid(),
  proceso_id uuid not null references public.procesos_licitacion (id) on delete cascade,
  usuario_id uuid references public.usuarios (id) on delete set null,
  documentos integer not null check (documentos >= 0),
  vencidos integer not null check (vencidos >= 0),
  tamano_bytes bigint not null default 0,
  ruta text,
  created_at timestamptz not null default now()
);

create index bitacora_descargas_proceso_idx on public.bitacora_descargas (proceso_id, created_at desc);

-- Paquetes ZIP generados: privados, los escribe solo la Edge Function (service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('paquetes-licitacion', 'paquetes-licitacion', false, 104857600, array['application/zip'])
on conflict (id) do nothing;

create policy "paquetes-licitacion: asesor y admin descargan"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'paquetes-licitacion' and (select public.tiene_rol('asesor', 'admin')));

-- ═════════════════════════════════════════════════════════════
-- RLS (RNF-02) · el portal es solo para asesor y admin
-- ═════════════════════════════════════════════════════════════
alter table public.vigencias enable row level security;
alter table public.alertas enable row level security;
alter table public.procesos_licitacion enable row level security;
alter table public.items_verificacion enable row level security;
alter table public.bitacora_descargas enable row level security;

revoke all on public.vigencias, public.alertas, public.procesos_licitacion,
  public.items_verificacion, public.bitacora_descargas from anon, authenticated;

grant select, insert, update, delete on public.vigencias, public.procesos_licitacion,
  public.items_verificacion to authenticated;
-- Las alertas solo se marcan como leídas; las crea el cron.
grant select, update (leida_at) on public.alertas to authenticated;
grant select on public.bitacora_descargas to authenticated;

create policy "vigencias: asesor y admin ven" on public.vigencias for select to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));
create policy "vigencias: asesor y admin registran" on public.vigencias for insert to authenticated
  with check ((select public.tiene_rol('asesor', 'admin')));
create policy "vigencias: asesor y admin actualizan" on public.vigencias for update to authenticated
  using ((select public.tiene_rol('asesor', 'admin'))) with check ((select public.tiene_rol('asesor', 'admin')));
create policy "vigencias: asesor y admin quitan" on public.vigencias for delete to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));

-- Cada quien ve y marca sus alertas; el admin ve las de todos.
create policy "alertas: el responsable ve las suyas" on public.alertas for select to authenticated
  using (responsable_id = (select auth.uid()) and (select public.tiene_rol('asesor', 'admin')));
create policy "alertas: el admin ve todas" on public.alertas for select to authenticated
  using ((select public.tiene_rol('admin')));
create policy "alertas: el responsable las marca leídas" on public.alertas for update to authenticated
  using (responsable_id = (select auth.uid()) and (select public.tiene_rol('asesor', 'admin')))
  with check (responsable_id = (select auth.uid()));

create policy "procesos_licitacion: asesor y admin ven" on public.procesos_licitacion for select to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));
create policy "procesos_licitacion: asesor y admin crean" on public.procesos_licitacion for insert to authenticated
  with check ((select public.tiene_rol('asesor', 'admin')));
create policy "procesos_licitacion: asesor y admin actualizan" on public.procesos_licitacion for update to authenticated
  using ((select public.tiene_rol('asesor', 'admin'))) with check ((select public.tiene_rol('asesor', 'admin')));
create policy "procesos_licitacion: admin elimina" on public.procesos_licitacion for delete to authenticated
  using ((select public.tiene_rol('admin')));

create policy "items_verificacion: asesor y admin ven" on public.items_verificacion for select to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));
create policy "items_verificacion: asesor y admin crean" on public.items_verificacion for insert to authenticated
  with check ((select public.tiene_rol('asesor', 'admin')));
create policy "items_verificacion: asesor y admin actualizan" on public.items_verificacion for update to authenticated
  using ((select public.tiene_rol('asesor', 'admin'))) with check ((select public.tiene_rol('asesor', 'admin')));
create policy "items_verificacion: asesor y admin eliminan" on public.items_verificacion for delete to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));

create policy "bitacora_descargas: asesor y admin ven" on public.bitacora_descargas for select to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));

-- ═════════════════════════════════════════════════════════════
-- PROGRAMACIÓN (HU-28) · todos los días a las 7:00 de Colombia (12:00 UTC).
-- Usa los mismos secretos de Vault que liberar-cupos (docs/sprint-4.md).
-- ═════════════════════════════════════════════════════════════
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule(
      'alertas-vencimiento',
      '0 12 * * *',
      $cron$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
                 || '/functions/v1/alertas-vencimiento',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
          ),
          body := '{}'::jsonb
        );
      $cron$
    );
  end if;
end;
$$;
