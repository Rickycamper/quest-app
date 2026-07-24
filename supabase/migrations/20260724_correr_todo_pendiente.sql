-- ═════════════════════════════════════════════════════════════════
-- QUEST — TODO LO PENDIENTE EN UN SOLO SCRIPT (jul 2026)
-- ═════════════════════════════════════════════════════════════════
-- Correr UNA vez en Supabase → SQL Editor. Es idempotente (se puede
-- correr de nuevo sin romper nada). Incluye, en orden:
--   1) posts.post_type  → separa Feed de Trade y Ventas (¡URGENTE!)
--   2) delete_community_message → invitados borran sus mensajes del chat
--   3) Pre orders: números TCG-####, Mis Pedidos, listo para retirar
--   4) Limpieza de datos de prueba (QA) que quedaron del debugging
-- ═════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- QUEST — Separar el feed de "Trade y Ventas"
-- ─────────────────────────────────────────────
-- El feed mostraba TODO mezclado (posts normales + Compro/Tengo/Tradeo/Vendo).
-- El tipo solo vivía como prefijo [Compro] en el caption. Agregamos una
-- columna real `post_type` y hacemos backfill de los posts viejos desde ese
-- prefijo. NULL = post normal (va al Feed); los demás van a "Trade y Ventas".
-- Aplicar en Supabase → SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS post_type text
  CHECK (post_type IN ('want', 'have', 'trade', 'sell'));

-- Backfill desde el prefijo del caption de los posts existentes
UPDATE public.posts SET post_type = 'want'  WHERE post_type IS NULL AND caption ILIKE '[Compro]%';
UPDATE public.posts SET post_type = 'have'  WHERE post_type IS NULL AND caption ILIKE '[Tengo]%';
UPDATE public.posts SET post_type = 'trade' WHERE post_type IS NULL AND caption ILIKE '[Tradeo]%';
UPDATE public.posts SET post_type = 'sell'  WHERE post_type IS NULL AND caption ILIKE '[Vendo]%';

-- Índice para las dos vistas (feed = post_type IS NULL / market = NOT NULL)
CREATE INDEX IF NOT EXISTS posts_type_created_idx
  ON public.posts (post_type, created_at DESC);

-- ─────────────────────────────────────────────
-- QUEST — Chat de comunidad: borrar mensajes propios (incluye invitados)
-- ─────────────────────────────────────────────
-- El autor logueado ya puede borrar por RLS, pero el invitado se identifica
-- por un guest_id que vive en su localStorage (RLS no lo puede validar). Esta
-- función SECURITY DEFINER valida la propiedad (logueado O invitado) o staff,
-- y borra. Aplicar en Supabase → SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_community_message(p_id uuid, p_guest_id text DEFAULT NULL)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.community_messages;
BEGIN
  SELECT * INTO v_row FROM public.community_messages WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF public.is_staff()
     OR (v_row.user_id IS NOT NULL AND v_row.user_id = auth.uid())
     OR (v_row.user_id IS NULL AND p_guest_id IS NOT NULL AND v_row.guest_id = p_guest_id)
  THEN
    DELETE FROM public.community_messages WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.delete_community_message(uuid, text) TO anon, authenticated;

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

-- Numerador compartido: lo usan create_preorder() (cliente) y las RESERVAS
-- que crea el staff (createReservation) — una sola secuencia por TCG.
CREATE OR REPLACE FUNCTION public.next_preorder_code(p_prefix text)
RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_n      integer;
BEGIN
  v_prefix := upper(regexp_replace(coalesce(p_prefix, ''), '[^A-Za-z0-9]', '', 'g'));
  IF v_prefix = '' THEN v_prefix := 'TCG'; END IF;
  v_prefix := left(v_prefix, 4);

  INSERT INTO public.preorder_counters AS c (prefix, n) VALUES (v_prefix, 1)
  ON CONFLICT (prefix) DO UPDATE SET n = c.n + 1
  RETURNING c.n INTO v_n;

  RETURN v_prefix || '-' || lpad(v_n::text, 4, '0');
END $$;

GRANT EXECUTE ON FUNCTION public.next_preorder_code(text) TO authenticated;

-- Las reservas que crea el staff también llevan número de orden, visible
-- para el cliente en "Mis Pedidos".
ALTER TABLE public.shop_reservations ADD COLUMN IF NOT EXISTS code text;
-- "Listo para retirar" + observación (ej. "mañana a partir de las 3pm")
ALTER TABLE public.shop_reservations ADD COLUMN IF NOT EXISTS ready_at timestamptz;
ALTER TABLE public.shop_reservations ADD COLUMN IF NOT EXISTS pickup_note text;
CREATE UNIQUE INDEX IF NOT EXISTS shop_reservations_code_idx
  ON public.shop_reservations (code) WHERE code IS NOT NULL;

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
  v_code   text;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 OR p_qty > 4 THEN
    RAISE EXCEPTION 'Cantidad inválida (máximo 4 por persona)';
  END IF;

  SELECT * INTO v_prod FROM public.shop_products WHERE public.shop_products.id = p_product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;
  IF NOT coalesce(v_prod.coming_soon, false) THEN
    RAISE EXCEPTION 'Este producto no está en pre order';
  END IF;

  v_code := public.next_preorder_code(p_prefix);

  RETURN QUERY
  INSERT INTO public.shop_preorders (code, product_id, product_name, game, qty, price, user_id, guest_id, customer_name)
  VALUES (v_code, v_prod.id, v_prod.name, v_prod.game, p_qty, v_prod.price,
          auth.uid(), CASE WHEN auth.uid() IS NULL THEN p_guest_id ELSE NULL END,
          nullif(trim(coalesce(p_customer, '')), ''))
  RETURNING public.shop_preorders.id, public.shop_preorders.code;
END $$;

GRANT EXECUTE ON FUNCTION public.create_preorder(uuid, integer, text, text, text) TO anon, authenticated;

-- ─────────────────────────────────────────────
-- 4) LIMPIEZA de datos de prueba del debugging (QA)
-- ─────────────────────────────────────────────
-- Mensajes de prueba en el chat de comunidad
DELETE FROM public.community_messages WHERE author_name IN ('__probe__', 'TesterQA');
-- Archivo de prueba del bucket de chat
DELETE FROM storage.objects WHERE bucket_id = 'chat' AND name LIKE 'MTG/test/%';
-- Post de prueba del diagnóstico de posts
DELETE FROM public.posts WHERE caption = '[QA] prueba diagnostico';
-- Cuentas QA del diagnóstico de signup (cascadea a profiles)
DELETE FROM auth.users WHERE email LIKE 'qa.claude.p%.20260720@gmail.com' OR email = 'qa.claude.prueba.20260720@gmail.com';
