-- ─────────────────────────────────────────────
-- QUEST — Separar el feed de "Trade y Ventas"
-- ─────────────────────────────────────────────
-- El feed mostraba TODO mezclado (posts normales + Compro/Tengo/Tradeo/Vendo).
-- El tipo solo vivía como prefijo [Compro] en el caption. Agregamos una
-- columna real `post_type` y hacemos backfill de los posts viejos desde ese
-- prefijo. NULL = post normal (va al Feed); los demás van a "Trade y Ventas".
-- Aplicar en Supabase → SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS post_type text
  CHECK (post_type IN ('want', 'have', 'trade', 'sell'));

-- Backfill desde el prefijo del caption de los posts existentes
UPDATE public.posts SET post_type = 'want'  WHERE post_type IS NULL AND caption ILIKE '[Compro]%';
UPDATE public.posts SET post_type = 'have'  WHERE post_type IS NULL AND caption ILIKE '[Tengo]%';
UPDATE public.posts SET post_type = 'trade' WHERE post_type IS NULL AND caption ILIKE '[Tradeo]%';
UPDATE public.posts SET post_type = 'sell'  WHERE post_type IS NULL AND caption ILIKE '[Vendo]%';

-- Índice para las dos vistas (feed = post_type IS NULL / market = NOT NULL)
CREATE INDEX IF NOT EXISTS posts_type_created_idx
  ON public.posts (post_type, created_at DESC);
