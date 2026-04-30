-- ─────────────────────────────────────────────
-- QUEST — Add entry_fee to tournaments
-- ─────────────────────────────────────────────
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS entry_fee numeric(10,2) NOT NULL DEFAULT 0;
