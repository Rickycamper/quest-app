-- ─────────────────────────────────────────────
-- QUEST — Fix permisos de ADMIN (envíos, puntos, subastas, cartas)
-- ─────────────────────────────────────────────
-- Síntoma: usuarios con rol 'admin' no podían ver/agregar/confirmar envíos
-- (packages) ni asignar puntos (profiles.points), entre otros.
-- Causa raíz: drift cliente↔DB. El cliente trata admin como staff
-- (isStaff = staff|admin|owner) pero is_staff() y varias policies en la DB
-- NO incluían 'admin'.
--
-- VERSIÓN DEFENSIVA: chequea con to_regclass() si cada tabla existe antes de
-- tocarla (producción tenía migraciones sin aplicar, ej. q_redemptions no
-- existía). Aplica lo que exista y saltea lo demás. Idempotente.
-- El guard de seguridad de approve/reject_redemption se aplica aparte cuando
-- la tabla q_redemptions exista (ver 20260609_fix_redemption_security.sql).
-- ─────────────────────────────────────────────

-- is_staff() = owner | staff | admin
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND (COALESCE(is_owner, false) = true
           OR role = ANY (ARRAY['staff'::user_role, 'admin'::user_role]))
  );
$fn$;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, anon;

-- profiles: dar puntos a jugadores
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id OR public.is_staff())
  WITH CHECK ((SELECT auth.uid()) = id OR public.is_staff());

-- packages
DO $$ BEGIN
  IF to_regclass('public.packages') IS NOT NULL THEN
    EXECUTE $q$DROP POLICY IF EXISTS "packages_select" ON public.packages$q$;
    EXECUTE $q$CREATE POLICY "packages_select" ON public.packages FOR SELECT USING ((SELECT auth.uid()) = sender_id OR (SELECT auth.uid()) = recipient_id OR public.is_staff())$q$;
    EXECUTE $q$DROP POLICY IF EXISTS "packages_update" ON public.packages$q$;
    EXECUTE $q$CREATE POLICY "packages_update" ON public.packages FOR UPDATE USING ((SELECT auth.uid()) = sender_id OR public.is_staff())$q$;
    EXECUTE $q$DROP POLICY IF EXISTS "packages_delete" ON public.packages$q$;
    EXECUTE $q$CREATE POLICY "packages_delete" ON public.packages FOR DELETE USING ((SELECT auth.uid()) = sender_id OR (SELECT auth.uid()) = recipient_id OR public.is_staff())$q$;
    EXECUTE $q$DROP POLICY IF EXISTS "packages_insert" ON public.packages$q$;
    EXECUTE $q$CREATE POLICY "packages_insert" ON public.packages FOR INSERT WITH CHECK ((SELECT auth.uid()) = sender_id OR public.is_staff())$q$;
  END IF;
END $$;

-- package_events
DO $$ BEGIN
  IF to_regclass('public.package_events') IS NOT NULL THEN
    EXECUTE $q$DROP POLICY IF EXISTS "package_events_insert_staff" ON public.package_events$q$;
    EXECUTE $q$CREATE POLICY "package_events_insert_staff" ON public.package_events FOR INSERT WITH CHECK (public.is_staff() OR EXISTS (SELECT 1 FROM public.packages pk WHERE pk.id = package_id AND ((SELECT auth.uid()) = pk.sender_id OR (SELECT auth.uid()) = pk.recipient_id)))$q$;
  END IF;
END $$;

-- auctions: editar/terminar + crear (incluye planes pagos)
DO $$ BEGIN
  IF to_regclass('public.auctions') IS NOT NULL THEN
    EXECUTE $q$DROP POLICY IF EXISTS "auctions_update_admin" ON public.auctions$q$;
    EXECUTE $q$CREATE POLICY "auctions_update_admin" ON public.auctions FOR UPDATE USING (public.is_staff())$q$;
    EXECUTE $q$DROP POLICY IF EXISTS "auctions_insert_staff" ON public.auctions$q$;
    EXECUTE $q$CREATE POLICY "auctions_insert_staff" ON public.auctions FOR INSERT WITH CHECK (public.is_staff() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = ANY (ARRAY['premium'::user_role,'wizard'::user_role,'mage'::user_role,'archmage'::user_role])))$q$;
  END IF;
END $$;

-- deck_cards: incluir staff
DO $$ BEGIN
  IF to_regclass('public.deck_cards') IS NOT NULL THEN
    EXECUTE $q$DROP POLICY IF EXISTS "deck_cards: update admin" ON public.deck_cards$q$;
    EXECUTE $q$CREATE POLICY "deck_cards: update admin" ON public.deck_cards FOR UPDATE TO authenticated USING (public.is_staff())$q$;
    EXECUTE $q$DROP POLICY IF EXISTS "deck_cards: delete admin" ON public.deck_cards$q$;
    EXECUTE $q$CREATE POLICY "deck_cards: delete admin" ON public.deck_cards FOR DELETE TO authenticated USING (public.is_staff())$q$;
  END IF;
END $$;

-- q_redemptions: alinear la policy (solo si la tabla existe)
DO $$ BEGIN
  IF to_regclass('public.q_redemptions') IS NOT NULL THEN
    EXECUTE $q$DROP POLICY IF EXISTS "admins manage redemptions" ON public.q_redemptions$q$;
    EXECUTE $q$CREATE POLICY "admins manage redemptions" ON public.q_redemptions FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff())$q$;
  END IF;
END $$;
