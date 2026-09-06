-- ─────────────────────────────────────────────
-- ROLL PLAYER — personajes de rol (homebrew)
-- ─────────────────────────────────────────────
-- Una fila por personaje. El personaje entero va en `data` (jsonb) con el
-- formato de public/rulesets/<id>/character.schema.json — solo elecciones y
-- estado vivo; todo lo derivado se calcula en el cliente.
-- Aplicar en SQL Editor. Idempotente.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rp_characters (
  id         uuid PRIMARY KEY,
  owner_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ruleset_id text NOT NULL,
  name       text NOT NULL DEFAULT 'Sin nombre',
  level      integer NOT NULL DEFAULT 1,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'campaign', 'public')),
  data       jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rp_characters_owner_idx ON public.rp_characters (owner_id, updated_at DESC);

ALTER TABLE public.rp_characters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rp read own or public" ON public.rp_characters;
CREATE POLICY "rp read own or public" ON public.rp_characters
  FOR SELECT USING (owner_id = (SELECT auth.uid()) OR visibility = 'public');
DROP POLICY IF EXISTS "rp insert own" ON public.rp_characters;
CREATE POLICY "rp insert own" ON public.rp_characters
  FOR INSERT WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "rp update own" ON public.rp_characters;
CREATE POLICY "rp update own" ON public.rp_characters
  FOR UPDATE USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "rp delete own" ON public.rp_characters;
CREATE POLICY "rp delete own" ON public.rp_characters
  FOR DELETE USING (owner_id = (SELECT auth.uid()));

REVOKE ALL ON public.rp_characters FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rp_characters TO authenticated;
GRANT ALL ON public.rp_characters TO service_role;

SELECT 'rp_characters: anon puede leer (debe ser false)' AS chequeo,
       has_table_privilege('anon', 'public.rp_characters', 'SELECT')::text AS valor
UNION ALL
SELECT 'authenticated puede insertar (debe ser true)',
       has_table_privilege('authenticated', 'public.rp_characters', 'INSERT')::text;
