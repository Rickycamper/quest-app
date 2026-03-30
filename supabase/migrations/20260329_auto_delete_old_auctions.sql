-- Auto-delete ended/cancelled auctions 72 hours after they ended
-- Keeps the auction list clean without manual cleanup

create extension if not exists pg_cron;
grant usage on schema cron to postgres;

select cron.unschedule('delete-old-auctions')
where exists (
  select 1 from cron.job where jobname = 'delete-old-auctions'
);

select cron.schedule(
  'delete-old-auctions',
  '30 * * * *',  -- every hour at :30 (offset from tournaments job at :00)
  $$
    delete from auctions
    where status in ('ended', 'cancelled')
      and (start_time + (duration_seconds || ' seconds')::interval + interval '72 hours') < now();
  $$
);
