-- ─────────────────────────────────────────────
-- QUEST — Leagues v2 (teams + tiers)
--
-- Structure:
--   leagues              → the league itself
--   league_teams         → teams of 3 (one per tier A/B/C)
--   league_team_members  → which player fills which tier slot
--   league_fechas        → rounds / dates
--   league_fecha_results → position entered by staff → points auto-calculated
--
-- Scoring (auto via trigger):
--   Tier A: 1° = 2pts  |  2°–3° = 1pt  |  4°+ = 0
--   Tier B: 1°–3° = 2pts  |  4° = 1pt  |  5°+ = 0
--   Tier C: 1°–3° = 2pts  |  4°–8° = 1pt  |  9°+ = 0
-- ─────────────────────────────────────────────

-- ── Leagues ───────────────────────────────────
CREATE TABLE public.leagues (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text        NOT NULL,
  game        text,
  branch      text,
  description text,
  entry_fee   numeric(10,2) NOT NULL DEFAULT 0,
  status      text        NOT NULL DEFAULT 'upcoming'
              CHECK (status IN ('upcoming','active','finished')),
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ── Teams ─────────────────────────────────────
-- Each league has teams of exactly 3: one slot per tier A/B/C
CREATE TABLE public.league_teams (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id  uuid        NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (league_id, name)
);

-- ── Team members ──────────────────────────────
-- One row per player. tier = A | B | C.
-- Constraints: only one player per tier per team, one team per player per league.
CREATE TABLE public.league_team_members (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id   uuid NOT NULL REFERENCES public.league_teams(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(id)      ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.profiles(id)     ON DELETE CASCADE,
  tier      text NOT NULL CHECK (tier IN ('A','B','C')),
  UNIQUE (team_id, tier),       -- one player per tier slot per team
  UNIQUE (league_id, user_id)   -- one slot per player per league
);

-- ── Fechas (rounds) ───────────────────────────
CREATE TABLE public.league_fechas (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id  uuid        NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  number     integer     NOT NULL,
  date       date,
  start_time time,
  status     text        NOT NULL DEFAULT 'upcoming'
             CHECK (status IN ('upcoming','active','finished')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (league_id, number)
);

-- ── Per-fecha results ─────────────────────────
-- Staff records position + tier → points auto-calculated by trigger.
CREATE TABLE public.league_fecha_results (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha_id    uuid        NOT NULL REFERENCES public.league_fechas(id) ON DELETE CASCADE,
  league_id   uuid        NOT NULL REFERENCES public.leagues(id)       ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  tier        text        NOT NULL CHECK (tier IN ('A','B','C')),
  position    integer     NOT NULL CHECK (position > 0),
  points      integer     NOT NULL DEFAULT 0,  -- auto-set by trigger
  recorded_by uuid        REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (fecha_id, user_id)
);

-- ── Points calculation ────────────────────────
-- Pure function: tier + position → points. IMMUTABLE = safe to index/cache.
CREATE OR REPLACE FUNCTION public.calc_league_points(p_tier text, p_position integer)
RETURNS integer
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pts integer := 0;
BEGIN
  -- ── Base rule (ALL tiers) ──────────────────
  -- Top 3 in the jornada → +1 pt
  IF p_position <= 3 THEN
    v_pts := v_pts + 1;
  END IF;

  -- Winner (1st place) → +1 extra (ALL tiers)
  IF p_position = 1 THEN
    v_pts := v_pts + 1;
  END IF;

  -- ── Tier B bonus ───────────────────────────
  -- Reaching top 4 → +1 extra (stacks with base)
  --   1st  = 1 (top 3) + 1 (winner) + 1 (top 4) = 3 pts
  --   2nd–3rd = 1 (top 3) + 1 (top 4) = 2 pts
  --   4th  = 0 + 0 + 1 (top 4) = 1 pt
  IF p_tier = 'B' AND p_position <= 4 THEN
    v_pts := v_pts + 1;
  END IF;

  -- ── Tier C bonus ───────────────────────────
  -- Reaching top 8 → +1 extra (stacks with base)
  --   1st  = 1 (top 3) + 1 (winner) + 1 (top 8) = 3 pts
  --   2nd–3rd = 1 (top 3) + 1 (top 8) = 2 pts
  --   4th–8th = 0 + 0 + 1 (top 8) = 1 pt
  IF p_tier = 'C' AND p_position <= 8 THEN
    v_pts := v_pts + 1;
  END IF;

  RETURN v_pts;
END;
$$;

-- Trigger function: fires BEFORE INSERT OR UPDATE to auto-fill points
CREATE OR REPLACE FUNCTION public.set_league_result_points()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.points := public.calc_league_points(NEW.tier, NEW.position);
  RETURN NEW;
END;
$$;

CREATE TRIGGER league_fecha_results_calc_points
  BEFORE INSERT OR UPDATE OF tier, position
  ON public.league_fecha_results
  FOR EACH ROW EXECUTE FUNCTION public.set_league_result_points();

-- ── set_updated_at helper (safe to re-create) ─
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── updated_at trigger for leagues ───────────
DROP TRIGGER IF EXISTS leagues_updated_at ON public.leagues;
CREATE TRIGGER leagues_updated_at
  BEFORE UPDATE ON public.leagues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Standings RPC ─────────────────────────────
-- Returns team standings for a league: total pts + member breakdown.
-- Used by the frontend to render the league table without extra round-trips.
CREATE OR REPLACE FUNCTION public.get_league_standings(p_league_id uuid)
RETURNS TABLE (
  team_id      uuid,
  team_name    text,
  total_points bigint,
  members      jsonb
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id                                        AS team_id,
    t.name                                      AS team_name,
    COALESCE(SUM(r.points), 0)::bigint          AS total_points,
    jsonb_agg(
      jsonb_build_object(
        'user_id',      m.user_id,
        'username',     pr.username,
        'avatar_url',   pr.avatar_url,
        'tier',         m.tier,
        'total_points', COALESCE(mp.pts, 0)
      ) ORDER BY m.tier
    )                                           AS members
  FROM public.league_teams t
  LEFT JOIN public.league_team_members m  ON m.team_id   = t.id
  LEFT JOIN public.profiles            pr ON pr.id       = m.user_id
  -- total points for this member across all fechas in this league
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(r2.points), 0) AS pts
    FROM public.league_fecha_results r2
    WHERE r2.league_id = p_league_id
      AND r2.user_id   = m.user_id
  ) mp ON true
  -- join for SUM used in GROUP BY (all fechas, all members)
  LEFT JOIN public.league_fecha_results r
    ON r.league_id = p_league_id
   AND r.user_id   = m.user_id
  WHERE t.league_id = p_league_id
  GROUP BY t.id, t.name
  ORDER BY total_points DESC;
END;
$$;

-- ── Indexes ───────────────────────────────────
CREATE INDEX idx_leagues_status          ON public.leagues (status);
CREATE INDEX idx_leagues_game            ON public.leagues (game);
CREATE INDEX idx_leagues_branch          ON public.leagues (branch);
CREATE INDEX idx_league_teams_lid        ON public.league_teams (league_id);
CREATE INDEX idx_league_tmembers_team    ON public.league_team_members (team_id);
CREATE INDEX idx_league_tmembers_league  ON public.league_team_members (league_id);
CREATE INDEX idx_league_tmembers_user    ON public.league_team_members (user_id);
CREATE INDEX idx_league_fechas_lid       ON public.league_fechas (league_id);
CREATE INDEX idx_league_fresults_fecha   ON public.league_fecha_results (fecha_id);
CREATE INDEX idx_league_fresults_league  ON public.league_fecha_results (league_id);
CREATE INDEX idx_league_fresults_user    ON public.league_fecha_results (user_id);

-- ── RLS ───────────────────────────────────────
ALTER TABLE public.leagues              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_teams         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_team_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_fechas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_fecha_results ENABLE ROW LEVEL SECURITY;

-- leagues: public read, staff write
CREATE POLICY "leagues_select" ON public.leagues FOR SELECT USING (true);
CREATE POLICY "leagues_insert" ON public.leagues FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_owner OR role IN ('admin','staff')))
);
CREATE POLICY "leagues_update" ON public.leagues FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_owner OR role IN ('admin','staff')))
);
CREATE POLICY "leagues_delete" ON public.leagues FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_owner OR role IN ('admin','staff')))
);

-- league_teams: public read, staff write
CREATE POLICY "league_teams_select" ON public.league_teams FOR SELECT USING (true);
CREATE POLICY "league_teams_write"  ON public.league_teams FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_owner OR role IN ('admin','staff')))
);

-- league_team_members: public read, staff write
CREATE POLICY "league_tmembers_select" ON public.league_team_members FOR SELECT USING (true);
CREATE POLICY "league_tmembers_write"  ON public.league_team_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_owner OR role IN ('admin','staff')))
);

-- league_fechas: public read, staff write
CREATE POLICY "league_fechas_select" ON public.league_fechas FOR SELECT USING (true);
CREATE POLICY "league_fechas_write"  ON public.league_fechas FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_owner OR role IN ('admin','staff')))
);

-- league_fecha_results: public read, staff write
CREATE POLICY "league_fresults_select" ON public.league_fecha_results FOR SELECT USING (true);
CREATE POLICY "league_fresults_write"  ON public.league_fecha_results FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_owner OR role IN ('admin','staff')))
);

-- Grant RPC to authenticated users
GRANT EXECUTE ON FUNCTION public.calc_league_points(text, integer)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_league_standings(uuid)          TO authenticated;
