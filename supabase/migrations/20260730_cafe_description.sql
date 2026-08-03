-- ─────────────────────────────────────────────
-- QUEST CAFÉ — Descripción del producto
-- ─────────────────────────────────────────────
-- La ficha del producto (la que se abre al tocar una card del menú) muestra
-- un párrafo describiendo la bebida. shop_products no tenía dónde guardarlo.
--
-- El cliente TOLERA que esta columna no exista: si el select falla por
-- `description`, reintenta sin ella y el menú funciona igual (sin texto en
-- la ficha). Por eso se puede desplegar el código antes de correr esto.
--
-- Aplicar en SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS description text;
