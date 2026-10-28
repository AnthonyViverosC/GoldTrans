-- Sprint 2 · Rutas, tarifas y cotizaciones: reglas de negocio y RLS por rol (RNF-02)
-- Ejecutar con: npx supabase test db   (requiere `npx supabase start`)
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000002c1', 'cliente1@cot.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","nombre_completo":"Cliente Uno"}'),
  ('00000000-0000-0000-0000-0000000002c2', 'cliente2@cot.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","nombre_completo":"Cliente Dos"}'),
  ('00000000-0000-0000-0000-0000000002a5', 'asesor@cot.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","nombre_completo":"Asesor"}'),
  ('00000000-0000-0000-0000-0000000002ad', 'admin@cot.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","nombre_completo":"Admin"}');
update public.usuarios set rol = 'asesor' where email = 'asesor@cot.co';
update public.usuarios set rol = 'admin' where email = 'admin@cot.co';

insert into public.rutas (id, origen, destino, distancia_km, peajes, activo) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Prueba Origen', 'Prueba Destino', 100, 10000, true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Prueba Origen', 'Prueba Inactiva', 50, 0, false);
insert into public.tarifas (id, tipo_vehiculo, jornada_horas, valor_jornada, valor_km_adicional, vigencia_desde) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'van', 12, 580000, 1500, '2026-01-01');

-- Cotización de prueba: 580.000 + 30.000 (20 km adicionales × 1.500) + 0 + 0 = 610.000
create function pg_temp.cotizar(p_usuario uuid, p_total integer default 610000)
returns public.cotizaciones
language sql
as $$
  select public.guardar_cotizacion(
    jsonb_build_object(
      'usuario_id', p_usuario, 'ruta_id', 'aaaaaaaa-0000-0000-0000-000000000001',
      'origen', 'Prueba Origen', 'destino', 'Prueba Destino',
      'tarifa_id', 'bbbbbbbb-0000-0000-0000-000000000001', 'tipo_servicio', 'ida',
      'fecha_inicio', '2026-10-21', 'fecha_fin', '2026-10-21', 'dias', 1, 'pasajeros', 10,
      'tipo_vehiculo', 'van', 'capacidad_vehiculo', 15, 'distancia_km', 100,
      'valor_total', p_total, 'duracion_ms', 120,
      'jornada_horas', 12, 'km_incluidos_dia', 150, 'valor_km_adicional', 1500),
    '[{"orden":1,"concepto":"jornada","descripcion":"Servicio jornada 12 horas","cantidad":1,"valor_unitario":580000,"subtotal":580000},
      {"orden":2,"concepto":"km_adicional","descripcion":"Kilómetros adicionales","cantidad":20,"valor_unitario":1500,"subtotal":30000},
      {"orden":3,"concepto":"peajes","descripcion":"Peajes, combustible y conductor","cantidad":1,"valor_unitario":0,"subtotal":0},
      {"orden":4,"concepto":"recargo","descripcion":"Recargo","cantidad":0,"valor_unitario":0,"subtotal":0}]'::jsonb);
$$;

-- Reglas de negocio
select throws_ok(
  $$insert into public.tarifas (tipo_vehiculo, jornada_horas, valor_jornada, valor_km_adicional, vigencia_desde)
    values ('van', 12, 1, 1, '2027-01-01')$$,
  '23P01', null, 'HU-10: no se permiten vigencias superpuestas para el mismo tipo y jornada');
select lives_ok(
  $$insert into public.tarifas (tipo_vehiculo, jornada_horas, valor_jornada, valor_km_adicional, vigencia_desde)
    values ('van', 8, 1, 1, '2026-01-01')$$,
  'HU-10: otra jornada del mismo vehículo puede tener la misma vigencia');
select lives_ok(
  $$insert into public.tarifas (tipo_vehiculo, jornada_horas, valor_jornada, valor_km_adicional, vigencia_desde, ruta_id)
    values ('van', 12, 780000, 1500, '2026-01-01', 'aaaaaaaa-0000-0000-0000-000000000001')$$,
  'HU-10: precio especial de una ruta junto a la tarifa general');
select throws_ok(
  $$insert into public.tarifas (tipo_vehiculo, jornada_horas, valor_jornada, valor_km_adicional, vigencia_desde, ruta_id)
    values ('van', 12, 800000, 1500, '2026-03-01', 'aaaaaaaa-0000-0000-0000-000000000001')$$,
  '23P01', null, 'HU-10: dos precios especiales de la misma ruta no se superponen');
select throws_ok(
  $$insert into public.tarifas (tipo_vehiculo, jornada_horas, valor_jornada, valor_km_adicional, vigencia_desde)
    values ('van', 6, 1, 1, '2030-01-01')$$,
  '23514', null, 'HU-10: la jornada es de 4, 8 o 12 horas');
select lives_ok(
  $$insert into public.tarifas (tipo_vehiculo, jornada_horas, valor_jornada, valor_km_adicional, vigencia_desde)
    values ('campero', 8, 750000, 1500, '2026-01-01')$$,
  'HU-10: el campero es un tipo de vehículo válido');
select throws_ok(
  $$insert into public.tarifas (tipo_vehiculo, valor_jornada, valor_km_adicional, vigencia_desde, vigencia_hasta)
    values ('buseta', 1, 1, '2026-05-01', '2026-04-30')$$,
  '23514', null, 'HU-10: la vigencia no puede terminar antes de empezar');
