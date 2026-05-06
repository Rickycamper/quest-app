-- ─────────────────────────────────────────────
-- QUEST — Allow staff to insert ranking claims for any user
--
-- Previously only players could insert their own claim (user_id = auth.uid()).
-- Staff/owner need to award points to other players directly.
-- ─────────────────────────────────────────────

-- Staff / owner can insert a claim for any user (pre-approved, no tournament needed)
CREATE POLICY "ranking_claims_staff_insert" ON public.ranking_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND (is_owner OR role IN ('admin', 'staff'))
    )
  );

-- Staff can also update any claim (approve/reject)
-- (This might already exist, using DROP IF EXISTS to be safe)
DROP POLICY IF EXISTS "ranking_claims_staff_update" ON public.ranking_claims;
CREATE POLICY "ranking_claims_staff_update" ON public.ranking_claims
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND (is_owner OR role IN ('admin', 'staff'))
    )
  );
