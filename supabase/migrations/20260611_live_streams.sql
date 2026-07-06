-- ─────────────────────────────────────────────
-- QUEST — Transmisiones en vivo (embed Twitch/YouTube)
-- ─────────────────────────────────────────────
-- El equipo (owner/admin) inicia una transmisión pegando un link de
-- Twitch/YouTube; todos los usuarios ven el banner EN VIVO y miran el
-- stream embebido. Una sola transmisión activa a la vez (is_live=true).
-- Idempotente.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.live_streams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform    text NOT NULL CHECK (platform IN ('youtube', 'twitch', 'tiktok')),
  url         text NOT NULL,                 -- link original pegado por el admin
  channel     text NOT NULL,                 -- video id (YouTube) o canal (Twitch)
  title       text,
  is_live     boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver la transmisión activa
DROP POLICY IF EXISTS "live_streams_read" ON public.live_streams;
CREATE POLICY "live_streams_read" ON public.live_streams
  FOR SELECT USING (true);

-- Solo el equipo (owner/staff/admin) puede iniciar/terminar
DROP POLICY IF EXISTS "live_streams_staff_write" ON public.live_streams;
CREATE POLICY "live_streams_staff_write" ON public.live_streams
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Realtime: que el banner EN VIVO aparezca/desaparezca solo para todos.
-- (Si la publicación no existe o ya incluye la tabla, no falla.)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
