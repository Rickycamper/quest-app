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

-- ─────────────────────────────────────────────
-- Otros casos del MISMO bug (drift cliente↔DB) detectados en la auditoría.
-- El cliente ya habilita estas acciones a staff/admin/owner; la DB las
-- limitaba a 'admin' (excluyendo staff y el owner-booleano). Alineamos con
-- is_staff() = owner | staff | admin.
-- ─────────────────────────────────────────────

-- 5) Subastas: terminar/editar estaba limitado a role='admin'
--    (excluía staff y owner-booleano).
DROP POLICY IF EXISTS "auctions_update_admin" ON public.auctions;
CREATE POLICY "auctions_update_admin" ON public.auctions
  FOR UPDATE USING ( public.is_staff() );

-- 6) Subastas: crear. "Poder subastar" es un beneficio de los planes pagos
--    (wizard/mage/archmage + premium legacy), además de staff/admin/owner.
--    Antes excluía a esos planes y al owner-booleano.
DROP POLICY IF EXISTS "auctions_insert_staff" ON public.auctions;
CREATE POLICY "auctions_insert_staff" ON public.auctions
  FOR INSERT WITH CHECK (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = ANY (ARRAY['premium'::user_role, 'wizard'::user_role,
                              'mage'::user_role, 'archmage'::user_role])
    )
  );

-- 7) Catálogo de cartas (deck_cards): actualizar/borrar excluía a 'staff'.
DROP POLICY IF EXISTS "deck_cards: update admin" ON public.deck_cards;
CREATE POLICY "deck_cards: update admin" ON public.deck_cards
  FOR UPDATE TO authenticated USING ( public.is_staff() );

DROP POLICY IF EXISTS "deck_cards: delete admin" ON public.deck_cards;
CREATE POLICY "deck_cards: delete admin" ON public.deck_cards
  FOR DELETE TO authenticated USING ( public.is_staff() );

-- 8) Canjes de Q Coins (q_redemptions): la policy listaba el literal 'owner'
--    (que NO es un valor válido del enum role) y no chequeaba el owner-booleano,
--    así que un owner no-admin/staff no podía ver los canjes pendientes.
DROP POLICY IF EXISTS "admins manage redemptions" ON public.q_redemptions;
CREATE POLICY "admins manage redemptions" ON public.q_redemptions
  FOR ALL USING ( public.is_staff() ) WITH CHECK ( public.is_staff() );

-- 9) SEGURIDAD: approve_redemption / reject_redemption eran SECURITY DEFINER,
--    estaban granteadas a 'authenticated' y NO chequeaban rol → cualquier
--    usuario logueado podía aprobar/rechazar canjes (y disparar reembolsos)
--    llamando la función directo. Re-creadas con el mismo cuerpo + guard is_staff().
CREATE OR REPLACE FUNCTION public.approve_redemption(p_id uuid)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  UPDATE q_redemptions
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_id AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_redemption(p_id uuid, p_note text DEFAULT NULL)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_r q_redemptions;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_r FROM q_redemptions WHERE id = p_id AND status = 'pending';
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE q_redemptions
  SET status = 'rejected', admin_note = p_note,
      reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_id;

  -- Reembolso de los puntos al usuario
  UPDATE profiles SET q_points = q_points + v_r.points WHERE id = v_r.user_id;
  INSERT INTO q_points_log (user_id, amount, reason)
  VALUES (v_r.user_id, v_r.points, 'Reembolso — canje rechazado');
END;
$$;
