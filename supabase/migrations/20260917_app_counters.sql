-- ─────────────────────────────────────────────
-- QUEST — Contadores históricos que sobreviven a los borrados
-- ─────────────────────────────────────────────
-- La app borra de verdad (paquete retirado, post eliminado, torneo viejo por
-- cron), así que count(*) subestima lo que pasó. Esta tabla suma 1 en cada
-- alta y NUNCA resta.
--
-- Siembra: total histórico = filas que existen hoy + filas borradas según
-- pg_stat. (Los contadores de pg_stat se reiniciaron ~27-28 abr 2026 por una
-- actualización de Postgres; lo borrado ANTES de esa fecha no es
-- recuperable, así que el número es un piso, no un techo.)
-- Aplicar en SQL Editor. Idempotente: re-correrlo no pisa los totales.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_counters (
  key        text PRIMARY KEY,
  total      bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "counters staff read" ON public.app_counters;
CREATE POLICY "counters staff read" ON public.app_counters FOR SELECT USING (public.is_staff());
REVOKE ALL ON public.app_counters FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.app_counters FROM authenticated;
GRANT SELECT ON public.app_counters TO authenticated;
GRANT ALL ON public.app_counters TO service_role;

CREATE OR REPLACE FUNCTION public.bump_app_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.app_counters (key, total) VALUES (TG_ARGV[0], 1)
  ON CONFLICT (key) DO UPDATE SET total = public.app_counters.total + 1, updated_at = now();
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.bump_app_counter() FROM PUBLIC;

-- Siembra (solo si la clave no existe todavía)
INSERT INTO public.app_counters (key, total)
SELECT k, vivos + borrados FROM (
  SELECT 'usuarios'  AS k, (SELECT count(*) FROM public.profiles) AS vivos,
         coalesce((SELECT n_tup_del FROM pg_stat_all_tables WHERE schemaname = 'public' AND relname = 'profiles'), 0) AS borrados
  UNION ALL SELECT 'posts', (SELECT count(*) FROM public.posts),
         coalesce((SELECT n_tup_del FROM pg_stat_all_tables WHERE schemaname = 'public' AND relname = 'posts'), 0)
  UNION ALL SELECT 'trackings', (SELECT count(*) FROM public.packages),
         coalesce((SELECT n_tup_del FROM pg_stat_all_tables WHERE schemaname = 'public' AND relname = 'packages'), 0)
  UNION ALL SELECT 'torneos', (SELECT count(*) FROM public.tournaments),
         coalesce((SELECT n_tup_del FROM pg_stat_all_tables WHERE schemaname = 'public' AND relname = 'tournaments'), 0)
) s
ON CONFLICT (key) DO NOTHING;

DROP TRIGGER IF EXISTS trg_count_profiles    ON public.profiles;
DROP TRIGGER IF EXISTS trg_count_posts       ON public.posts;
DROP TRIGGER IF EXISTS trg_count_packages    ON public.packages;
DROP TRIGGER IF EXISTS trg_count_tournaments ON public.tournaments;
CREATE TRIGGER trg_count_profiles    AFTER INSERT ON public.profiles    FOR EACH ROW EXECUTE FUNCTION public.bump_app_counter('usuarios');
CREATE TRIGGER trg_count_posts       AFTER INSERT ON public.posts       FOR EACH ROW EXECUTE FUNCTION public.bump_app_counter('posts');
CREATE TRIGGER trg_count_packages    AFTER INSERT ON public.packages    FOR EACH ROW EXECUTE FUNCTION public.bump_app_counter('trackings');
CREATE TRIGGER trg_count_tournaments AFTER INSERT ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.bump_app_counter('torneos');

SELECT key AS contador, total AS total_historico FROM public.app_counters ORDER BY key;
