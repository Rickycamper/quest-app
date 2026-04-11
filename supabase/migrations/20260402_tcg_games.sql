-- Add tcg_games column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tcg_games text[] DEFAULT '{}';
