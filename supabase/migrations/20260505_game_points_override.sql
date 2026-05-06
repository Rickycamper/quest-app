-- ─────────────────────────────────────────────
-- QUEST — Game points override (staff manual edit)
-- Lets staff set exact per-game points for a user
-- without touching ranking_claims history.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ranking_points_override (
  user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game     text NOT NULL,
  branch   text NOT NULL DEFAULT '',   -- '' means global/no branch
  points   integer NOT NULL DEFAULT 0,
  set_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  set_at   timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, game, branch)
);

ALTER TABLE public.ranking_points_override ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rpo_select" ON public.ranking_points_override FOR SELECT USING (true);
CREATE POLICY "rpo_write"  ON public.ranking_points_override FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_owner OR role IN ('admin','staff')))
);

-- Update get_game_leaderboard to UNION with the override table.
-- Override rows appear in the result with the manually-set points value.
-- If both a claim row AND an override row exist for the same user, the override wins.
CREATE OR REPLACE FUNCTION public.get_game_leaderboard(p_game text, p_branch text DEFAULT NULL)
RETURNS TABLE (
  id            uuid,
  username      text,
  avatar_url    text,
  branch        text,
  verified      boolean,
  role          text,
  is_owner      boolean,
  points        bigint,
  season_badges text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claim_pts AS (
    SELECT
      rc.user_id,
      SUM(
        CASE rc.position
          WHEN 1 THEN 3
          WHEN 2 THEN 2
          WHEN 3 THEN 1
          ELSE 1
        END
      )::bigint AS pts
    FROM ranking_claims rc
    WHERE rc.status = 'approved'
      AND rc.game = p_game
      AND (p_branch IS NULL OR rc.branch = p_branch)
    GROUP BY rc.user_id
  ),
  override_pts AS (
    SELECT
      rpo.user_id,
      rpo.points::bigint AS pts
    FROM ranking_points_override rpo
    WHERE rpo.game = p_game
      AND rpo.branch = COALESCE(p_branch, '')
  ),
  -- Override takes precedence over claim sum when both exist
  combined AS (
    SELECT user_id, pts FROM override_pts
    UNION ALL
    SELECT c.user_id, c.pts FROM claim_pts c
    WHERE NOT EXISTS (SELECT 1 FROM override_pts o WHERE o.user_id = c.user_id)
  )
  SELECT
    pr.id,
    pr.username,
    pr.avatar_url,
    pr.branch,
    pr.verified,
    pr.role,
    pr.is_owner,
    cm.pts AS points,
    COALESCE(pr.season_badges, '{}')::text[] AS season_badges
  FROM combined cm
  JOIN profiles pr ON pr.id = cm.user_id
  WHERE cm.pts > 0
  ORDER BY cm.pts DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_game_leaderboard(text, text) TO anon, authenticated;
