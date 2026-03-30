-- Auto-delete tournaments 24 hours after their date passes
-- Uses pg_cron (enabled by default on Supabase)

-- Enable pg_cron extension if not already enabled
create extension if not exists pg_cron;

-- Grant usage to postgres role
grant usage on schema cron to postgres;

-- Remove existing job if it exists (idempotent)
select cron.unschedule('delete-old-tournaments')
where exists (
  select 1 from cron.job where jobname = 'delete-old-tournaments'
);

-- Schedule hourly cleanup: delete tournaments where date + 24h < now()
select cron.schedule(
  'delete-old-tournaments',
  '0 * * * *',  -- every hour on the hour
  $$
    delete from tournaments
    where (date::timestamptz + interval '24 hours') < now();
  $$
);
