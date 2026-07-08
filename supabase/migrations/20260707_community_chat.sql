-- ─────────────────────────────────────────────
-- QUEST — Chat de comunidad por TCG (estilo WhatsApp)
-- ─────────────────────────────────────────────
-- Una sala por juego (MTG, One Piece, Pokemon, Gundam, Riftbound, Digimon).
-- Cualquiera LEE; escriben usuarios logueados (como sí mismos) e INVITADOS
-- (user_id NULL, con nombre temporal). Mensajes de texto, foto y nota de voz.
-- Aplicar en Supabase → SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

-- 1) Tabla de mensajes
CREATE TABLE IF NOT EXISTS public.community_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game          text NOT NULL,                         -- sala: 'MTG', 'One Piece', ...
  user_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_id      text,                                  -- id de invitado (localStorage)
  author_name   text NOT NULL,                         -- nombre a mostrar
  author_avatar text,                                  -- avatar_url cacheado (invitado = null)
  kind          text NOT NULL DEFAULT 'text'
                  CHECK (kind IN ('text', 'image', 'voice')),
  body          text CHECK (char_length(coalesce(body, '')) <= 2000),
  media_url     text,                                  -- foto o nota de voz
  duration_ms   integer,                               -- duración de la nota de voz
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_messages_game_created_idx
  ON public.community_messages (game, created_at DESC);

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- 2) Policies
--    Leer: todos (comunidad, incluso invitados).
DROP POLICY IF EXISTS "community read" ON public.community_messages;
CREATE POLICY "community read" ON public.community_messages
  FOR SELECT USING (true);

--    Escribir: logueado como sí mismo, o invitado (user_id NULL). Un anon no
--    puede suplantar a un usuario real porque auth.uid() sería NULL.
DROP POLICY IF EXISTS "community insert" ON public.community_messages;
CREATE POLICY "community insert" ON public.community_messages
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = (SELECT auth.uid())
  );

--    Borrar: dueño (logueado) o staff (moderación).
DROP POLICY IF EXISTS "community delete" ON public.community_messages;
CREATE POLICY "community delete" ON public.community_messages
  FOR DELETE USING (
    (user_id IS NOT NULL AND user_id = (SELECT auth.uid())) OR public.is_staff()
  );

-- 3) Grants (en este proyecto PUBLIC está revocado)
GRANT SELECT, INSERT ON public.community_messages TO anon, authenticated;
GRANT DELETE         ON public.community_messages TO authenticated;

-- 4) Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Storage: bucket público 'chat' para fotos y notas de voz
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat', 'chat', true)
ON CONFLICT (id) DO NOTHING;

--    Leer: público. Subir: cualquiera (invitados también). Borrar: logueados.
DROP POLICY IF EXISTS "chat media read"   ON storage.objects;
CREATE POLICY "chat media read"   ON storage.objects
  FOR SELECT USING (bucket_id = 'chat');

DROP POLICY IF EXISTS "chat media insert" ON storage.objects;
CREATE POLICY "chat media insert" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'chat');

DROP POLICY IF EXISTS "chat media delete" ON storage.objects;
CREATE POLICY "chat media delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'chat');
