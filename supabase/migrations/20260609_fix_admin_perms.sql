-- ─────────────────────────────────────────────
-- QUEST — Fix permisos de ADMIN (envíos + puntos)
-- ─────────────────────────────────────────────
-- Síntoma: los usuarios con rol 'admin' no podían:
--   - ver / agregar / confirmar envíos (tabla packages)
--   - asignar puntos a jugadores (UPDATE de profiles.points)
--
-- Causa raíz: drift entre cliente y DB. En el cliente, isStaff = staff OR
-- admin OR owner (AuthContext.jsx). Pero del lado de la base:
--   - is_staff() (que gobierna las RLS de packages) NO incluía el rol 'admin'
--   - la policy profiles_update tampoco reconocía 'admin' en producción
-- Resultado: el admin veía la UI (gateada por el cliente) pero Postgres
-- rechazaba la lectura/escritura por RLS.
--
-- Esta migración alinea la DB con la intención del cliente. Es idempotente
-- (CREATE OR REPLACE / DROP IF EXISTS) y segura de re-correr.
-- ─────────────────────────────────────────────

-- 1) is_staff(): TRUE para owner, staff y admin.
--    SECURITY DEFINER + STABLE para que pueda leer profiles sin recursión RLS.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND (
        COALESCE(is_owner, false) = true
        OR role = ANY (ARRAY['staff'::user_role, 'admin'::user_role])
      )
  );
$$;

-- is_staff() lo usan las policies; mantener el grant histórico.
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, anon;

-- 2) profiles UPDATE: dueño del propio row, o staff/admin/owner (vía is_staff()).
--    Usar is_staff() evita la auto-referencia recursiva sobre profiles.
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE
  USING      ( (SELECT auth.uid()) = id OR public.is_staff() )
  WITH CHECK ( (SELECT auth.uid()) = id OR public.is_staff() );

-- 3) packages: re-asegurar que staff/admin/owner puedan VER, CONFIRMAR y BORRAR.
DROP POLICY IF EXISTS "packages_select" ON public.packages;
CREATE POLICY "packages_select" ON public.packages
  FOR SELECT USING (
    (SELECT auth.uid()) = sender_id
    OR (SELECT auth.uid()) = recipient_id
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "packages_update" ON public.packages;
CREATE POLICY "packages_update" ON public.packages
  FOR UPDATE USING (
    (SELECT auth.uid()) = sender_id
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "packages_delete" ON public.packages;
CREATE POLICY "packages_delete" ON public.packages
  FOR DELETE USING (
    (SELECT auth.uid()) = sender_id
    OR (SELECT auth.uid()) = recipient_id
    OR public.is_staff()
  );

-- INSERT lo deja igual (cada usuario crea sus propios envíos); el admin crea
-- con sender_id = su propio uid, así que ya estaba permitido. Re-asegurado:
DROP POLICY IF EXISTS "packages_insert" ON public.packages;
CREATE POLICY "packages_insert" ON public.packages
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = sender_id
    OR public.is_staff()
  );

-- 4) package_events: permitir a staff/admin insertar el historial al avanzar
--    estado (se hace en updatePackageStatus / confirmPackageArrival). Si la
--    policy ya existía con otro nombre, esta es aditiva y no rompe nada.
DROP POLICY IF EXISTS "package_events_insert_staff" ON public.package_events;
CREATE POLICY "package_events_insert_staff" ON public.package_events
  FOR INSERT WITH CHECK (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.packages pk
      WHERE pk.id = package_id
        AND ( (SELECT auth.uid()) = pk.sender_id OR (SELECT auth.uid()) = pk.recipient_id )
    )
  );
