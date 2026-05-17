-- ─────────────────────────────────────────────
-- QUEST — Guest participants in leagues
--
-- Allows staff to add players without an account to a league
-- by just providing their name. Either user_id (registered) OR
-- guest_name (unregistered) must be set — not both required.
-- ─────────────────────────────────────────────

-- 1. Make user_id optional
ALTER TABLE public.league_participants
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add guest_name column
ALTER TABLE public.league_participants
  ADD COLUMN IF NOT EXISTS guest_name text;

-- 3. Enforce at least one identity
ALTER TABLE public.league_participants
  ADD CONSTRAINT lp_has_identity CHECK (
    (user_id IS NOT NULL)
    OR (guest_name IS NOT NULL AND trim(guest_name) <> '')
  );

-- 4. Replace the UNIQUE(league_id, user_id) constraint with partial indexes
--    (nullable columns can't be part of a standard UNIQUE constraint)
ALTER TABLE public.league_participants
  DROP CONSTRAINT IF EXISTS league_participants_league_id_user_id_key;

-- One registered user can only appear once per league
CREATE UNIQUE INDEX IF NOT EXISTS idx_lp_unique_user
  ON public.league_participants (league_id, user_id)
  WHERE user_id IS NOT NULL;

-- Same guest name can't appear twice in the same league
CREATE UNIQUE INDEX IF NOT EXISTS idx_lp_unique_guest
  ON public.league_participants (league_id, guest_name)
  WHERE guest_name IS NOT NULL;
