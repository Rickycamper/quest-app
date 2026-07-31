-- ─────────────────────────────────────────────
-- QUEST CAFÉ — Órdenes con tablero para el equipo
-- ─────────────────────────────────────────────
-- Hasta acá el pedido del café solo salía por WhatsApp: no quedaba en
-- ningún lado y el equipo no tenía dónde verlo. Ahora cada pedido se
-- REGISTRA (C-0001, C-0002…) y los admins lo operan desde el propio café
-- (nueva → lista → entregada). WhatsApp sigue saliendo, con el código.
--
-- El cliente se identifica con nombre + teléfono (o su cuenta de Quest,
-- que precarga ambos). Los INVITADOS pueden ordenar: el QR lo escanea
-- cualquiera — por eso place_cafe_order se otorga también a anon, igual
-- que create_preorder.
--
-- Los PRECIOS se recalculan acá adentro desde shop_products: el navegador
-- manda solo {id, qty} y no puede inventar totales. No hay cobro online —
-- se paga en la barra — pero el tablero tiene que mostrar números reales.
--
-- Aplicar en SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cafe_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL UNIQUE,                -- C-0001
  items          jsonb NOT NULL,                      -- [{name, qty, unit, sub}] snapshot
  total          numeric NOT NULL CHECK (total >= 0),
  modo           text NOT NULL CHECK (modo IN ('tienda', 'llevar')),
  customer_name  text,
  customer_phone text,
  note           text,
  user_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'nueva'
                   CHECK (status IN ('nueva', 'lista', 'entregada', 'cancelada')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cafe_orders_created_idx ON public.cafe_orders (created_at DESC);

ALTER TABLE public.cafe_orders ENABLE ROW LEVEL SECURITY;

-- Leer: el equipo (tablero) o el dueño logueado del pedido.
DROP POLICY IF EXISTS "cafe orders read" ON public.cafe_orders;
CREATE POLICY "cafe orders read" ON public.cafe_orders
  FOR SELECT USING (public.is_staff() OR user_id = (SELECT auth.uid()));

-- Cambiar estado: solo el equipo.
DROP POLICY IF EXISTS "cafe orders staff update" ON public.cafe_orders;
CREATE POLICY "cafe orders staff update" ON public.cafe_orders
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Nadie inserta directo: solo la función (SECURITY DEFINER).
REVOKE ALL    ON public.cafe_orders FROM PUBLIC, anon;
REVOKE INSERT, DELETE ON public.cafe_orders FROM authenticated;
GRANT  SELECT ON public.cafe_orders TO authenticated;
GRANT  UPDATE (status) ON public.cafe_orders TO authenticated;
GRANT  ALL    ON public.cafe_orders TO service_role;

CREATE TABLE IF NOT EXISTS public.cafe_counter (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  n  integer NOT NULL DEFAULT 0
);
INSERT INTO public.cafe_counter (id, n) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON public.cafe_counter FROM PUBLIC, anon, authenticated;
GRANT  ALL ON public.cafe_counter TO service_role;

-- ─────────────────────────────────────────────
-- place_cafe_order(items, modo, name, phone, note) → (code, id, total)
--   items = [{"id": "<uuid>", "qty": 2}, …]  — SOLO id y cantidad.
-- ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.place_cafe_order(jsonb, text, text, text, text);

CREATE FUNCTION public.place_cafe_order(
  p_items jsonb,
  p_modo  text DEFAULT 'tienda',
  p_name  text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_note  text DEFAULT NULL
)
RETURNS TABLE (code text, id uuid, total numeric)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item    jsonb;
  v_pid     uuid;
  v_qty     integer;
  v_prod    record;
  v_unit    numeric;
  v_total   numeric := 0;
  v_lineas  jsonb := '[]'::jsonb;
  v_n       integer;
  v_code    text;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 20 THEN
    RAISE EXCEPTION 'Pedido inválido';
  END IF;
  IF p_modo NOT IN ('tienda', 'llevar') THEN
    RAISE EXCEPTION 'Modo inválido';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := (v_item->>'id')::uuid;
    v_qty := least(20, greatest(1, coalesce((v_item->>'qty')::integer, 0)));

    -- El precio sale de la base — solo items del café, activos y publicados.
    SELECT p.name, p.price, p.sale_price INTO v_prod
      FROM public.shop_products p
     WHERE p.id = v_pid AND p.category = 'cafe'
       AND coalesce(p.active, true) AND coalesce(p.price, 0) > 0;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Un producto del pedido ya no está en el menú';
    END IF;

    v_unit := CASE
      WHEN coalesce(v_prod.sale_price, 0) > 0 AND v_prod.sale_price < v_prod.price
        THEN v_prod.sale_price
      ELSE v_prod.price
    END;

    v_total  := v_total + v_unit * v_qty;
    v_lineas := v_lineas || jsonb_build_object(
      'name', v_prod.name, 'qty', v_qty,
      'unit', round(v_unit, 2), 'sub', round(v_unit * v_qty, 2));
  END LOOP;

  -- `id` calificado: RETURNS TABLE crea un parámetro de salida `id` que
  -- taparía la columna (misma trampa que costó dos compras en PayPal).
  UPDATE public.cafe_counter SET n = cafe_counter.n + 1
   WHERE public.cafe_counter.id = 1
   RETURNING cafe_counter.n INTO v_n;

  v_code := 'C-' || lpad(v_n::text, 4, '0');

  RETURN QUERY
  INSERT INTO public.cafe_orders (
    code, items, total, modo, customer_name, customer_phone, note, user_id
  ) VALUES (
    v_code, v_lineas, round(v_total, 2), p_modo,
    nullif(left(btrim(coalesce(p_name,  '')), 60),  ''),
    nullif(left(btrim(coalesce(p_phone, '')), 40),  ''),
    nullif(left(btrim(coalesce(p_note,  '')), 200), ''),
    auth.uid()
  )
  RETURNING public.cafe_orders.code, public.cafe_orders.id, public.cafe_orders.total;
END $$;

-- Invitados incluidos (el QR lo escanea cualquiera), igual que create_preorder.
-- REVOKE a PUBLIC primero: Postgres se lo concede al crear la función.
REVOKE EXECUTE ON FUNCTION public.place_cafe_order(jsonb, text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.place_cafe_order(jsonb, text, text, text, text) TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────
-- Comprobación. Esperado: place_cafe_order con anon=true y auth=true;
-- la tabla NO insertable ni por anon ni por authenticated.
-- ─────────────────────────────────────────────
SELECT p.proname,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_ejecuta,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_ejecuta
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'place_cafe_order';
