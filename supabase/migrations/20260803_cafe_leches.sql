-- ══════════════════════════════════════════════════════════
-- QUEST CAFÉ — El cambio de leche pasa a ser un ADICIONAL
-- de cada bebida, en vez de dos productos sueltos del menú.
-- ══════════════════════════════════════════════════════════

ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS has_milk boolean NOT NULL DEFAULT false;

-- Fuera del menú los dos productos de "extras"
UPDATE public.shop_products SET active = false
 WHERE sku IN ('CAFE-EXTRA-DESLACTOSADA', 'CAFE-EXTRA-ALMENDRA-AVENA');

-- Qué bebidas llevan leche (son las que ofrecen el cambio)
UPDATE public.shop_products SET has_milk = false WHERE category = 'cafe';
UPDATE public.shop_products SET has_milk = true
 WHERE category = 'cafe' AND sku IN (
   'CAFE-CAPUCHINO', 'CAFE-CAPUCHINO-SABORES', 'CAFE-LATTE', 'CAFE-FLAT-WHITE',
   'CAFE-MOCCACHINO', 'CAFE-CHOCOLATE', 'CAFE-MATCHA-LATTE', 'CAFE-CHAI-LATTE',
   'CAFE-DIRTY-CHAI', 'CAFE-ICED-LATTE', 'CAFE-ICED-MATCHA-LATTE',
   'CAFE-ICED-MATCHA-ESPECIAL', 'CAFE-ICED-CHAI-LATTE', 'CAFE-ICED-DIRTY-CHAI',
   'CAFE-FRAPPES'
 );

-- ── place_cafe_order con recargo de leche ────────────────
-- El recargo lo decide la BASE, igual que el precio del tamaño: el
-- navegador solo manda qué leche eligió.
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
  v_extra   text;
  v_rec     numeric;
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
    v_extra := coalesce(nullif(btrim(coalesce(v_item->>'extra', '')), ''), 'normal');

    SELECT p.name, p.price, p.sale_price, p.variants, p.has_milk INTO v_prod
      FROM public.shop_products p
     WHERE p.id = v_pid AND p.category = 'cafe' AND coalesce(p.active, true);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Un producto del pedido ya no está en el menú';
    END IF;

    IF v_prod.variants IS NOT NULL AND jsonb_array_length(v_prod.variants) > 0 THEN
      SELECT (v->>'price')::numeric INTO v_unit
        FROM jsonb_array_elements(v_prod.variants) v
       WHERE v->>'label' = coalesce(v_label, v_prod.variants->0->>'label')
       LIMIT 1;
      IF v_unit IS NULL THEN
        RAISE EXCEPTION 'Tamaño inválido para %', v_prod.name;
      END IF;
      IF v_label IS NULL THEN v_label := v_prod.variants->0->>'label'; END IF;
    ELSE
      v_unit := CASE
        WHEN coalesce(v_prod.sale_price, 0) > 0 AND v_prod.sale_price < v_prod.price
          THEN v_prod.sale_price
        ELSE v_prod.price
      END;
      v_label := NULL;
    END IF;

    -- Recargo por cambio de leche. Solo aplica si la bebida lleva leche.
    v_rec := 0;
    IF v_prod.has_milk AND v_extra <> 'normal' THEN
      v_rec := CASE v_extra
        WHEN 'deslac'  THEN CASE WHEN v_label = '8oz' THEN 0.50 ELSE 0.75 END
        WHEN 'vegetal' THEN CASE WHEN v_label = '8oz' THEN 0.60 ELSE 0.80 END
        ELSE NULL
      END;
      IF v_rec IS NULL THEN
        RAISE EXCEPTION 'Adicional inválido para %', v_prod.name;
      END IF;
    ELSE
      v_extra := 'normal';
    END IF;

    v_unit := v_unit + v_rec;
    IF coalesce(v_unit, 0) <= 0 THEN
      RAISE EXCEPTION 'Producto sin precio: %', v_prod.name;
    END IF;

    v_total  := v_total + v_unit * v_qty;
    v_lineas := v_lineas || jsonb_build_object(
      'name', v_prod.name, 'size', v_label,
      'milk', CASE WHEN v_extra = 'normal' THEN NULL ELSE v_extra END,
      'qty', v_qty, 'unit', round(v_unit, 2), 'sub', round(v_unit * v_qty, 2));
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

SELECT subcategory AS seccion, count(*) AS productos,
       count(*) FILTER (WHERE has_milk) AS con_leche
FROM public.shop_products
WHERE category = 'cafe' AND active
GROUP BY subcategory ORDER BY 1;
