-- ─────────────────────────────────────────────
-- QUEST — Fix recalc_fecha_points: sync tier from league_participants first
--
-- Bug: league_fecha_results.tier was saved as 'A' (default fallback) for
-- players whose tier wasn't set in league_participants. The window function
-- PARTITION BY tier then misidentified them, giving wrong tier bonuses.
--
-- Fix: Step 1 of the function now overwrites the stored tier with the
-- authoritative value from league_participants before calculating points.
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recalc_fecha_points(p_fecha_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Step 1: Correct any tier mismatches against the authoritative source
  UPDATE public.league_fecha_results r
  SET tier = lp.tier
  FROM public.league_participants lp
  WHERE r.fecha_id    = p_fecha_id
    AND r.user_id     IS NOT NULL
    AND lp.user_id    = r.user_id
    AND lp.league_id  = r.league_id
    AND lp.tier       IS NOT NULL
    AND r.tier IS DISTINCT FROM lp.tier;

  -- Step 2: Recalculate points using corrected tiers
  UPDATE public.league_fecha_results AS r
  SET points = sub.new_points
  FROM (
    SELECT
      id,
      -- Win bonus: +1 for any tier when position = 1
      (CASE WHEN position = 1 THEN 1 ELSE 0 END)

      -- Top-3-within-tier: +1 for the 3 highest-finishing players of each tier
      + (CASE
           WHEN RANK() OVER (PARTITION BY tier ORDER BY position ASC) <= 3
           THEN 1 ELSE 0
         END)

      -- Tier B placement: +1 for reaching top 4 overall
      + (CASE WHEN tier = 'B' AND position <= 4 THEN 1 ELSE 0 END)

      -- Tier C placement: +1 for reaching top 8 overall
      + (CASE WHEN tier = 'C' AND position <= 8 THEN 1 ELSE 0 END)

    AS new_points
    FROM public.league_fecha_results
    WHERE fecha_id = p_fecha_id
  ) sub
  WHERE r.id = sub.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_fecha_points(uuid) TO authenticated;
