-- TCG Articles (aggregated from RSS feeds)
CREATE TABLE IF NOT EXISTS public.tcg_articles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game         text NOT NULL,
  source_name  text NOT NULL,
  title        text NOT NULL,
  url          text NOT NULL UNIQUE,
  image_url    text,
  author       text,
  published_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.tcg_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "articles_public_read" ON public.tcg_articles
  FOR SELECT TO public USING (true);

CREATE POLICY "articles_service_write" ON public.tcg_articles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index for fast game-filtered queries
CREATE INDEX IF NOT EXISTS tcg_articles_game_published
  ON public.tcg_articles (game, published_at DESC);
