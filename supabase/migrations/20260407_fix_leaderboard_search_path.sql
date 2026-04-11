-- Fix: get_game_leaderboard was missing SET search_path = public
-- (20260329_fix_leaderboard_branch.sql overwrote the secure version)

CREATE OR REPLACE FUNCTION public.get_game_leaderboard(p_game text, p_branch text DEFAULT NULL)
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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.username,
    pr.avatar_url,
    pr.branch::text,
    pr.verified,
    pr.role::text,
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
    AND (p_branch IS NULL OR rc.branch = p_branch)
  GROUP BY pr.id, pr.username, pr.avatar_url, pr.branch, pr.verified, pr.role, pr.is_owner
  ORDER BY points DESC
  LIMIT 50;
END;
$$;
