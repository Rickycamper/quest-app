-- ─────────────────────────────────────────────
-- QUEST CAFÉ — Tamaños + menú real
-- ─────────────────────────────────────────────
-- 1. shop_products.variants: los tamaños de cada bebida, como
--    [{"label":"8oz","price":2.5},{"label":"12oz","price":3}].
--    Un producto sin variantes (un brownie) usa su price suelto.
--    price queda siendo el tamaño MÁS BARATO — es el "desde" de la card.
-- 2. place_cafe_order() pasa a validar el precio POR TAMAÑO: el navegador
--    manda {id, qty, variant} y la base decide cuánto vale. Si el tamaño
--    no existe en el producto, se rechaza el pedido.
-- 3. Se carga el menú real. Los productos de café que había (los de
--    prueba) se DESACTIVAN, no se borran: quedan recuperables.
--
-- Aplicar en SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS variants jsonb;

-- ── Menú ─────────────────────────────────────
-- Fuera los de prueba (soft delete: active=false, se pueden revivir).
UPDATE public.shop_products SET active = false WHERE category = 'cafe';

INSERT INTO public.shop_products (sku, name, category, subcategory, price, sort_order, variants, description)
VALUES
  ('CAFE-AMERICANO', 'Americano', 'cafe', 'caliente', 2.50, 10, '[{"label": "8oz", "price": 2.5}, {"label": "12oz", "price": 3.0}]'::jsonb, NULL),
  ('CAFE-CAPUCHINO', 'Capuchino', 'cafe', 'caliente', 3.25, 20, '[{"label": "8oz", "price": 3.25}, {"label": "12oz", "price": 3.75}]'::jsonb, NULL),
  ('CAFE-CAPUCHINO-DE-SABORES', 'Capuchino de sabores', 'cafe', 'caliente', 3.75, 30, '[{"label": "8oz", "price": 3.75}, {"label": "12oz", "price": 4.5}]'::jsonb, 'Pistacho, caramelo, avellana, coco o vainilla.'),
  ('CAFE-LATTE', 'Latte', 'cafe', 'caliente', 3.25, 40, '[{"label": "8oz", "price": 3.25}, {"label": "12oz", "price": 3.75}]'::jsonb, NULL),
  ('CAFE-FLAT-WHITE', 'Flat white', 'cafe', 'caliente', 3.25, 50, '[{"label": "8oz", "price": 3.25}]'::jsonb, NULL),
  ('CAFE-MOCCACHINO', 'Moccachino', 'cafe', 'caliente', 3.75, 60, '[{"label": "8oz", "price": 3.75}, {"label": "12oz", "price": 4.25}]'::jsonb, NULL),
  ('CAFE-CHOCOLATE', 'Chocolate', 'cafe', 'caliente', 3.00, 70, '[{"label": "8oz", "price": 3.0}, {"label": "12oz", "price": 3.75}]'::jsonb, NULL),
  ('CAFE-MATCHA-ORGÁNICO', 'Matcha orgánico', 'cafe', 'caliente', 3.25, 80, '[{"label": "8oz", "price": 3.25}, {"label": "12oz", "price": 3.75}]'::jsonb, NULL),
  ('CAFE-MATCHA-LATTE', 'Matcha latte', 'cafe', 'caliente', 3.50, 90, '[{"label": "8oz", "price": 3.5}, {"label": "12oz", "price": 4.5}]'::jsonb, NULL),
  ('CAFE-CHAI-TEA', 'Chai tea', 'cafe', 'caliente', 3.25, 100, '[{"label": "8oz", "price": 3.25}, {"label": "12oz", "price": 3.75}]'::jsonb, NULL),
  ('CAFE-CHAI-LATTE', 'Chai latte', 'cafe', 'caliente', 3.50, 110, '[{"label": "8oz", "price": 3.5}, {"label": "12oz", "price": 4.0}]'::jsonb, NULL),
  ('CAFE-DIRTY-CHAI', 'Dirty chai', 'cafe', 'caliente', 4.00, 120, '[{"label": "8oz", "price": 4.0}, {"label": "12oz", "price": 4.25}]'::jsonb, NULL),
  ('CAFE-INFUSIONES', 'Infusiones', 'cafe', 'caliente', 4.00, 130, '[{"label": "8oz", "price": 4.0}]'::jsonb, 'Frutos rojos, morning star, herbal chai, jazmín, manzanilla o naranja.'),
  ('CAFE-FILTRADO-TRADICIONAL', 'Filtrado tradicional', 'cafe', 'caliente', 4.50, 140, '[{"label": "8oz", "price": 4.5}]'::jsonb, NULL),
  ('CAFE-FILTRADO-DE-GEISHA', 'Filtrado de geisha', 'cafe', 'caliente', 6.00, 150, '[{"label": "8oz", "price": 6.0}]'::jsonb, NULL),
  ('CAFE-ICED-COFFEE', 'Iced coffee', 'cafe', 'frio', 3.25, 10, '[{"label": "12oz", "price": 3.25}, {"label": "16oz", "price": 3.5}]'::jsonb, NULL),
  ('CAFE-ICED-LATTE', 'Iced latte', 'cafe', 'frio', 3.50, 20, '[{"label": "12oz", "price": 3.5}, {"label": "16oz", "price": 4.0}]'::jsonb, NULL),
  ('CAFE-COLD-BREW', 'Cold brew', 'cafe', 'frio', 4.00, 30, '[{"label": "12oz", "price": 4.0}, {"label": "16oz", "price": 4.5}]'::jsonb, NULL),
  ('CAFE-ICED-MATCHA-LATTE', 'Iced matcha latte', 'cafe', 'frio', 4.50, 40, '[{"label": "12oz", "price": 4.5}]'::jsonb, NULL),
  ('CAFE-ICED-MATCHA-LATTE-ESPECIAL', 'Iced matcha latte especial', 'cafe', 'frio', 4.75, 50, '[{"label": "12oz", "price": 4.75}]'::jsonb, NULL),
  ('CAFE-ICED-CHAI-LATTE', 'Iced chai latte', 'cafe', 'frio', 4.50, 60, '[{"label": "12oz", "price": 4.5}]'::jsonb, NULL),
  ('CAFE-ICED-DIRTY-CHAI', 'Iced dirty chai', 'cafe', 'frio', 5.00, 70, '[{"label": "12oz", "price": 5.0}]'::jsonb, NULL),
  ('CAFE-FRAPPÉS', 'Frappés', 'cafe', 'frio', 4.75, 80, '[{"label": "16oz", "price": 4.75}]'::jsonb, 'Caramelo, pistacho, chocolate o vainilla.'),
  ('CAFE-JUGOS-NATURALES', 'Jugos naturales', 'cafe', 'frio', 3.50, 90, '[{"label": "16oz", "price": 3.5}]'::jsonb, 'Papaya, melón, piña o fresa.'),
  ('CAFE-JUGOS-NATURALES-MIXTOS', 'Jugos naturales mixtos', 'cafe', 'frio', 4.00, 100, '[{"label": "Natural", "price": 4.0}, {"label": "Batido", "price": 4.5}]'::jsonb, 'Banana con fresa, o frutos rojos.'),
  ('CAFE-BROWNIE', 'Brownie', 'cafe', 'postre', 2.00, 10, NULL, NULL),
  ('CAFE-FLAN-DE-VAINILLA', 'Flan de vainilla', 'cafe', 'postre', 3.00, 20, NULL, NULL),
  ('CAFE-CARROT-CAKE', 'Carrot cake', 'cafe', 'postre', 4.50, 30, NULL, NULL),
  ('CAFE-BRUCE-CAKE', 'Bruce cake', 'cafe', 'postre', 4.50, 40, NULL, 'Chocolate relleno.'),
  ('CAFE-CHEESECAKE', 'Cheesecake', 'cafe', 'postre', 4.50, 50, NULL, 'De fresa o maracuyá.'),
  ('CAFE-EMPANADAS', 'Empanadas', 'cafe', 'salado', 2.50, 10, NULL, 'Carne, pollo, queso crema o queso blanco.'),
  ('CAFE-EXTRA-LECHE-DESLACTOSADA', 'Extra leche deslactosada', 'cafe', 'extra', 0.50, 10, '[{"label": "8oz", "price": 0.5}, {"label": "12oz", "price": 0.75}]'::jsonb, NULL),
  ('CAFE-EXTRA-LECHE-DE-ALMENDRA-O-AV', 'Extra leche de almendra o avena', 'cafe', 'extra', 0.60, 20, '[{"label": "8oz", "price": 0.6}, {"label": "12oz", "price": 0.8}]'::jsonb, NULL)
