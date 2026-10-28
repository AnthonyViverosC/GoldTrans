-- RNF-02 · Pruebas de políticas RLS por rol (Sprint 1)
-- Ejecutar con: npx supabase test db   (requiere `npx supabase start`)
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Usuarios de prueba: el trigger on_auth_user_created crea usuarios + perfiles.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000c', 'cliente@test.co',
   '{"autoriza_datos":true,"version_aviso_privacidad":"test","tipo_persona":"persona","nombre_completo":"Ana Cliente","tipo_documento":"CC","numero_documento":"1012345678"}'),
  ('00000000-0000-0000-0000-00000000000e', 'empresa@test.co',
   '{"autoriza_datos":true,"version_aviso_privacidad":"test","tipo_persona":"empresa","nombre_completo":"Luis Empresa","razon_social":"Transportes Sur SAS","nit":"900123456-8","rol":"admin"}'),
  ('00000000-0000-0000-0000-00000000000a', 'asesor@test.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","nombre_completo":"Asesor"}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","nombre_completo":"Admin"}');

update public.usuarios set rol = 'asesor' where email = 'asesor@test.co';
update public.usuarios set rol = 'admin' where email = 'admin@test.co';

-- Registro (HU-01)
select is((select count(*)::int from public.usuarios where email like '%@test.co'), 4,
  'el trigger crea una fila en usuarios por cada cuenta');
select is((select rol from public.usuarios where email = 'empresa@test.co'), 'cliente',
  'el rol enviado en metadata se ignora: todo registro es cliente');
select is((select nit from public.perfiles where usuario_id = '00000000-0000-0000-0000-00000000000e'),
  '900123456-8', 'la empresa queda registrada con su NIT');
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values
    ('00000000-0000-0000-0000-0000000000ff', 'malo@test.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","tipo_persona":"empresa","nombre_completo":"X"}')$$,
  '23514', null, 'una empresa sin NIT no puede registrarse');

-- Visitante (anon)
set local role anon;
select set_config('request.jwt.claims', '', true);
select is((select count(*)::int from public.roles), 4, 'visitante: puede leer el catálogo de roles');
select throws_ok('select * from public.usuarios', '42501', null, 'visitante: no accede a usuarios');
select throws_ok('select * from public.vehiculos', '42501', null, 'visitante: no accede a la flota');

-- Cliente
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.usuarios), 1, 'cliente: solo ve su propio usuario');
select is((select count(*)::int from public.perfiles), 1, 'cliente: solo ve su propio perfil');
select is((select count(*)::int from public.vehiculos), 0, 'cliente: no ve la flota');
update public.perfiles set telefono = '3001234567' where usuario_id = '00000000-0000-0000-0000-00000000000c';
select is((select telefono from public.perfiles), '3001234567', 'cliente: puede editar su perfil');
update public.usuarios set rol = 'admin' where id = '00000000-0000-0000-0000-00000000000c';
select is(public.rol_actual(), 'cliente', 'cliente: no puede autoasignarse el rol admin');
select throws_ok(
  $$insert into public.vehiculos (placa, tipo, marca, modelo, anio, capacidad_pasajeros)
    values ('ABC123', 'van', 'Toyota', 'Hiace', 2022, 15)$$,
  '42501', null, 'cliente: no puede crear vehículos');

-- Asesor
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.usuarios where email like '%@test.co'), 4, 'asesor: ve todos los usuarios');
update public.usuarios set activo = false where id = '00000000-0000-0000-0000-00000000000c';
reset role;
select is((select activo from public.usuarios where id = '00000000-0000-0000-0000-00000000000c'), true,
  'asesor: no puede desactivar usuarios');

-- Admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.vehiculos (placa, tipo, marca, modelo, anio, capacidad_pasajeros)
    values ('XYZ987', 'buseta', 'Chevrolet', 'NPR', 2021, 30)$$,
  'admin: puede crear vehículos');
update public.usuarios set activo = false where id = '00000000-0000-0000-0000-00000000000c';
select is((select activo from public.usuarios where id = '00000000-0000-0000-0000-00000000000c'), false,
  'admin: puede desactivar usuarios');
select throws_ok(
  $$update public.usuarios set rol = 'cliente' where id = '00000000-0000-0000-0000-0000000000ad'$$,
  '42501', null, 'admin: no puede quitarse su propio rol');

-- Usuario desactivado pierde el acceso aunque su JWT siga vigente
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.rol_actual(), 'visitante', 'desactivado: se trata como visitante');
select is((select count(*)::int from public.perfiles), 0, 'desactivado: no ve su perfil');

select * from finish();
rollback;
