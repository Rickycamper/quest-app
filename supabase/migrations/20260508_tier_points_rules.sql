-- ─────────────────────────────────────────────
-- QUEST — Tier-based league points (cross-row)
--
-- New rules (replace old per-row trigger):
--
--   ALL tiers
--     +1 pt  → win (position = 1)
--     +1 pt  → top 3 within your tier in this fecha
--
--   Tier B extra
--     +1 pt  → finish top 4 overall in this fecha
--
--   Tier C extra
--     +1 pt  → finish top 8 overall in this fecha
--
-- Max per fecha:
--   Tier A winner who is also top-3-A → 2 pts
--   Tier B winner who is top-3-B and top-4  → 3 pts
--   Tier C winner who is top-3-C and top-8  → 3 pts
-- ─────────────────────────────────────────────

-- 1. Remove the old per-row trigger (wrong formula, can't do cross-row)
DROP TRIGGER IF EXISTS league_fecha_results_calc_points ON public.league_fecha_results;
DROP FUNCTION IF EXISTS public.set_league_result_points();
DROP FUNCTION IF EXISTS public.calc_league_points(text, integer);

-- 2. New cross-row recalculation function
--    Called by staff after all positions for a fecha are saved.
CREATE OR REPLACE FUNCTION public.recalc_fecha_points(p_fecha_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.league_fecha_results AS r
  SET points = sub.new_points
  FROM (
    SELECT
      id,
      -- Win bonus: +1 for any tier if position = 1
      (CASE WHEN position = 1 THEN 1 ELSE 0 END)

      -- Top-3-within-tier bonus: +1 if you are among the 3 best
      -- players of your tier in this fecha (by finishing position)
      + (CASE
           WHEN RANK() OVER (PARTITION BY tier ORDER BY position ASC) <= 3
           THEN 1 ELSE 0
         END)

      -- Tier B placement bonus: +1 for finishing top 4 overall
      + (CASE WHEN tier = 'B' AND position <= 4 THEN 1 ELSE 0 END)

      -- Tier C placement bonus: +1 for finishing top 8 overall
      + (CASE WHEN tier = 'C' AND position <= 8 THEN 1 ELSE 0 END)

    AS new_points
    FROM public.league_fecha_results
    WHERE fecha_id = p_fecha_id
  ) sub
  WHERE r.id = sub.id;
END;
$$;

-- 3. Grant to authenticated so the frontend RPC call works
GRANT EXECUTE ON FUNCTION public.recalc_fecha_points(uuid) TO authenticated;