ON CONFLICT (sku) DO UPDATE SET
  name        = excluded.name,
  category    = excluded.category,
  subcategory = excluded.subcategory,
  price       = excluded.price,
  sort_order  = excluded.sort_order,
  variants    = excluded.variants,
  description = excluded.description,
  active      = true;

-- ── place_cafe_order con tamaños ─────────────
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
  v_label   text;
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
    v_pid   := (v_item->>'id')::uuid;
    v_qty   := least(20, greatest(1, coalesce((v_item->>'qty')::integer, 0)));
    v_label := nullif(btrim(coalesce(v_item->>'variant', '')), '');

    SELECT p.name, p.price, p.sale_price, p.variants INTO v_prod
      FROM public.shop_products p
     WHERE p.id = v_pid AND p.category = 'cafe' AND coalesce(p.active, true);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Un producto del pedido ya no está en el menú';
    END IF;

    IF v_prod.variants IS NOT NULL AND jsonb_array_length(v_prod.variants) > 0 THEN
      -- Con tamaños: el precio sale del tamaño pedido, nunca del navegador.
      SELECT (v->>'price')::numeric INTO v_unit
        FROM jsonb_array_elements(v_prod.variants) v
       WHERE v->>'label' = coalesce(v_label, v_prod.variants->0->>'label')
       LIMIT 1;
      IF v_unit IS NULL THEN
        RAISE EXCEPTION 'Tamaño inválido para %', v_prod.name;
      END IF;
    ELSE
      v_unit := CASE
        WHEN coalesce(v_prod.sale_price, 0) > 0 AND v_prod.sale_price < v_prod.price
          THEN v_prod.sale_price
        ELSE v_prod.price
      END;
      v_label := NULL;
    END IF;

    IF coalesce(v_unit, 0) <= 0 THEN
      RAISE EXCEPTION 'Producto sin precio: %', v_prod.name;
    END IF;

    v_total  := v_total + v_unit * v_qty;
    v_lineas := v_lineas || jsonb_build_object(
      'name', v_prod.name, 'size', v_label, 'qty', v_qty,
      'unit', round(v_unit, 2), 'sub', round(v_unit * v_qty, 2));
  END LOOP;

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

REVOKE EXECUTE ON FUNCTION public.place_cafe_order(jsonb, text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.place_cafe_order(jsonb, text, text, text, text) TO anon, authenticated, service_role;

-- ── Verificación ─────────────────────────────
SELECT subcategory AS seccion, count(*) AS productos
FROM public.shop_products
WHERE category = 'cafe' AND active
GROUP BY subcategory ORDER BY 1;
