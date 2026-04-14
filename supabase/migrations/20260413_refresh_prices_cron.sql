-- ─────────────────────────────────────────────
-- QUEST — Price refresh cron jobs
-- ─────────────────────────────────────────────
-- MTG + Pokemon: daily at 1 PM Panama (18:00 UTC) — free APIs, no limit
-- One Piece:     every 3 days at 1 PM Panama     — JustTCG (1000 req/month), in-stock only
-- ─────────────────────────────────────────────

-- Remove old job if exists
SELECT cron.unschedule('refresh-tcg-prices-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-tcg-prices-daily'
);

-- Job 1: MTG + Pokemon — every day at 18:00 UTC
SELECT cron.schedule(
  'refresh-prices-mtg-pokemon',
  '0 18 * * *',
  format($$
    SELECT net.http_post(
      url     := %L,
      headers := %L::jsonb,
      body    := '{}'::jsonb
    );
  $$,
    'https://qattyrdmlbolocnzczos.supabase.co/functions/v1/refresh-prices?mode=mtgpokemon',
    '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdHR5cmRtbGJvbG9jbnpjem9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNzIxMTQsImV4cCI6MjA4ODg0ODExNH0.nSkj0_GmictGVwR8RQ2yE-E-EqiYxr182gp6bT4sToc"}'
  )
);

-- Job 2: One Piece, Digimon, Gundam, Riftbound — 1st and 15th of each month at 18:00 UTC
-- Only in-stock cards with a fixed price (ask-price cards skipped automatically via price > 0)
SELECT cron.schedule(
  'refresh-prices-justtcg',
  '0 18 1,15 * *',
  format($$
    SELECT net.http_post(
      url     := %L,
      headers := %L::jsonb,
      body    := '{}'::jsonb
    );
  $$,
    'https://qattyrdmlbolocnzczos.supabase.co/functions/v1/refresh-prices?mode=justtcg',
    '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdHR5cmRtbGJvbG9jbnpjem9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNzIxMTQsImV4cCI6MjA4ODg0ODExNH0.nSkj0_GmictGVwR8RQ2yE-E-EqiYxr182gp6bT4sToc"}'
  )
);
