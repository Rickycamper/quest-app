-- ─────────────────────────────────────────────
-- QUEST — Pagos online con PayPal (SOLO productos EN STOCK)
-- ─────────────────────────────────────────────
-- Los pre orders NO se pagan online a propósito: tardan meses, y ahí es
-- donde pegan las disputas y los reembolsos vencidos de PayPal (>180 días).
-- Online solo se vende lo que ya está en la tienda y se puede retirar.
--
-- El pedido lo crea el SERVIDOR (función serverless con service role) recién
-- DESPUÉS de que PayPal confirma el cobro. El cliente nunca escribe acá.
-- Aplicar en Supabase → SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,              -- QO-0001
  product_id      uuid REFERENCES public.shop_products(id) ON DELETE SET NULL,
  product_name    text NOT NULL,
  qty             integer NOT NULL CHECK (qty >= 1),
  unit_price      numeric NOT NULL,
  total           numeric NOT NULL,
  branch          text NOT NULL,                     -- david | panama | chitre
  user_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  buyer_name      text,
  buyer_email     text,
  paypal_order_id text UNIQUE,                       -- idempotencia del cobro
  status          text NOT NULL DEFAULT 'paid'
                    CHECK (status IN ('paid', 'ready', 'delivered', 'refunded')),
  ready_at        timestamptz,
  pickup_note     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_orders_created_idx ON public.shop_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS shop_orders_user_idx    ON public.shop_orders (user_id);

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

-- Leer: staff (gestión) o el dueño del pedido.
DROP POLICY IF EXISTS "orders read" ON public.shop_orders;
CREATE POLICY "orders read" ON public.shop_orders
  FOR SELECT USING (public.is_staff() OR user_id = (SELECT auth.uid()));

-- Staff marca listo para retirar / entregado.
DROP POLICY IF EXISTS "orders staff update" ON public.shop_orders;
CREATE POLICY "orders staff update" ON public.shop_orders
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Nadie inserta desde el cliente: solo el servidor (service role saltea RLS).
REVOKE INSERT, DELETE ON public.shop_orders FROM anon, authenticated;
GRANT  SELECT ON public.shop_orders TO anon, authenticated;
GRANT  UPDATE ON public.shop_orders TO authenticated;

-- Contador de pedidos online (secuencia propia: QO-0001, QO-0002…)
CREATE TABLE IF NOT EXISTS public.order_counter (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  n  integer NOT NULL DEFAULT 0
);
INSERT INTO public.order_counter (id, n) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON public.order_counter FROM anon, authenticated;

-- ─────────────────────────────────────────────
-- place_paid_order() — TODO en una transacción:
--   1) valida stock de esa sucursal,
--   2) descuenta el stock,
--   3) numera y registra el pedido.
-- Si el stock no alcanza, lanza excepción y NADA se aplica (el servidor
-- reembolsa el cobro). Idempotente por paypal_order_id: si el capture se
-- reintenta, devuelve el pedido ya creado en vez de descontar dos veces.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.place_paid_order(
  p_product_id      uuid,
  p_qty             integer,
  p_branch          text,
  p_total           numeric,
  p_paypal_order_id text,
  p_user_id         uuid DEFAULT NULL,
  p_buyer_name      text DEFAULT NULL,
  p_buyer_email     text DEFAULT NULL
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
    user_id, buyer_name, buyer_email, paypal_order_id
  ) VALUES (
    -- unit_price = lo que realmente se pagó por unidad (respeta la oferta)
    v_code, v_prod.id, v_prod.name, p_qty, round(p_total / p_qty, 2), p_total, p_branch,
    p_user_id, p_buyer_name, p_buyer_email, p_paypal_order_id
  )
  RETURNING public.shop_orders.code, public.shop_orders.id;
END $$;

-- Solo el servidor la ejecuta (service role). Nadie más.
-- OJO: hay que revocarle a PUBLIC, no solo a anon/authenticated. Postgres
-- concede EXECUTE a PUBLIC al crear la función y anon hereda de ahí — sin
-- esta línea la función queda abierta a cualquiera con la anon key.
REVOKE EXECUTE ON FUNCTION public.place_paid_order(uuid, integer, text, numeric, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.place_paid_order(uuid, integer, text, numeric, text, uuid, text, text) TO service_role;
