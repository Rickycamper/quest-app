-- ─────────────────────────────────────────────
-- QUEST — Q Points: updated values + daily limits
-- ─────────────────────────────────────────────

-- Update award_points with daily caps
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
BEGIN
  IF p_amount = 0 THEN RETURN; END IF;

  -- Daily limits per reason
  v_daily_limit := CASE p_reason
    WHEN 'post_created' THEN 5   -- max 5 posts rewarded/day
    WHEN 'match_won'    THEN 5   -- max 5 wins rewarded/day
    ELSE NULL                    -- unlimited
  END;

  IF v_daily_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_today_count
    FROM q_points_log
    WHERE user_id   = p_user_id
      AND reason    = p_reason
      AND created_at >= date_trunc('day', now());

    IF v_today_count >= v_daily_limit THEN RETURN; END IF;
  END IF;

  UPDATE profiles SET q_points = q_points + p_amount WHERE id = p_user_id;
  INSERT INTO q_points_log (user_id, amount, reason)
  VALUES (p_user_id, p_amount, p_reason);
END;
$$;
