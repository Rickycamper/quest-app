-- ─────────────────────────────────────────────
-- QUEST — Números de PRE ORDER (control + ticket descargable)
-- ─────────────────────────────────────────────
-- Cada pre order recibe un código alfanumérico: iniciales del TCG + número
-- secuencial (MTG-0001, OP-0042, ...). El contador es por prefijo y vive en
-- preorder_counters; create_preorder() lo incrementa de forma atómica y
-- registra la orden en shop_preorders (control para el equipo).
-- Aplicar en Supabase → SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_preorders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,                    -- ej: MTG-0007
  product_id    uuid REFERENCES public.shop_products(id) ON DELETE SET NULL,
  product_name  text NOT NULL,
  game          text,
  qty           integer NOT NULL CHECK (qty BETWEEN 1 AND 4),
  price         numeric,
  user_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_id      text,                                    -- invitado (localStorage)
  customer_name text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_preorders_created_idx
  ON public.shop_preorders (created_at DESC);

ALTER TABLE public.shop_preorders ENABLE ROW LEVEL SECURITY;

-- Leer: staff (control) o el dueño logueado de la orden.
DROP POLICY IF EXISTS "preorders read" ON public.shop_preorders;
CREATE POLICY "preorders read" ON public.shop_preorders
  FOR SELECT USING (public.is_staff() OR user_id = (SELECT auth.uid()));

-- Escribir SOLO vía la función (SECURITY DEFINER) — sin insert directo.
REVOKE INSERT, UPDATE, DELETE ON public.shop_preorders FROM anon, authenticated;
GRANT  SELECT ON public.shop_preorders TO anon, authenticated;
GRANT  DELETE ON public.shop_preorders TO authenticated;  -- staff modera vía RLS

DROP POLICY IF EXISTS "preorders delete staff" ON public.shop_preorders;
CREATE POLICY "preorders delete staff" ON public.shop_preorders
  FOR DELETE USING (public.is_staff());

-- Contador por prefijo de TCG
CREATE TABLE IF NOT EXISTS public.preorder_counters (
  prefix text PRIMARY KEY,
  n      integer NOT NULL DEFAULT 0
);
REVOKE ALL ON public.preorder_counters FROM anon, authenticated;

-- Crea el pre order y devuelve { id, code }. Atómico: el UPSERT del contador
-- serializa la numeración aunque dos clientes pidan a la vez.
CREATE OR REPLACE FUNCTION public.create_preorder(
  p_product_id uuid,
  p_qty        integer,
  p_prefix     text,
  p_customer   text DEFAULT NULL,
  p_guest_id   text DEFAULT NULL
)
RETURNS TABLE (id uuid, code text)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prod   public.shop_products;
  v_n      integer;
  v_code   text;
  v_prefix text;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 OR p_qty > 4 THEN
    RAISE EXCEPTION 'Cantidad inválida (máximo 4 por persona)';
  END IF;

  SELECT * INTO v_prod FROM public.shop_products WHERE public.shop_products.id = p_product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;
  IF NOT coalesce(v_prod.coming_soon, false) THEN
    RAISE EXCEPTION 'Este producto no está en pre order';
  END IF;

  -- Prefijo saneado: solo letras/números, máx 4, mayúsculas. Fallback TCG.
  v_prefix := upper(regexp_replace(coalesce(p_prefix, ''), '[^A-Za-z0-9]', '', 'g'));
  IF v_prefix = '' THEN v_prefix := 'TCG'; END IF;
  v_prefix := left(v_prefix, 4);

  INSERT INTO public.preorder_counters AS c (prefix, n) VALUES (v_prefix, 1)
  ON CONFLICT (prefix) DO UPDATE SET n = c.n + 1
  RETURNING c.n INTO v_n;

  v_code := v_prefix || '-' || lpad(v_n::text, 4, '0');

  RETURN QUERY
  INSERT INTO public.shop_preorders (code, product_id, product_name, game, qty, price, user_id, guest_id, customer_name)
  VALUES (v_code, v_prod.id, v_prod.name, v_prod.game, p_qty, v_prod.price,
          auth.uid(), CASE WHEN auth.uid() IS NULL THEN p_guest_id ELSE NULL END,
          nullif(trim(coalesce(p_customer, '')), ''))
  RETURNING public.shop_preorders.id, public.shop_preorders.code;
END $$;

GRANT EXECUTE ON FUNCTION public.create_preorder(uuid, integer, text, text, text) TO anon, authenticated;
