-- ─────────────────────────────────────────────
-- QUEST — Pagos con PayPal en estado PENDING
-- ─────────────────────────────────────────────
-- PayPal no siempre libera el cobro al instante: puede dejarlo "retenido"
-- 24 h por una revisión de seguridad, o más si la cuenta de vendedor es
-- nueva (también pasa con eCheck). La plata YA se tomó del comprador.
--
-- Antes el servidor rechazaba esos cobros y NO creaba el pedido ni
-- reembolsaba: el cliente quedaba pagado y sin nada. Ahora el pedido se
-- registra con status 'pending' y el equipo no entrega hasta que PayPal
-- libere los fondos.
--
-- Requiere 20260726_paypal_orders.sql. Aplicar en SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

-- 1) 'pending' pasa a ser un status válido.
ALTER TABLE public.shop_orders DROP CONSTRAINT IF EXISTS shop_orders_status_check;
ALTER TABLE public.shop_orders ADD  CONSTRAINT shop_orders_status_check
  CHECK (status IN ('paid', 'pending', 'ready', 'delivered', 'refunded'));

-- 2) place_paid_order() recibe el status del cobro.
--    Se DROPEA antes de recrear: agregar un parámetro con DEFAULT crearía
--    una sobrecarga en vez de reemplazarla, y las dos versiones convivirían
--    generando llamadas ambiguas.
DROP FUNCTION IF EXISTS public.place_paid_order(uuid, integer, text, numeric, text, uuid, text, text);
DROP FUNCTION IF EXISTS public.place_paid_order(uuid, integer, text, numeric, text, uuid, text, text, text);

CREATE FUNCTION public.place_paid_order(
  p_product_id      uuid,
  p_qty             integer,
  p_branch          text,
  p_total           numeric,
  p_paypal_order_id text,
  p_user_id         uuid DEFAULT NULL,
  p_buyer_name      text DEFAULT NULL,
  p_buyer_email     text DEFAULT NULL,
  p_status          text DEFAULT 'paid'
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
  -- Idempotencia: ¿este cobro ya se registró?
  SELECT * INTO v_existing FROM public.shop_orders
   WHERE paypal_order_id = p_paypal_order_id;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.code, v_existing.id;
    RETURN;
  END IF;

  IF p_qty IS NULL OR p_qty < 1 THEN
    RAISE EXCEPTION 'Cantidad inválida';
  END IF;

  -- Solo se aceptan los dos estados de cobro tomado. Cualquier otra cosa
  -- sería un bug del servidor, no un caso de negocio.
  v_status := CASE WHEN p_status = 'pending' THEN 'pending' ELSE 'paid' END;

  v_col := CASE p_branch
             WHEN 'david'  THEN 'qty_david'
             WHEN 'panama' THEN 'qty_panama'
             WHEN 'chitre' THEN 'qty_chitre'
           END;
  IF v_col IS NULL THEN RAISE EXCEPTION 'Sucursal inválida: %', p_branch; END IF;

  -- Bloquea la fila del producto hasta el commit (evita sobreventa si dos
  -- personas compran la última unidad al mismo tiempo).
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

  -- El stock se descuenta también con 'pending': la unidad queda reservada.
  -- Si no, se podría vender dos veces mientras PayPal libera el pago.
  EXECUTE format('UPDATE public.shop_products SET %I = %I - $1 WHERE id = $2', v_col, v_col)
    USING p_qty, p_product_id;

  UPDATE public.order_counter SET n = n + 1 WHERE id = 1 RETURNING n INTO v_n;
  v_code := 'QO-' || lpad(v_n::text, 4, '0');

  RETURN QUERY
  INSERT INTO public.shop_orders (
    code, product_id, product_name, qty, unit_price, total, branch,
    user_id, buyer_name, buyer_email, paypal_order_id, status
  ) VALUES (
    v_code, v_prod.id, v_prod.name, p_qty, round(p_total / p_qty, 2), p_total, p_branch,
    p_user_id, p_buyer_name, p_buyer_email, p_paypal_order_id, v_status
  )
  RETURNING public.shop_orders.code, public.shop_orders.id;
END $$;

-- Solo el servidor la ejecuta (service role). Nadie más.
REVOKE EXECUTE ON FUNCTION public.place_paid_order(uuid, integer, text, numeric, text, uuid, text, text, text) FROM anon, authenticated;
