-- ─────────────────────────────────────────────
-- QUEST — Leagues
-- Multi-fecha competitive leagues per game/branch
-- ─────────────────────────────────────────────

-- ── Main league ───────────────────────────────
CREATE TABLE public.leagues (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  game        text,
  branch      text,
  description text,
  entry_fee   numeric(10,2) NOT NULL DEFAULT 0,
  max_players integer NOT NULL DEFAULT 0,   -- 0 = unlimited
  status      text NOT NULL DEFAULT 'upcoming'
              CHECK (status IN ('upcoming','active','finished')),
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ── Fechas (rounds) ───────────────────────────
CREATE TABLE public.league_fechas (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id   uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  number      integer NOT NULL,
  date        date,
  start_time  time,
  status      text NOT NULL DEFAULT 'upcoming'
              CHECK (status IN ('upcoming','active','finished')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (league_id, number)
);

-- ── Participants (enrolled in the league) ─────
CREATE TABLE public.league_participants (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id  uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  paid       boolean NOT NULL DEFAULT false,
  joined_at  timestamptz DEFAULT now(),
  UNIQUE (league_id, user_id)
);

-- ── Results (points per user per fecha) ───────
CREATE TABLE public.league_results (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha_id    uuid NOT NULL REFERENCES public.league_fechas(id) ON DELETE CASCADE,
  league_id   uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points      integer NOT NULL DEFAULT 0,
  position    integer,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (fecha_id, user_id)
);

-- ── Indexes ───────────────────────────────────
CREATE INDEX idx_leagues_status     ON public.leagues (status);
CREATE INDEX idx_leagues_game       ON public.leagues (game);
CREATE INDEX idx_leagues_branch     ON public.leagues (branch);
CREATE INDEX idx_league_fechas_lid  ON public.league_fechas (league_id);
CREATE INDEX idx_league_part_lid    ON public.league_participants (league_id);
CREATE INDEX idx_league_part_uid    ON public.league_participants (user_id);
CREATE INDEX idx_league_res_fid     ON public.league_results (fecha_id);
CREATE INDEX idx_league_res_lid     ON public.league_results (league_id);
CREATE INDEX idx_league_res_uid     ON public.league_results (user_id);

-- ── Auto-update updated_at ────────────────────
DROP TRIGGER IF EXISTS leagues_updated_at ON public.leagues;
CREATE TRIGGER leagues_updated_at
  BEFORE UPDATE ON public.leagues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────
ALTER TABLE public.leagues             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_fechas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_results      ENABLE ROW LEVEL SECURITY;

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

-- league_fechas: public read, staff write
CREATE POLICY "league_fechas_select" ON public.league_fechas FOR SELECT USING (true);
CREATE POLICY "league_fechas_write"  ON public.league_fechas FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_owner OR role IN ('admin','staff')))
);

-- league_participants: public read
-- Users can self-enroll ONLY while league is upcoming; staff can always manage
CREATE POLICY "league_participants_select" ON public.league_participants FOR SELECT USING (true);
CREATE POLICY "league_participants_insert" ON public.league_participants
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_owner OR role IN ('admin','staff')))
    OR (
      (SELECT auth.uid()) = user_id
      AND EXISTS (SELECT 1 FROM public.leagues WHERE id = league_id AND status = 'upcoming')
    )
  );
CREATE POLICY "league_participants_update" ON public.league_participants FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_owner OR role IN ('admin','staff')))
);
CREATE POLICY "league_participants_delete" ON public.league_participants
  FOR DELETE USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_owner OR role IN ('admin','staff')))
  );

-- league_results: public read, staff write
CREATE POLICY "league_results_select" ON public.league_results FOR SELECT USING (true);
CREATE POLICY "league_results_write"  ON public.league_results FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_owner OR role IN ('admin','staff')))
);
