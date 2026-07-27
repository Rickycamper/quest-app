-- ─────────────────────────────────────────────
-- QUEST — "Pre order cerrado"
-- ─────────────────────────────────────────────
-- Permite cortar un pre order: el público deja de ver las cantidades y no
-- puede pedir más; la tienda sigue viendo su inventario normalmente.
-- Aplicar en Supabase → SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS preorder_closed boolean NOT NULL DEFAULT false;
