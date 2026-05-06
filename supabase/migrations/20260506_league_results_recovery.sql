-- ─────────────────────────────────────────────
-- QUEST — League results recovery
--
-- Safe to run even if tables already exist.
-- Creates league_fecha_results + its trigger if missing.
-- Also ensures RLS policies + grants from v2 are applied.
-- Run this if you see "table not found" errors on league_fecha_results.
-- ─────────────────────────────────────────────

-- ── set_updated_at helper (safe to re-create) ─
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Points calculation function ───────────────
CREATE OR REPLACE FUNCTION public.calc_league_points(p_tier text, p_position integer)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_pts integer := 0;
BEGIN
  IF p_position <= 3 THEN v_pts := v_pts + 1; END IF;
  IF p_position = 1  THEN v_pts := v_pts + 1; END IF;
  IF p_tier = 'B' AND p_position <= 4 THEN v_pts := v_pts + 1; END IF;
  IF p_tier = 'C' AND p_position <= 8 THEN v_pts := v_pts + 1; END IF;
  RETURN v_pts;
END;
$$;

-- ── Trigger function ──────────────────────────
CREATE OR REPLACE FUNCTION public.set_league_result_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.points := public.calc_league_points(NEW.tier, NEW.position);
  RETURN NEW;
END;
$$;

-- ── Results table (safe to create if not exists) ─
CREATE TABLE IF NOT EXISTS public.league_fecha_results (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha_id    uuid        NOT NULL REFERENCES public.league_fechas(id) ON DELETE CASCADE,
  league_id   uuid        NOT NULL REFERENCES public.leagues(id)       ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  tier        text        NOT NULL CHECK (tier IN ('A','B','C')),
  position    integer     NOT NULL CHECK (position > 0),
  points      integer     NOT NULL DEFAULT 0,
  recorded_by uuid        REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (fecha_id, user_id)
);

-- ── Re-attach trigger (DROP IF EXISTS first to avoid duplicate) ─
DROP TRIGGER IF EXISTS league_fecha_results_calc_points ON public.league_fecha_results;
CREATE TRIGGER league_fecha_results_calc_points
  BEFORE INSERT OR UPDATE OF tier, position
  ON public.league_fecha_results
  FOR EACH ROW EXECUTE FUNCTION public.set_league_result_points();

-- ── RLS ───────────────────────────────────────
ALTER TABLE public.league_fecha_results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before re-creating (safe)
DROP POLICY IF EXISTS "league_fresults_select"      ON public.league_fecha_results;
DROP POLICY IF EXISTS "league_fresults_write"       ON public.league_fecha_results;
DROP POLICY IF EXISTS "lfr_self_insert"             ON public.league_fecha_results;
DROP POLICY IF EXISTS "lfr_self_update"             ON public.league_fecha_results;

CREATE POLICY "league_fresults_select" ON public.league_fecha_results FOR SELECT USING (true);
CREATE POLICY "league_fresults_write"  ON public.league_fecha_results FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_owner OR role IN ('admin','staff')))
);
CREATE POLICY "lfr_self_insert" ON public.league_fecha_results FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "lfr_self_update" ON public.league_fecha_results FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- ── Grants ────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.calc_league_points(text, integer) TO authenticated;

-- ── Indexes (IF NOT EXISTS safe) ─────────────
CREATE INDEX IF NOT EXISTS idx_league_fresults_fecha   ON public.league_fecha_results (fecha_id);
CREATE INDEX IF NOT EXISTS idx_league_fresults_league  ON public.league_fecha_results (league_id);
CREATE INDEX IF NOT EXISTS idx_league_fresults_user    ON public.league_fecha_results (user_id);
