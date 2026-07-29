-- ─────────────────────────────────────────────
-- QUEST — SEGURIDAD: cerrar place_paid_order() al público
-- ─────────────────────────────────────────────
-- CORRER CUANTO ANTES. Arregla un agujero real.
--
-- place_paid_order() es SECURITY DEFINER: descuenta stock e inserta en
-- shop_orders salteando RLS. Solo el servidor (service_role) debe poder
-- llamarla.
--
-- Las migraciones anteriores hacían:
--     REVOKE EXECUTE ON FUNCTION ... FROM anon, authenticated;
--
-- y eso NO alcanza. Al crear una función, Postgres le concede EXECUTE a
-- PUBLIC automáticamente, y anon/authenticated heredan ese permiso. Hay
-- que revocárselo a PUBLIC explícitamente.
--
-- Verificado contra prod: con la anon key la llamada entraba al cuerpo de
-- la función (devolvía 'Producto no encontrado' en vez de 403), o sea que
-- cualquiera podía crear pedidos falsos y descontar inventario.
--
-- Aplicar en SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION
  public.place_paid_order(uuid, integer, text, numeric, text, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.place_paid_order(uuid, integer, text, numeric, text, uuid, text, text, text)
  TO service_role;

-- Por si quedó viva la firma vieja de 8 argumentos en algún entorno.
DROP FUNCTION IF EXISTS public.place_paid_order(uuid, integer, text, numeric, text, uuid, text, text);

-- ─────────────────────────────────────────────
-- Comprobación. Tiene que devolver UNA fila con puede_anon = false.
-- Si devuelve true, el revoke no se aplicó — no sigas hasta resolverlo.
-- ─────────────────────────────────────────────
SELECT
  p.proname,
  has_function_privilege('anon',          p.oid, 'EXECUTE') AS puede_anon,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS puede_authenticated,
  has_function_privilege('service_role',  p.oid, 'EXECUTE') AS puede_service_role
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'place_paid_order';
