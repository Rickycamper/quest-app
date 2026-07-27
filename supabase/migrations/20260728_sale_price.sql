-- ─────────────────────────────────────────────
-- QUEST — Precio de OFERTA (descuento público)
-- ─────────────────────────────────────────────
-- El equipo carga un precio de oferta y el público ve el precio normal
-- tachado + el de oferta. NULL o 0 = sin descuento. Solo se aplica si es
-- MENOR al precio normal (la UI y el checkout lo validan).
-- Aplicar en Supabase → SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS sale_price numeric;
