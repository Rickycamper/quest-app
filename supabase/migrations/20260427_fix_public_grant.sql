-- ─────────────────────────────────────────────
-- QUEST — Fix PUBLIC pseudo-role EXECUTE grants
-- Root cause: previous migration revoked EXECUTE from the explicit 'anon'
-- and 'authenticated' roles, but every role in PostgreSQL inherits from the
-- 'PUBLIC' pseudo-role. The diagnostic query confirmed PUBLIC still held
-- EXECUTE on all functions in public schema — that's why linter warnings
-- persisted even after the per-role revokes.
-- ─────────────────────────────────────────────

-- ── 1. Revoke EXECUTE from PUBLIC (the source of the inherited grant) ─────────
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- ── 2. Re-grant EXECUTE to authenticated for user-facing RPCs ─────────────────
-- These are the SECURITY DEFINER functions the app legitimately calls via RPC.
-- Trigger-only / internal helpers (handle_new_user, log_package_event,
-- sync_ranking_entry, is_staff, append_season_badge) are intentionally excluded.
DO $$
DECLARE
  fns text[] := ARRAY[
    'public.place_bid(uuid, numeric)',
    'public.respond_to_match(uuid, boolean)',
    'public.end_auction(uuid)',
    'public.notify_auction_watchers(uuid)',
    'public.create_notification(uuid, text, text, text, jsonb)',
    'public.award_points(uuid, integer, text)',
    'public.create_package_as_user(text, text, uuid, text, text)',
    'public.get_game_leaderboard(text, text)',
    'public.membership_usage_summary(uuid)',
    'public.approve_redemption(uuid)',
    'public.reject_redemption(uuid, text)',
    'public.adjust_user_points(uuid, integer)',
    'public.set_user_points(uuid, integer)'
  ];
  fn text;
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    EXCEPTION
      WHEN undefined_function THEN NULL;
      WHEN undefined_object   THEN NULL;
    END;
  END LOOP;
END $$;

-- ── 3. Prevent future functions from auto-inheriting PUBLIC EXECUTE ───────────
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
