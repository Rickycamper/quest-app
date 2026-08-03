-- ─────────────────────────────────────────────
-- QUEST CAFÉ — Rating de las bebidas
-- ─────────────────────────────────────────────
-- La gente puntúa lo que toma (1 a 5 estrellas) y el promedio se muestra
-- arriba de cada card, como en la referencia.
--
-- INVITADOS INCLUIDOS: el QR lo escanea cualquiera y pedirle cuenta para
-- votar mataría la función. Se identifican por el guest_id que la app ya
-- guarda en localStorage (mismo que usa el chat de comunidad). Un voto por
-- persona y bebida: votar de nuevo REEMPLAZA el anterior, no suma.
--
-- Lo que se expone al público es SOLO el agregado (promedio y cantidad) a
-- través de una vista: los votos individuales, con su guest_id, no se
-- pueden leer desde el cliente.
--
-- Aplicar en SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cafe_ratings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  guest_id   text NOT NULL,
  user_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  stars      smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, guest_id)
);

CREATE INDEX IF NOT EXISTS cafe_ratings_producto_idx ON public.cafe_ratings (product_id);

ALTER TABLE public.cafe_ratings ENABLE ROW LEVEL SECURITY;

-- Nadie lee ni escribe la tabla directo: se pasa por la vista y la función.
REVOKE ALL ON public.cafe_ratings FROM PUBLIC, anon, authenticated;
GRANT  ALL ON public.cafe_ratings TO service_role;

-- ── Vista pública: solo el agregado ──────────────────────────────────────────
-- security_invoker = off (default en vistas normales) hace que corra con los
-- permisos del dueño, así el público ve promedios sin poder tocar la tabla.
CREATE OR REPLACE VIEW public.cafe_product_ratings AS
  SELECT product_id,
         round(avg(stars)::numeric, 1) AS promedio,
         count(*)                      AS votos
  FROM public.cafe_ratings
  GROUP BY product_id;

GRANT SELECT ON public.cafe_product_ratings TO anon, authenticated, service_role;

-- ── Votar ────────────────────────────────────────────────────────────────────
-- Un voto por (bebida, persona). Volver a votar pisa el anterior.
-- Solo acepta productos del café que estén publicados.
CREATE OR REPLACE FUNCTION public.rate_cafe_product(
  p_product_id uuid,
  p_stars      integer,
  p_guest_id   text
)
RETURNS TABLE (promedio numeric, votos bigint)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_guest text := nullif(btrim(coalesce(p_guest_id, '')), '');
BEGIN
  IF p_stars IS NULL OR p_stars < 1 OR p_stars > 5 THEN
    RAISE EXCEPTION 'Puntaje inválido';
  END IF;
  IF v_guest IS NULL THEN
    RAISE EXCEPTION 'Falta identificador';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_products sp
     WHERE sp.id = p_product_id AND sp.category = 'cafe' AND coalesce(sp.active, true)
  ) THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  INSERT INTO public.cafe_ratings (product_id, guest_id, user_id, stars)
  VALUES (p_product_id, v_guest, auth.uid(), p_stars)
  ON CONFLICT (product_id, guest_id)
  DO UPDATE SET stars = excluded.stars, created_at = now();

  RETURN QUERY
    SELECT round(avg(r.stars)::numeric, 1), count(*)
      FROM public.cafe_ratings r
     WHERE r.product_id = p_product_id;
END $$;

-- Invitados incluidos. REVOKE a PUBLIC primero: Postgres se lo concede al crear.
REVOKE EXECUTE ON FUNCTION public.rate_cafe_product(uuid, integer, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rate_cafe_product(uuid, integer, text) TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────
-- Comprobación: la función debe ser ejecutable por anon; la TABLA no legible.
-- ─────────────────────────────────────────────
SELECT 'rate_cafe_product' AS objeto,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_puede
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'rate_cafe_product'
UNION ALL
SELECT 'cafe_ratings (tabla, debe ser false)',
       has_table_privilege('anon', 'public.cafe_ratings', 'SELECT')
UNION ALL
SELECT 'cafe_product_ratings (vista, debe ser true)',
       has_table_privilege('anon', 'public.cafe_product_ratings', 'SELECT');
