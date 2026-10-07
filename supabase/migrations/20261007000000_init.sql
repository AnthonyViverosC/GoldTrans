-- Sprint 0 · SCRUM-14 · Base del esquema GOLDTRANS
-- Las tablas de negocio se crean en las migraciones de cada sprint.

create extension if not exists "pgcrypto" with schema extensions;

-- Mantiene la columna updated_at al día en cualquier tabla que la tenga.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Verificación de conectividad desde la app: select * from public.health_check()
create or replace function public.health_check()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('status', 'ok', 'time', now());
$$;

grant execute on function public.health_check() to anon, authenticated;
