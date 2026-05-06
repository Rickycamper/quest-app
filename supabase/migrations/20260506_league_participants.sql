-- ─────────────────────────────────────────────
-- QUEST — League participants table
--
-- Adds:
--   league_participants  → individual enrollment (with tier + payment)
--   max_players column   → on leagues table
--   Self-reporting policies on league_fecha_results
--
-- Run AFTER 20260506_leagues_v2.sql
-- ─────────────────────────────────────────────

-- ── max_players on leagues ─────────────────────
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS max_players integer NOT NULL DEFAULT 0;

-- ── league_participants (enrollment) ──────────
-- Tracks who is enrolled in each league, their tier (A/B/C), and payment.
-- Tier is assigned by staff. Players can self-enroll (upcoming leagues only).
CREATE TABLE IF NOT EXISTS public.league_participants (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id  uuid        NOT NULL REFERENCES public.leagues(id)   ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  tier       text        CHECK (tier IN ('A','B','C')),  -- set by staff
  paid       boolean     NOT NULL DEFAULT false,
  joined_at  timestamptz DEFAULT now(),
  UNIQUE (league_id, user_id)
);

ALTER TABLE public.league_participants ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "lp_select" ON public.league_participants
  FOR SELECT USING (true);

-- Staff full control
CREATE POLICY "lp_staff" ON public.league_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND (is_owner OR role IN ('admin','staff'))
    )
  );

-- Players can self-enroll
CREATE POLICY "lp_self_insert" ON public.league_participants
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Players can unenroll themselves
CREATE POLICY "lp_self_delete" ON public.league_participants
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── Self-reporting on league_fecha_results ────
-- Players submit their own finishing position → points auto-calculated by trigger.
-- Tier is verified via league_participants.tier in the application layer.
CREATE POLICY "lfr_self_insert" ON public.league_fecha_results
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "lfr_self_update" ON public.league_fecha_results
  FOR UPDATE TO authenticated
  USING  (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── Indexes ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lp_league ON public.league_participants (league_id);
CREATE INDEX IF NOT EXISTS idx_lp_user   ON public.league_participants (user_id);
