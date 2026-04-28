-- ─────────────────────────────────────────────
-- QUEST — Drop duplicate index on public.messages
--
-- Linter warning: table public.messages has two identical indexes:
--   idx_messages_conv                      (conversation_id, created_at)
--   messages_conversation_id_created_at_idx (conversation_id, created_at)
--
-- Both cover exactly the same columns in the same order.
-- Keep idx_messages_conv (shorter, matches project naming convention).
-- Drop the auto-generated dashboard name.
-- ─────────────────────────────────────────────

DROP INDEX IF EXISTS public.messages_conversation_id_created_at_idx;
