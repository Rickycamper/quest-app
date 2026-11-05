-- ─────────────────────────────────────────────
-- Arreglo: vistas SECURITY DEFINER (linter de Supabase, 2 ERROR)
-- ─────────────────────────────────────────────
-- En Postgres una vista corre por defecto con los permisos de QUIEN LA CREÓ,
-- ignorando el RLS de quien consulta. Hoy no se filtra nada (ambas vistas
-- devuelven solo agregados), pero el día que alguien agregue una columna sí.
--
-- Arreglo: security_invoker = true (la vista pasa a correr con los permisos
-- del que consulta) + permisos explícitos para que siga funcionando igual.
-- El cliente NO cambia: las mismas consultas siguen andando.
-- ─────────────────────────────────────────────

-- ── 1) cafe_product_ratings — promedio de estrellas, lo lee cualquiera ──
-- Para que el anónimo pueda calcular el promedio sin ver QUIÉN votó, se le
-- dan SOLO las dos columnas necesarias. guest_id y user_id quedan fuera.
ALTER TABLE public.cafe_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cafe ratings aggregate read" ON public.cafe_ratings;
CREATE POLICY "cafe ratings aggregate read" ON public.cafe_ratings
  FOR SELECT USING (true);
REVOKE ALL ON public.cafe_ratings FROM PUBLIC, anon, authenticated;
GRANT  SELECT (product_id, stars) ON public.cafe_ratings TO anon, authenticated;
GRANT  ALL ON public.cafe_ratings TO service_role;

CREATE OR REPLACE VIEW public.cafe_product_ratings
WITH (security_invoker = true) AS
  SELECT product_id,
         round(avg(stars)::numeric, 1) AS promedio,
         count(*)                      AS votos
  FROM public.cafe_ratings
  GROUP BY product_id;
REVOKE ALL ON public.cafe_product_ratings FROM PUBLIC;
GRANT SELECT ON public.cafe_product_ratings TO anon, authenticated, service_role;

-- ── 2) unclaimed_import_names — nombres de CSV sin dueño, para reclamarlos ──
-- Que un usuario logueado vea los nombres SIN DUEÑO es la función misma.
-- Antes eso estaba escondido en la vista; ahora es una policy que se lee.
DROP POLICY IF EXISTS "import rows unclaimed read" ON public.tournament_import_rows;
CREATE POLICY "import rows unclaimed read" ON public.tournament_import_rows
  FOR SELECT TO authenticated USING (user_id IS NULL);
DROP POLICY IF EXISTS "imports read for claiming" ON public.tournament_imports;
CREATE POLICY "imports read for claiming" ON public.tournament_imports
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.tournament_imports, public.tournament_import_rows TO authenticated;

CREATE OR REPLACE VIEW public.unclaimed_import_names
WITH (security_invoker = true) AS
  SELECT ti.game,
         ir.name_norm,
         min(ir.raw_name)   AS raw_name,
         count(*)::int      AS results,
         min(ir.position)   AS best_position,
         max(ti.played_on)  AS last_played
  FROM public.tournament_import_rows ir
  JOIN public.tournament_imports ti ON ti.id = ir.import_id
  WHERE ir.user_id IS NULL
  GROUP BY ti.game, ir.name_norm;
REVOKE ALL ON public.unclaimed_import_names FROM PUBLIC, anon;
GRANT SELECT ON public.unclaimed_import_names TO authenticated, service_role;

-- ── Verificación ──
SELECT c.relname AS vista,
       CASE WHEN 'security_invoker=true' = ANY(c.reloptions) THEN 'OK invoker' ELSE '❌ sigue definer' END AS estado
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('cafe_product_ratings', 'unclaimed_import_names')
UNION ALL
SELECT 'anon ve columnas sensibles de cafe_ratings',
       CASE WHEN has_column_privilege('anon', 'public.cafe_ratings', 'guest_id', 'SELECT')
             OR has_column_privilege('anon', 'public.cafe_ratings', 'user_id', 'SELECT')
            THEN '❌ SÍ' ELSE 'no (correcto)' END
UNION ALL
SELECT 'anon puede leer el promedio',
       CASE WHEN has_table_privilege('anon', 'public.cafe_product_ratings', 'SELECT') THEN 'sí (correcto)' ELSE '❌ no' END;
