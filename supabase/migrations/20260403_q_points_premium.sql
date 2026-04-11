-- ─────────────────────────────────────────────
-- QUEST — Q Points v2
-- • post_created: 10 pts, max 5/day
-- • shipment_confirmed: 10 pts
-- • followed_someone / got_a_follower: removed
-- • premium users: all earnings ×2
-- ─────────────────────────────────────────────

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

  -- Daily cap per reason
  v_daily_limit := CASE p_reason
    WHEN 'post_created' THEN 5   -- max 5 posts rewarded/day
    WHEN 'match_won'    THEN 5   -- max 5 wins rewarded/day
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
