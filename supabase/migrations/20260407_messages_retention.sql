-- ─────────────────────────────────────────────────────────────────────────────
-- QUEST — Messages retention policy
-- • Cancel any existing cron jobs that auto-delete messages
-- • Install a safe 30-day retention job (only deletes messages > 30 days old)
-- • Increase read limit to 300 rows (handled in app code)
-- ─────────────────────────────────────────────────────────────────────────────

-- Make sure pg_cron is available
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

-- Cancel any existing jobs that might be deleting messages too aggressively
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE command ILIKE '%messages%' OR command ILIKE '%conversations%';

-- Install a safe retention job: only delete messages older than 30 days
-- Runs daily at 3am UTC
SELECT cron.unschedule('delete-old-messages')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'delete-old-messages'
);

SELECT cron.schedule(
  'delete-old-messages',
  '0 3 * * *',
  $$
    DELETE FROM public.messages
    WHERE created_at < now() - INTERVAL '30 days';
  $$
);

-- Also protect conversations: only delete if all their messages are gone
-- (conversations with no messages older than 30d keep the thread header alive)
SELECT cron.unschedule('delete-empty-conversations')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'delete-empty-conversations'
);

SELECT cron.schedule(
  'delete-empty-conversations',
  '10 3 * * *',
  $$
    DELETE FROM public.conversations
    WHERE updated_at < now() - INTERVAL '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.conversation_id = conversations.id
      );
  $$
);
