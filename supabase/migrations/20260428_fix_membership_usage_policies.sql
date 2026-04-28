-- ─────────────────────────────────────────────
-- QUEST — Fix multiple permissive SELECT policies on membership_usage
--
-- Problem:
--   member_read_own  FOR SELECT USING (auth.uid() = user_id)
--   staff_all        FOR ALL   USING (is_staff check)   ← includes SELECT
--
-- Both fire on every SELECT query. Fix: merge into one SELECT policy with OR,
-- keep staff write access as a separate INSERT policy.
-- ─────────────────────────────────────────────

-- Drop both existing policies
DROP POLICY IF EXISTS "member_read_own" ON public.membership_usage;
DROP POLICY IF EXISTS "staff_all"       ON public.membership_usage;

-- Single SELECT policy: own row OR staff/admin/owner
CREATE POLICY "membership_usage_select" ON public.membership_usage
  FOR SELECT USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND (role IN ('staff','admin') OR is_owner = true)
    )
  );

-- Staff INSERT (logging a benefit consumption)
CREATE POLICY "membership_usage_insert" ON public.membership_usage
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND (role IN ('staff','admin') OR is_owner = true)
    )
  );

-- Staff DELETE (corrections)
CREATE POLICY "membership_usage_delete" ON public.membership_usage
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND (role IN ('staff','admin') OR is_owner = true)
    )
  );
