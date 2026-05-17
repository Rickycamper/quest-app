-- ─────────────────────────────────────────────
-- QUEST — Guest support in league_fecha_results
--
-- Previously only registered users (user_id NOT NULL) could have results.
-- Guests were excluded → tier rankings were computed only among registered
-- users, causing incorrect top-3-within-tier bonuses.
--
-- Fix: add participant_id (FK to league_participants) as the primary
-- identity key. user_id becomes nullable. All 24 players get results
-- saved; guests get 0 pts; registered users get tier-based pts.
-- ─────────────────────────────────────────────

-- 1. Make user_id optional
ALTER TABLE public.league_fecha_results
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add participant_id (FK to league_participants row)
ALTER TABLE public.league_fecha_results
  ADD COLUMN IF NOT EXISTS participant_id uuid
    REFERENCES public.league_participants(id) ON DELETE CASCADE;

-- 3. Enforce at least one identity
ALTER TABLE public.league_fecha_results
  DROP CONSTRAINT IF EXISTS lfr_has_identity;
ALTER TABLE public.league_fecha_results
  ADD CONSTRAINT lfr_has_identity CHECK (
    user_id IS NOT NULL OR participant_id IS NOT NULL
  );

-- 4. Replace UNIQUE(fecha_id, user_id) with participant-based index
ALTER TABLE public.league_fecha_results
  DROP CONSTRAINT IF EXISTS league_fecha_results_fecha_id_user_id_key;

DROP INDEX IF EXISTS idx_lfr_participant;
DROP INDEX IF EXISTS idx_lfr_user_safety;

-- One result per participant per fecha (covers both registered & guests)
CREATE UNIQUE INDEX idx_lfr_participant
  ON public.league_fecha_results (fecha_id, participant_id)
  WHERE participant_id IS NOT NULL;

-- Safety: prevent same registered user appearing twice
CREATE UNIQUE INDEX idx_lfr_user_safety
  ON public.league_fecha_results (fecha_id, user_id)
  WHERE user_id IS NOT NULL;

-- 5. Update recalc_fecha_points to include guests in tier ranking
--    (guests are in the partition → correct ranks; but get 0 pts)
CREATE OR REPLACE FUNCTION public.recalc_fecha_points(p_fecha_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sync tier from league_participants (authoritative source)
  UPDATE public.league_fecha_results r
  SET tier = lp.tier
  FROM public.league_participants lp
  WHERE r.fecha_id = p_fecha_id
    AND lp.tier IS NOT NULL
    AND (
      (r.user_id IS NOT NULL AND lp.user_id = r.user_id AND lp.league_id = r.league_id)
      OR (r.participant_id IS NOT NULL AND lp.id = r.participant_id)
    )
    AND r.tier IS DISTINCT FROM lp.tier;

  -- Calculate points using ALL 24 positions for tier ranking
  -- Guests always get 0; registered users get tier-based points
  UPDATE public.league_fecha_results AS r
  SET points = sub.new_points
  FROM (
    SELECT
      id,
      user_id,
      CASE WHEN user_id IS NULL THEN 0
      ELSE
        -- Win bonus
        (CASE WHEN position = 1 THEN 1 ELSE 0 END)
        -- Top 3 within tier (ranked among ALL 24, including guests)
        + (CASE
             WHEN RANK() OVER (PARTITION BY tier ORDER BY position ASC) <= 3
             THEN 1 ELSE 0
           END)
        -- Tier B: +1 for top 4 overall
        + (CASE WHEN tier = 'B' AND position <= 4 THEN 1 ELSE 0 END)
        -- Tier C: +1 for top 8 overall
        + (CASE WHEN tier = 'C' AND position <= 8 THEN 1 ELSE 0 END)
      END AS new_points
    FROM public.league_fecha_results
    WHERE fecha_id = p_fecha_id
  ) sub
  WHERE r.id = sub.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_fecha_points(uuid) TO authenticated;
