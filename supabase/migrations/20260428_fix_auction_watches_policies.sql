-- ─────────────────────────────────────────────
-- QUEST — Fix multiple permissive policies on public.auction_watches
--
-- Problem: auction_watches_all (FOR ALL) and auction_watches_read_all
-- (FOR SELECT USING true) both match SELECT for anon/authenticated.
-- PostgreSQL evaluates every permissive policy per row and ORs the
-- results — pure overhead since auction_watches_read_all already wins.
--
-- Fix: drop the FOR ALL policy, replace with explicit INSERT/UPDATE/DELETE
-- policies scoped to the row owner. The SELECT stays covered by the
-- existing auction_watches_read_all (USING true).
-- ─────────────────────────────────────────────

-- 1. Drop the broad FOR ALL policy (was causing the duplicate SELECT)
DROP POLICY IF EXISTS "auction_watches_all" ON public.auction_watches;

-- 2. INSERT — only the authenticated owner can watch an auction
CREATE POLICY "auction_watches_insert" ON public.auction_watches
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3. UPDATE — owner only
CREATE POLICY "auction_watches_update" ON public.auction_watches
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- 4. DELETE — owner only
CREATE POLICY "auction_watches_delete" ON public.auction_watches
  FOR DELETE USING ((SELECT auth.uid()) = user_id);
