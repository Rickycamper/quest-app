-- ─────────────────────────────────────────────
-- QUEST — Fix ON CONFLICT for league_fecha_results upsert
--
-- Problem: idx_lfr_participant was a PARTIAL index
--   (WHERE participant_id IS NOT NULL).
-- PostgreSQL ON CONFLICT DO UPDATE cannot target partial indexes,
-- so Supabase .upsert({ onConflict: 'fecha_id,participant_id' }) fails with
--   "there is no unique or exclusion constraint matching the ON CONFLICT spec."
--
-- Fix: replace with a full (non-partial) unique index.
-- NULL values are distinct from each other in PostgreSQL unique indexes,
-- so rows with participant_id = NULL are still allowed (and safe).
-- ─────────────────────────────────────────────

-- Drop the old partial index
DROP INDEX IF EXISTS public.idx_lfr_participant;

-- Create a full unique index — ON CONFLICT can now target it
CREATE UNIQUE INDEX idx_lfr_participant
  ON public.league_fecha_results (fecha_id, participant_id);
