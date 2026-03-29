-- ── FEED INDEXES ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_tag        ON posts(tag) WHERE tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_user_id    ON posts(user_id);

-- ── LIKES / COMMENTS INDEXES ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id      ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_post     ON post_likes(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id   ON post_comments(post_id);

-- ── RANKING INDEXES ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ranking_claims_game_status   ON ranking_claims(game, status);
CREATE INDEX IF NOT EXISTS idx_ranking_claims_user_status   ON ranking_claims(user_id, status);
CREATE INDEX IF NOT EXISTS idx_profiles_points_desc         ON profiles(points DESC) WHERE points > 0;
CREATE INDEX IF NOT EXISTS idx_profiles_branch              ON profiles(branch) WHERE branch IS NOT NULL;

-- ── NOTIFICATIONS INDEX ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON notifications(user_id);

-- ── TOURNAMENTS INDEX ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_user       ON tournament_participants(user_id);

-- ── LEADERBOARD RPC ────────────────────────────────────────
-- Single SQL query replaces two client-side roundtrips.
-- Returns per-game leaderboard (approved claims only), optionally filtered by branch.
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
    AND (p_branch IS NULL OR rc.branch = p_branch)
  GROUP BY pr.id, pr.username, pr.avatar_url, pr.branch, pr.verified, pr.role, pr.is_owner
  ORDER BY points DESC
  LIMIT 50;
END;
$$;
