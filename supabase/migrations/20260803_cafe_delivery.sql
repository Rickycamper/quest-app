-- ─────────────────────────────────────────────
-- QUEST CAFÉ — Delivery en radio de 1 km
-- ─────────────────────────────────────────────
-- · cafe_settings: interruptor del delivery (el staff lo prende y apaga
--   desde el propio café, sin redeploy) + coordenadas del local + radio.
-- · cafe_orders: modo 'delivery' + dirección + coordenadas del cliente.
-- · place_cafe_order(): si es delivery, valida EN LA BASE que el punto
--   esté dentro del radio (haversine) y que el delivery esté prendido.
--
-- OJO: lat/lng traen un placeholder (Ciudad de Panamá). Hay que ponerle
-- las coordenadas REALES del local con un UPDATE (abajo está el ejemplo).
--
-- Aplicar en SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cafe_settings (
  id               integer PRIMARY KEY CHECK (id = 1),
  delivery_enabled boolean NOT NULL DEFAULT true,
  lat              numeric NOT NULL DEFAULT 8.9936,
  lng              numeric NOT NULL DEFAULT -79.5197,
  radius_m         integer NOT NULL DEFAULT 1000
);
INSERT INTO public.cafe_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.cafe_settings ENABLE ROW LEVEL SECURITY;

-- Leer: todos (el cliente necesita saber si hay delivery y dónde está el local)
DROP POLICY IF EXISTS "cafe settings read" ON public.cafe_settings;
CREATE POLICY "cafe settings read" ON public.cafe_settings
  FOR SELECT USING (true);

-- Cambiar: solo el equipo
DROP POLICY IF EXISTS "cafe settings staff update" ON public.cafe_settings;
CREATE POLICY "cafe settings staff update" ON public.cafe_settings
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());

REVOKE ALL ON public.cafe_settings FROM PUBLIC;
GRANT  SELECT ON public.cafe_settings TO anon, authenticated;
GRANT  UPDATE (delivery_enabled, lat, lng, radius_m) ON public.cafe_settings TO authenticated;
GRANT  ALL ON public.cafe_settings TO service_role;

-- ── cafe_orders: modo delivery + datos de entrega ──
ALTER TABLE public.cafe_orders
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_lat numeric,
  ADD COLUMN IF NOT EXISTS delivery_lng numeric;

ALTER TABLE public.cafe_orders DROP CONSTRAINT IF EXISTS cafe_orders_modo_check;
ALTER TABLE public.cafe_orders ADD CONSTRAINT cafe_orders_modo_check
  CHECK (modo IN ('tienda', 'llevar', 'delivery'));

-- ── place_cafe_order con delivery ──
DROP FUNCTION IF EXISTS public.place_cafe_order(jsonb, text, text, text, text);
DROP FUNCTION IF EXISTS public.place_cafe_order(jsonb, text, text, text, text, text, numeric, numeric);

CREATE FUNCTION public.place_cafe_order(
  p_items   jsonb,
  p_modo    text DEFAULT 'tienda',
  p_name    text DEFAULT NULL,
  p_phone   text DEFAULT NULL,
  p_note    text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_lat     numeric DEFAULT NULL,
  p_lng     numeric DEFAULT NULL
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
  v_set     record;
  v_dist    numeric;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 20 THEN
    RAISE EXCEPTION 'Pedido inválido';
  END IF;
  IF p_modo NOT IN ('tienda', 'llevar', 'delivery') THEN
    RAISE EXCEPTION 'Modo inválido';
  END IF;

  -- Delivery: prendido, con ubicación dentro del radio, y con dirección.
  IF p_modo = 'delivery' THEN
    SELECT * INTO v_set FROM public.cafe_settings WHERE public.cafe_settings.id = 1;
    IF NOT FOUND OR NOT v_set.delivery_enabled THEN
      RAISE EXCEPTION 'El delivery está apagado ahora mismo';
    END IF;
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RAISE EXCEPTION 'Falta tu ubicación para el delivery';
    END IF;
    v_dist := 2 * 6371000 * asin(sqrt(
      power(sin(radians(p_lat - v_set.lat) / 2), 2) +
      cos(radians(v_set.lat)) * cos(radians(p_lat)) *
      power(sin(radians(p_lng - v_set.lng) / 2), 2)
    ));
    IF v_dist > v_set.radius_m THEN
      RAISE EXCEPTION 'Fuera de la zona de delivery (estás a % m)', round(v_dist);
    END IF;
    IF nullif(btrim(coalesce(p_address, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Falta la dirección de entrega';
    END IF;
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
    code, items, total, modo, customer_name, customer_phone, note, user_id,
    delivery_address, delivery_lat, delivery_lng
  ) VALUES (
    v_code, v_lineas, round(v_total, 2), p_modo,
    nullif(left(btrim(coalesce(p_name,  '')), 60),  ''),
    nullif(left(btrim(coalesce(p_phone, '')), 40),  ''),
    nullif(left(btrim(coalesce(p_note,  '')), 200), ''),
    auth.uid(),
    CASE WHEN p_modo = 'delivery' THEN nullif(left(btrim(coalesce(p_address, '')), 160), '') END,
    CASE WHEN p_modo = 'delivery' THEN p_lat END,
    CASE WHEN p_modo = 'delivery' THEN p_lng END
  )
  RETURNING public.cafe_orders.code, public.cafe_orders.id, public.cafe_orders.total;
END $$;

REVOKE EXECUTE ON FUNCTION public.place_cafe_order(jsonb, text, text, text, text, text, numeric, numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.place_cafe_order(jsonb, text, text, text, text, text, numeric, numeric) TO anon, authenticated, service_role;

-- ── PONER LAS COORDENADAS REALES DEL LOCAL ──
-- UPDATE public.cafe_settings SET lat = X.XXXXXX, lng = -XX.XXXXXX WHERE id = 1;

SELECT delivery_enabled, lat, lng, radius_m FROM public.cafe_settings WHERE id = 1;
