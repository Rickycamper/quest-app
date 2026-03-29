-- Fix: leaderboard branch filter was using the user's profile branch (pr.branch)
-- instead of the tournament/claim branch (rc.branch).
-- A player from Branch A who plays in Branch B should count toward Branch B's ranking.

CREATE OR REPLACE FUNCTION get_game_leaderboard(p_game text, p_branch text DEFAULT NULL)
RETURNS TABLE (
  id         uuid,
  username   text,
  avatar_url text,
  branch     text,
  verified   boolean,
  role       text,
  is_owner   boolean,
  points     bigint
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
    )::bigint AS points
  FROM ranking_claims rc
  JOIN profiles pr ON pr.id = rc.user_id
  WHERE rc.status = 'approved'
    AND rc.game   = p_game
    AND (p_branch IS NULL OR rc.branch = p_branch)   -- was: pr.branch (user's home branch)
  GROUP BY pr.id, pr.username, pr.avatar_url, pr.branch, pr.verified, pr.role, pr.is_owner
  ORDER BY points DESC
  LIMIT 50;
END;
$$;

-- Re-create the index on ranking_claims.branch for the new filter path
CREATE INDEX IF NOT EXISTS idx_ranking_claims_branch ON ranking_claims(branch) WHERE branch IS NOT NULL;
