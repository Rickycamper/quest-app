-- ─────────────────────────────────────────────────────────────────────────────
-- QUEST — Fix award_points not running on post creation
--
-- Root cause: award_points() was created without GRANT EXECUTE to the
-- `authenticated` role, so supabase.rpc('award_points', …) returned
-- "permission denied" for every user — silently, because the JS call-site
-- swallowed all errors with .then(() => {}).catch(() => {}).
--
-- This migration:
--   1. Re-applies the latest award_points function body (with daily caps +
--      premium ×2 multiplier) using CREATE OR REPLACE, so it is idempotent.
--   2. Grants EXECUTE on the function to the roles that need it.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Re-apply function (idempotent, preserves SECURITY DEFINER ownership)
CREATE OR REPLACE FUNCTION public.award_points(
  p_user_id uuid,
  p_amount   integer,
  p_reason   text
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_daily_limit integer;
  v_today_count integer;
  v_role        text;
  v_final       integer;
BEGIN
  IF p_amount = 0 THEN RETURN; END IF;

  -- Daily cap per reason (counts today's entries in q_points_log)
  v_daily_limit := CASE p_reason
    WHEN 'post_created' THEN 5   -- max 5 posts rewarded per day
    WHEN 'match_won'    THEN 5   -- max 5 match wins rewarded per day
    ELSE NULL
  END;

  IF v_daily_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_today_count
    FROM q_points_log
    WHERE user_id   = p_user_id
      AND reason    = p_reason
      AND created_at >= date_trunc('day', now());

    IF v_today_count >= v_daily_limit THEN RETURN; END IF;
  END IF;

  -- Premium multiplier ×2
  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
  v_final := CASE WHEN v_role = 'premium' THEN p_amount * 2 ELSE p_amount END;

  UPDATE profiles SET q_points = q_points + v_final WHERE id = p_user_id;
  INSERT INTO q_points_log (user_id, amount, reason)
  VALUES (p_user_id, v_final, p_reason);
END;
$$;

-- 2. Grant execute so Supabase RPC calls succeed for logged-in users
GRANT EXECUTE ON FUNCTION public.award_points(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_points(uuid, integer, text) TO service_role;
