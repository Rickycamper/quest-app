-- ─────────────────────────────────────────────
-- QUEST — Datos de contacto del comprador online
-- ─────────────────────────────────────────────
-- Hasta ahora el pedido guardaba nombre y email tomados de PayPal, y no
-- guardaba teléfono. Para avisarle a alguien que su pedido está listo, el
-- teléfono es el dato que sirve — el email de PayPal puede ser uno que la
-- persona no mira nunca.
--
-- Ahora el checkout pide nombre, teléfono y email (precargados si la
-- persona está logueada) y se guardan tal como los escribió.
--
-- Requiere 20260728_fix_order_counter_ambiguo.sql.
-- Aplicar en SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS buyer_phone text;

-- Se dropea antes de recrear: agregar un parámetro cambia la firma y
-- CREATE OR REPLACE generaría una sobrecarga en vez de reemplazar.
DROP FUNCTION IF EXISTS public.place_paid_order(uuid, integer, text, numeric, text, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.place_paid_order(uuid, integer, text, numeric, text, uuid, text, text, text, text);

CREATE FUNCTION public.place_paid_order(
  p_product_id      uuid,
  p_qty             integer,
  p_branch          text,
  p_total           numeric,
  p_paypal_order_id text,
  p_user_id         uuid  DEFAULT NULL,
  p_buyer_name      text  DEFAULT NULL,
  p_buyer_email     text  DEFAULT NULL,
  p_status          text  DEFAULT 'paid',
  p_buyer_phone     text  DEFAULT NULL
)
RETURNS TABLE (code text, id uuid)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prod    public.shop_products;
  v_col     text;
  v_stock   integer;
  v_n       integer;
  v_code    text;
  v_status  text;
  v_existing public.shop_orders;
BEGIN
  SELECT * INTO v_existing FROM public.shop_orders
   WHERE public.shop_orders.paypal_order_id = p_paypal_order_id;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.code, v_existing.id;
    RETURN;
  END IF;

  IF p_qty IS NULL OR p_qty < 1 THEN
    RAISE EXCEPTION 'Cantidad inválida';
  END IF;

  v_status := CASE WHEN p_status = 'pending' THEN 'pending' ELSE 'paid' END;

  v_col := CASE p_branch
             WHEN 'david'  THEN 'qty_david'
             WHEN 'panama' THEN 'qty_panama'
             WHEN 'chitre' THEN 'qty_chitre'
           END;
  IF v_col IS NULL THEN RAISE EXCEPTION 'Sucursal inválida: %', p_branch; END IF;

  SELECT * INTO v_prod FROM public.shop_products
   WHERE public.shop_products.id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;
  IF coalesce(v_prod.coming_soon, false) THEN
    RAISE EXCEPTION 'Los pre orders no se pagan online';
  END IF;

  EXECUTE format('SELECT %I FROM public.shop_products WHERE id = $1', v_col)
    INTO v_stock USING p_product_id;

  IF coalesce(v_stock, 0) < p_qty THEN
    RAISE EXCEPTION 'Sin stock suficiente en esa sucursal (quedan %)', coalesce(v_stock, 0);
  END IF;

  EXECUTE format('UPDATE public.shop_products SET %I = %I - $1 WHERE id = $2', v_col, v_col)
    USING p_qty, p_product_id;

  -- `id` calificado: sin el prefijo resuelve al parámetro de salida `id`
  -- (uuid) en vez de a la columna order_counter.id (integer), y aborta.
  UPDATE public.order_counter SET n = n + 1
   WHERE public.order_counter.id = 1
   RETURNING n INTO v_n;

  v_code := 'QO-' || lpad(v_n::text, 4, '0');

  RETURN QUERY
  INSERT INTO public.shop_orders (
    code, product_id, product_name, qty, unit_price, total, branch,
    user_id, buyer_name, buyer_email, buyer_phone, paypal_order_id, status
  ) VALUES (
    v_code, v_prod.id, v_prod.name, p_qty, round(p_total / p_qty, 2), p_total, p_branch,
    p_user_id, p_buyer_name, p_buyer_email, p_buyer_phone, p_paypal_order_id, v_status
  )
  RETURNING public.shop_orders.code, public.shop_orders.id;
END $$;

-- REVOKE a PUBLIC, no solo a anon/authenticated: Postgres concede EXECUTE a
-- PUBLIC al crear la función y anon hereda de ahí.
REVOKE EXECUTE ON FUNCTION public.place_paid_order(uuid, integer, text, numeric, text, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.place_paid_order(uuid, integer, text, numeric, text, uuid, text, text, text, text) TO service_role;

-- El teléfono es PII: se lee solo desde el servidor o por el staff, igual
-- que el resto de la tabla (la política "orders read" ya lo cubre).
