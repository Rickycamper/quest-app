-- ─────────────────────────────────────────────
-- QUEST — Add season_badges to leaderboard function
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_game_leaderboard(p_game text, p_branch text DEFAULT NULL)
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
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.username,
    pr.avatar_url,
    pr.branch,
    pr.verified,
    pr.role,
    pr.is_owner,
    SUM(
      CASE rc.position
        WHEN 1 THEN 3
        WHEN 2 THEN 2
        WHEN 3 THEN 1
        ELSE 1
      END
    )::bigint AS points,
    COALESCE(pr.season_badges, '{}')::text[] AS season_badges
  FROM ranking_claims rc
  JOIN profiles pr ON pr.id = rc.user_id
  WHERE rc.status = 'approved'
    AND rc.game   = p_game
    AND (p_branch IS NULL OR rc.branch = p_branch)
  GROUP BY pr.id, pr.username, pr.avatar_url, pr.branch, pr.verified, pr.role, pr.is_owner, pr.season_badges
  ORDER BY points DESC
  LIMIT 50;
END;
$$;
