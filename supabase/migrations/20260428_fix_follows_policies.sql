-- ─────────────────────────────────────────────
-- QUEST — Fix multiple permissive policies on public.follows
--
-- "Anyone can read follows"         FOR SELECT USING (true)
-- "Users can manage their own follows" FOR ALL USING (auth.uid() = follower_id)
--
-- FOR ALL causes a duplicate permissive SELECT alongside the read-all policy.
-- Fix: drop FOR ALL, replace with explicit INSERT/UPDATE/DELETE owner policies.
-- SELECT stays covered by "Anyone can read follows".
-- ─────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can manage their own follows" ON public.follows;

CREATE POLICY "follows_insert" ON public.follows
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = follower_id);

CREATE POLICY "follows_update" ON public.follows
  FOR UPDATE USING ((SELECT auth.uid()) = follower_id);

CREATE POLICY "follows_delete" ON public.follows
  FOR DELETE USING ((SELECT auth.uid()) = follower_id);
