-- ─────────────────────────────────────────────
-- QUEST — Address Supabase database linter warnings
-- 1) function_search_path_mutable
-- 2) anon_security_definer_function_executable
-- 3) authenticated_security_definer_function_executable (triggers / internals only)
-- + Internal staff guards on admin-only SECURITY DEFINER RPCs so signed-in users
--   cannot bypass RLS by calling them directly.
-- All blocks are wrapped in DO ... EXCEPTION so the migration is idempotent
-- and tolerant of any function not existing on this DB.
-- ─────────────────────────────────────────────

-- ── 1. Pin search_path on functions still flagged ─────────────────────────────
DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.approve_redemption(uuid) SET search_path = public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.reject_redemption(uuid)  SET search_path = public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.reject_redemption(uuid, text) SET search_path = public';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- ── 2. Revoke EXECUTE from anon on every flagged function ─────────────────────
DO $$
DECLARE
  fns text[] := ARRAY[
    'public.adjust_user_points(uuid, integer)',
    'public.append_season_badge(uuid, text)',
    'public.approve_redemption(uuid)',
    'public.award_points(uuid, integer, text)',
    'public.create_notification(uuid, text, text, text, jsonb)',
    'public.create_package_as_user(text, text, uuid, text, text)',
    'public.end_auction(uuid)',
    'public.get_game_leaderboard(text, text)',
    'public.handle_new_user()',
    'public.is_staff()',
    'public.log_package_event()',
    'public.membership_usage_summary(uuid)',
    'public.notify_auction_watchers(uuid)',
    'public.place_bid(uuid, numeric)',
    'public.reject_redemption(uuid)',
    'public.reject_redemption(uuid, text)',
    'public.respond_to_match(uuid, boolean)',
    'public.set_user_points(uuid, integer)',
    'public.sync_ranking_entry()'
  ];
  fn text;
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, public', fn);
    EXCEPTION
      WHEN undefined_function THEN NULL;
      WHEN undefined_object   THEN NULL;
    END;
  END LOOP;
END $$;

-- ── 3. Revoke authenticated EXECUTE on triggers / internal helpers ────────────
-- These should never be called as RPC; they run from triggers, RLS, or service role.
DO $$
DECLARE
  fns text[] := ARRAY[
    'public.handle_new_user()',
    'public.log_package_event()',
    'public.sync_ranking_entry()',
    'public.is_staff()',
    'public.append_season_badge(uuid, text)'
  ];
  fn text;
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn);
    EXCEPTION
      WHEN undefined_function THEN NULL;
      WHEN undefined_object   THEN NULL;
    END;
  END LOOP;
END $$;

-- ── 4. Internal staff guard on admin-only RPCs ────────────────────────────────
-- Even though authenticated keeps EXECUTE (the app calls these from the admin UI),
-- the function refuses to run for non-staff. This prevents privilege escalation
-- via direct REST calls to /rpc/<fn>.

-- DROP first so we can change parameter name from p_redemption_id (legacy) to p_id
-- (matches the app). DROP IF EXISTS is a no-op if the function isn't present.
DROP FUNCTION IF EXISTS public.approve_redemption(uuid);
CREATE FUNCTION public.approve_redemption(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (role IN ('admin','staff','owner') OR COALESCE(is_owner, false))
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE q_redemptions
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_id AND status = 'pending';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_redemption(uuid) FROM anon, public;

DROP FUNCTION IF EXISTS public.reject_redemption(uuid);
DROP FUNCTION IF EXISTS public.reject_redemption(uuid, text);
CREATE FUNCTION public.reject_redemption(p_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_r public.q_redemptions;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (role IN ('admin','staff','owner') OR COALESCE(is_owner, false))
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_r FROM q_redemptions WHERE id = p_id AND status = 'pending';
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE q_redemptions
  SET status = 'rejected', admin_note = p_note,
      reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_id;

  -- Refund
  UPDATE profiles SET q_points = q_points + v_r.points WHERE id = v_r.user_id;
  INSERT INTO q_points_log (user_id, amount, reason)
  VALUES (v_r.user_id, v_r.points, 'Reembolso — canje rechazado');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reject_redemption(uuid, text) FROM anon, public;

-- adjust_user_points / set_user_points: admin/owner only
CREATE OR REPLACE FUNCTION public.adjust_user_points(target_id uuid, delta integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (role IN ('admin','owner') OR COALESCE(is_owner, false))
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF delta = 0 THEN RETURN; END IF;
  UPDATE profiles SET q_points = GREATEST(0, q_points + delta) WHERE id = target_id;
  INSERT INTO q_points_log (user_id, amount, reason)
  VALUES (target_id, delta, 'Ajuste manual');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_points(target_id uuid, pts integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_curr integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (role IN ('admin','owner') OR COALESCE(is_owner, false))
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF pts < 0 THEN RAISE EXCEPTION 'pts must be >= 0'; END IF;
  SELECT q_points INTO v_curr FROM profiles WHERE id = target_id;
  UPDATE profiles SET q_points = pts WHERE id = target_id;
  INSERT INTO q_points_log (user_id, amount, reason)
  VALUES (target_id, pts - COALESCE(v_curr, 0), 'Ajuste manual (set)');
END;
$$;

-- end_auction and notify_auction_watchers are intentionally callable by any
-- authenticated user — they're triggered client-side from LiveAuctionScreen
-- when the timer expires / auction goes live. Both are idempotent and only
-- act based on auction state (start_time, duration, notified_watchers flag),
-- so they don't accept untrusted input beyond auction_id. The linter warning
-- is acknowledged as intentional.

-- create_notification is intentionally callable by all authenticated users —
-- it powers like/comment/follow/match notifications that target *other* users,
-- so we cannot restrict to self-only without breaking the social graph.
-- A future migration should add a rate limit (e.g. N notifications/min/user)
-- to close the spam vector.
