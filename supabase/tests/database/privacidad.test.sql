-- RNF-03 · Autorización de tratamiento de datos personales (Ley 1581 de 2012)
-- Ejecutar con: npx supabase test db   (requiere `npx supabase start`)
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Sin autorización no se crea la cuenta
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values
    ('00000000-0000-0000-0000-000000000901', 'sin@priv.co', '{"nombre_completo":"Sin Autorizar"}')$$,
  '23514', null, 'registro sin autorización: se rechaza');
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values
    ('00000000-0000-0000-0000-000000000902', 'no@priv.co',
     '{"autoriza_datos":false,"version_aviso_privacidad":"2026-10-30","nombre_completo":"No Autoriza"}')$$,
  '23514', null, 'registro con la casilla sin marcar: se rechaza');
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values
    ('00000000-0000-0000-0000-000000000903', 'version@priv.co', '{"autoriza_datos":true,"nombre_completo":"Sin Version"}')$$,
  '23514', null, 'registro sin versión del aviso: se rechaza');
select is((select count(*)::int from public.usuarios where email like '%@priv.co'), 0,
  'los registros rechazados no dejan usuarios');

-- Con autorización queda la prueba: fecha del servidor y versión del aviso
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000904', 'si@priv.co',
   '{"autoriza_datos":true,"version_aviso_privacidad":"2026-10-30","nombre_completo":"Si Autoriza"}');
select ok(
  (select autoriza_datos_at is not null and version_aviso_privacidad = '2026-10-30'
     from public.perfiles where usuario_id = '00000000-0000-0000-0000-000000000904'),
  'registro autorizado: guarda fecha y versión del aviso');

-- El titular puede consultar su autorización, pero no modificarla
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000904","role":"authenticated"}', true);
select isnt((select autoriza_datos_at from public.perfiles), null, 'el titular puede ver su autorización');
select throws_ok(
  $$update public.perfiles set autoriza_datos_at = now() - interval '1 year'
    where usuario_id = '00000000-0000-0000-0000-000000000904'$$,
  '42501', null, 'el titular no puede alterar la prueba de la autorización');

select * from finish();
rollback;