select throws_ok(
  $$insert into public.rutas (origen, destino, distancia_km) values ('prueba origen', 'PRUEBA DESTINO', 10)$$,
  '23505', null, 'HU-09: no se repite origen-destino (sin importar mayúsculas)');
select throws_ok(
  $$insert into public.rutas (origen, destino, distancia_km) values ('Mocoa', ' mocoa', 10)$$,
  '23514', null, 'HU-09: origen y destino deben ser distintos');

select lives_ok($$select pg_temp.cotizar('00000000-0000-0000-0000-0000000002c1')$$,
  'guardar_cotizacion: guarda cotización y desglose');
select matches(
  (select codigo from public.cotizaciones where usuario_id = '00000000-0000-0000-0000-0000000002c1'),
  '^COT-[0-9]{6}$', 'la cotización recibe un código consecutivo');
select is(
  (select count(*)::int from public.detalle_cotizacion d
     join public.cotizaciones c on c.id = d.cotizacion_id
    where c.usuario_id = '00000000-0000-0000-0000-0000000002c1'),
  4, 'HU-14: el desglose tiene sus 4 conceptos');
select is(
  (select jornada_horas::int from public.cotizaciones where usuario_id = '00000000-0000-0000-0000-0000000002c1'),
  12, 'la cotización guarda la jornada de la tarifa aplicada');
select throws_ok($$select pg_temp.cotizar(null, 1)$$,
  '23514', null, 'guardar_cotizacion: el total debe cuadrar con el desglose');
select lives_ok($$select pg_temp.cotizar('00000000-0000-0000-0000-0000000002c2')$$,
  'cotización de otro cliente');
select lives_ok($$select pg_temp.cotizar(null)$$, 'HU-05: cotización de un visitante (sin usuario)');

-- Visitante (anon)
set local role anon;
select set_config('request.jwt.claims', '', true);
select is((select count(*)::int from public.rutas where origen = 'Prueba Origen'), 1,
  'visitante: ve solo las rutas activas');
select throws_ok('select * from public.tarifas', '42501', null, 'visitante: no ve las tarifas');
select throws_ok('select * from public.cotizaciones', '42501', null, 'visitante: no lee cotizaciones');
select throws_ok($$select public.guardar_cotizacion('{}', '[]')$$, '42501', null,
  'visitante: no puede guardar cotizaciones directamente');
select throws_ok(
  $$insert into public.rutas (origen, destino, distancia_km) values ('A', 'B', 1)$$,
  '42501', null, 'visitante: no crea rutas');

-- Cliente
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002c1","role":"authenticated"}', true);
select is((select count(*)::int from public.rutas where origen = 'Prueba Origen'), 1,
  'cliente: ve solo las rutas activas');
select is((select count(*)::int from public.tarifas), 0, 'cliente: no ve las tarifas');
select is((select count(*)::int from public.cotizaciones), 1, 'cliente: ve solo sus cotizaciones');
select is((select count(*)::int from public.detalle_cotizacion), 4, 'cliente: ve el desglose de las suyas');
select throws_ok(
  $$insert into public.cotizaciones (ruta_id, origen, destino, tarifa_id, tipo_servicio, fecha_inicio,
      fecha_fin, dias, pasajeros, tipo_vehiculo, capacidad_vehiculo, distancia_km, valor_total)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'A', 'B', 'bbbbbbbb-0000-0000-0000-000000000001',
      'ida', '2026-10-21', '2026-10-21', 1, 1, 'van', 15, 1, 1)$$,
  '42501', null, 'cliente: no puede inventar cotizaciones');
select throws_ok($$select public.guardar_cotizacion('{}', '[]')$$, '42501', null,
  'cliente: no puede llamar guardar_cotizacion');
select throws_ok(
  $$insert into public.rutas (origen, destino, distancia_km) values ('A', 'B', 1)$$,
  '42501', null, 'cliente: no crea rutas');

-- Asesor
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002a5","role":"authenticated"}', true);
select is((select count(*)::int from public.rutas where origen = 'Prueba Origen'), 2,
  'asesor: ve también las rutas inactivas');
select is((select count(*)::int from public.tarifas), 4, 'asesor: consulta las tarifas');
select is(
  (select count(*)::int from public.cotizaciones where ruta_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  3, 'asesor: ve todas las cotizaciones');
select throws_ok(
  $$insert into public.tarifas (tipo_vehiculo, valor_jornada, valor_km_adicional, vigencia_desde)
    values ('microbus', 1, 1, '2026-01-01')$$,
  '42501', null, 'asesor: no crea tarifas');

-- Admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002ad","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.rutas (origen, destino, distancia_km, peajes) values ('La Hormiga', 'Prueba Admin', 30, 0)$$,
  'admin: crea rutas');
update public.tarifas set valor_km_adicional = 1200 where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select is((select valor_km_adicional from public.tarifas where id = 'bbbbbbbb-0000-0000-0000-000000000001'), 1200,
  'admin: actualiza tarifas');
select throws_ok(
  $$delete from public.rutas where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23503', null, 'admin: no puede borrar una ruta con cotizaciones (debe desactivarla)');

select * from finish();
rollback;
