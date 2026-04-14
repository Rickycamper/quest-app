-- ─────────────────────────────────────────────
-- QUEST — Daily price refresh cron job
-- Runs at 1:00 PM Panama time (UTC-5) = 18:00 UTC
-- Calls the refresh-prices Edge Function
-- ─────────────────────────────────────────────

-- Enable pg_cron and pg_net extensions (if not already enabled)
-- These must be enabled in Supabase Dashboard → Extensions first

SELECT cron.schedule(
  'refresh-tcg-prices-daily',         -- job name
  '0 18 * * *',                        -- every day at 18:00 UTC (1 PM Panama)
  $$
  SELECT net.http_post(
    url     := (SELECT value FROM vault.secrets WHERE name = 'supabase_url') || '/functions/v1/refresh-prices',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'supabase_anon_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);
