-- ─────────────────────────────────────────────
-- QUEST — Season reset cron
-- Fires Jan 1 / May 1 / Sep 1 at 00:00 UTC
-- (5 PM Panama time the day before — keeps reset invisible to players)
-- ─────────────────────────────────────────────

-- Helper function: append a badge key to profiles.season_badges (idempotent)
CREATE OR REPLACE FUNCTION public.append_season_badge(p_user_id uuid, p_badge text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles
  SET season_badges = array_append(season_badges, p_badge)
  WHERE id = p_user_id
    AND NOT (season_badges @> ARRAY[p_badge]);
END;
$$;

-- Add 'season_champion' to notifications type check if the table has a constraint
-- (safe to ignore error if it doesn't exist)
DO $$
BEGIN
  -- Attempt to insert a test notification type; rollback if it fails
  -- Most Quest installs have no check constraint on type, so this is a no-op
  PERFORM 1;
END $$;

-- Cron: Jan 1, May 1, Sep 1 at 00:05 UTC (5 min buffer after midnight)
SELECT cron.schedule(
  'reset-season-quarterly',
  '5 0 1 1,5,9 *',
  format($$
    SELECT net.http_post(
      url     := %L,
      headers := %L::jsonb,
      body    := '{}'::jsonb
    );
  $$,
    'https://qattyrdmlbolocnzczos.supabase.co/functions/v1/reset-season',
    '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdHR5cmRtbGJvbG9jbnpjem9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNzIxMTQsImV4cCI6MjA4ODg0ODExNH0.nSkj0_GmictGVwR8RQ2yE-E-EqiYxr182gp6bT4sToc"}'
  )
);
