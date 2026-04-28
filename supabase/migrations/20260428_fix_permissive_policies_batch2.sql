-- ─────────────────────────────────────────────
-- QUEST — Fix multiple permissive policies (batch 2)
-- Tables: packages, posts, profiles
-- ─────────────────────────────────────────────

-- ══ packages ═══════════════════════════════════════════════════════════════════

-- SELECT: "Users can view own packages" and packages_select are identical in
-- effect (sender OR recipient OR staff). Drop the older dashboard-created one.
DROP POLICY IF EXISTS "Users can view own packages" ON public.packages;

-- INSERT: "Authenticated users can create packages" and "Users can insert own
-- packages" have identical WITH CHECK (sender_id = auth.uid()). Drop one.
DROP POLICY IF EXISTS "Authenticated users can create packages" ON public.packages;

-- UPDATE: 3 policies → 1
--   "Staff can update package status"  USING (EXISTS staff role check)
--   "Users can update own packages"    USING (auth.uid() = sender_id)
--   packages_update                    USING (is_staff())
DROP POLICY IF EXISTS "Staff can update package status" ON public.packages;
DROP POLICY IF EXISTS "Users can update own packages"  ON public.packages;
DROP POLICY IF EXISTS "packages_update"                ON public.packages;

CREATE POLICY "packages_update" ON public.packages
  FOR UPDATE USING (
    (SELECT auth.uid()) = sender_id
    OR is_staff()
  );

-- DELETE: 2 policies → 1
--   "staff can delete any"          USING (EXISTS staff role check)
--   "user can delete own delivered" USING (auth.uid() = sender_id OR recipient_id)
DROP POLICY IF EXISTS "staff can delete any"          ON public.packages;
DROP POLICY IF EXISTS "user can delete own delivered" ON public.packages;

CREATE POLICY "packages_delete" ON public.packages
  FOR DELETE USING (
    (SELECT auth.uid()) = sender_id
    OR (SELECT auth.uid()) = recipient_id
    OR is_staff()
  );

-- ══ posts ══════════════════════════════════════════════════════════════════════

-- DELETE: 2 policies → 1
--   "Users or admin can delete posts"  USING (auth.uid() = user_id OR EXISTS admin/staff)
--   posts_delete                       USING (auth.uid() = user_id)
-- "Users or admin can delete posts" is a strict superset — merge into posts_delete.
DROP POLICY IF EXISTS "Users or admin can delete posts" ON public.posts;
DROP POLICY IF EXISTS "posts_delete"                    ON public.posts;

CREATE POLICY "posts_delete" ON public.posts
  FOR DELETE USING (
    (SELECT auth.uid()) = user_id
    OR is_staff()
  );

-- ══ profiles ═══════════════════════════════════════════════════════════════════

-- UPDATE: 2 policies → 1
--   "Admins can update user roles"  USING/WITH CHECK (EXISTS admin/staff check)
--   profiles_update_own             USING/WITH CHECK (auth.uid() = id)
DROP POLICY IF EXISTS "Admins can update user roles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"          ON public.profiles;

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY['admin'::user_role, 'staff'::user_role])
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY['admin'::user_role, 'staff'::user_role])
    )
  );
