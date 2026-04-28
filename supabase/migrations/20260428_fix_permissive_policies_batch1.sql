-- ─────────────────────────────────────────────
-- QUEST — Fix multiple permissive policies (batch 1)
-- Tables: seasons, shop_products, shop_reservations
--
-- Pattern: FOR ALL policy + FOR SELECT policy on same table
-- → Postgres evaluates both on every SELECT.
-- Fix: split FOR ALL into explicit DML policies, keep single SELECT.
-- ─────────────────────────────────────────────

-- ── 1. seasons ────────────────────────────────────────────────────────────────
-- "admins manage seasons" is FOR ALL (includes SELECT)
-- "anyone can read seasons" is FOR SELECT USING (true)
-- → two SELECT policies fire on every read. Fix: split admin into DML only.

DROP POLICY IF EXISTS "admins manage seasons" ON public.seasons;

CREATE POLICY "seasons_admin_insert" ON public.seasons
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND (is_owner = true OR role IN ('admin'))
    )
  );

CREATE POLICY "seasons_admin_update" ON public.seasons
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND (is_owner = true OR role IN ('admin'))
    )
  );

CREATE POLICY "seasons_admin_delete" ON public.seasons
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND (is_owner = true OR role IN ('admin'))
    )
  );

-- ── 2. shop_products ──────────────────────────────────────────────────────────
-- shop_owner_write is FOR ALL (includes SELECT for owner)
-- shop_read_all is FOR SELECT USING (true)  ← already covers owner reads
-- → redundant SELECT. Fix: split owner into DML only.

DROP POLICY IF EXISTS "shop_owner_write" ON public.shop_products;

CREATE POLICY "shop_owner_insert" ON public.shop_products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_owner = true
    )
  );

CREATE POLICY "shop_owner_update" ON public.shop_products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_owner = true
    )
  );

CREATE POLICY "shop_owner_delete" ON public.shop_products
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_owner = true
    )
  );

-- ── 3. shop_reservations ──────────────────────────────────────────────────────
-- reservations_owner_all FOR ALL (includes SELECT for owner)
-- reservations_user_read FOR SELECT USING (user_id = auth.uid())
-- → two SELECT policies. Fix: merge SELECT into one, split owner into DML.

DROP POLICY IF EXISTS "reservations_owner_all"  ON public.shop_reservations;
DROP POLICY IF EXISTS "reservations_user_read"  ON public.shop_reservations;

-- Single SELECT: own reservation OR owner/staff viewing all
CREATE POLICY "reservations_select" ON public.shop_reservations
  FOR SELECT USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_owner = true
    )
  );

CREATE POLICY "reservations_insert" ON public.shop_reservations
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_owner = true
    )
  );

CREATE POLICY "reservations_update" ON public.shop_reservations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_owner = true
    )
  );

CREATE POLICY "reservations_delete" ON public.shop_reservations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_owner = true
    )
  );
