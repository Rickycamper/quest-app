-- ─────────────────────────────────────────────
-- QUEST — Season / Championship System
-- 3 seasons per year: Jan-Apr · May-Aug · Sep-Dec
-- Reset: Jan 1 / May 1 / Sep 1 at 00:00 UTC
-- ─────────────────────────────────────────────

-- ── seasons table ────────────────────────────
CREATE TABLE IF NOT EXISTS seasons (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number     integer NOT NULL UNIQUE,
  name       text NOT NULL,      -- e.g. 'Temporada 2'
  start_date date NOT NULL,
  end_date   date NOT NULL,
  active     boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read seasons" ON seasons
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage seasons" ON seasons
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
      AND (is_owner = true OR role IN ('admin'))
  ));

-- Seed: S1 (Jan–Apr 2026, already ended), S2 (May–Aug 2026, active)
INSERT INTO seasons (number, name, start_date, end_date, active) VALUES
  (1, 'Temporada 1', '2026-01-01', '2026-04-30', false),
  (2, 'Temporada 2', '2026-05-01', '2026-08-31', true)
ON CONFLICT (number) DO NOTHING;

-- ── season_snapshots: top players archived at end of each season ──
CREATE TABLE IF NOT EXISTS season_snapshots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id  uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game       text NOT NULL,
  branch     text,              -- NULL = global ranking
  points     bigint NOT NULL,
  rank       integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (season_id, user_id, game, branch)
);
ALTER TABLE season_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read snapshots" ON season_snapshots
  FOR SELECT TO authenticated USING (true);

-- ── profiles: store season badge keys won by each user ──────────
-- Format: 'S2-MTG-Panama', 'S1-Pokemon-David', etc.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS season_badges text[] DEFAULT '{}';
