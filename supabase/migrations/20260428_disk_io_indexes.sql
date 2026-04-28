-- ─────────────────────────────────────────────
-- QUEST — Reduce Disk IO (Nano instance budget)
--
-- Root cause: two pg_cron jobs fire every hour doing DELETE with no
-- supporting indexes → full sequential scans 48×/day.
-- Also: tcg_articles DELETE and notifications/q_points_log grow unbounded.
--
-- Fixes:
-- 1. Indexes on auctions + tournaments for hourly cron DELETEs
-- 2. Index on tcg_articles(created_at) for fetch-articles edge function
-- 3. Index on notifications(created_at) + daily cleanup cron
-- 4. Index on q_points_log(created_at) + monthly cleanup cron
-- 5. Slow down the auctions cron from hourly → every 6 hours (no UX impact,
--    72-hour window means it can wait without users noticing stale data)
-- ─────────────────────────────────────────────

-- ── 1. Auctions: index for hourly cron DELETE ─────────────────────────────────
-- Query: WHERE status IN ('ended','cancelled')
--        AND (start_time + duration_seconds * interval) < now()
CREATE INDEX IF NOT EXISTS idx_auctions_status_start
  ON public.auctions (status, start_time)
  WHERE status IN ('ended', 'cancelled');

-- ── 2. Tournaments: index for hourly cron DELETE ──────────────────────────────
-- Query: WHERE (date::timestamptz + interval '72 hours') < now()
CREATE INDEX IF NOT EXISTS idx_tournaments_date
  ON public.tournaments (date);

-- ── 3. tcg_articles: index for fetch-articles DELETE ─────────────────────────
-- Edge function: DELETE WHERE created_at < (now() - 48h)
CREATE INDEX IF NOT EXISTS idx_tcg_articles_created_at
  ON public.tcg_articles (created_at);

-- ── 4. Notifications: index + daily cleanup ───────────────────────────────────
-- Notifications grow unboundedly — old ones are never read anyway.
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications (created_at);

SELECT cron.unschedule('delete-old-notifications')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-old-notifications');

SELECT cron.schedule(
  'delete-old-notifications',
  '20 3 * * *',   -- daily at 3:20 AM UTC, staggered from messages cron
  $$
    DELETE FROM public.notifications
    WHERE created_at < now() - INTERVAL '60 days';
  $$
);

-- ── 5. q_points_log: index + monthly cleanup ─────────────────────────────────
-- Log rows older than 6 months are never surfaced in the UI.
CREATE INDEX IF NOT EXISTS idx_q_points_log_created_at
  ON public.q_points_log (created_at);

SELECT cron.unschedule('delete-old-points-log')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-old-points-log');

SELECT cron.schedule(
  'delete-old-points-log',
  '0 4 1 * *',    -- 1st of every month at 4 AM UTC
  $$
    DELETE FROM public.q_points_log
    WHERE created_at < now() - INTERVAL '6 months';
  $$
);

-- ── 6. Slow down auctions cron: hourly → every 6 hours ───────────────────────
-- Auctions are cleaned 72h after ending — no UX difference between
-- checking every 1h vs every 6h. Saves 18 cron wake-ups/day.
SELECT cron.unschedule('delete-old-auctions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-old-auctions');

SELECT cron.schedule(
  'delete-old-auctions',
  '30 0,6,12,18 * * *',  -- 4×/day at 00:30, 06:30, 12:30, 18:30 UTC
  $$
    DELETE FROM public.auctions
    WHERE status IN ('ended', 'cancelled')
      AND (start_time + (duration_seconds || ' seconds')::interval + interval '72 hours') < now();
  $$
);

-- ── 7. Slow down tournaments cron: hourly → every 6 hours ────────────────────
SELECT cron.unschedule('delete-old-tournaments')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-old-tournaments');

SELECT cron.schedule(
  'delete-old-tournaments',
  '0 1,7,13,19 * * *',   -- 4×/day at 01:00, 07:00, 13:00, 19:00 UTC
  $$
    DELETE FROM public.tournaments
    WHERE (date::timestamptz + interval '72 hours') < now();
  $$
);
