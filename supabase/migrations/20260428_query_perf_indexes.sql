-- ─────────────────────────────────────────────
-- QUEST — Query performance indexes
--
-- Based on slow query analysis:
-- 1. shop_products: WHERE active = true ORDER BY sort_order ASC → composite index
-- 2. notifications: WHERE user_id = $1 ORDER BY created_at DESC → composite index
--    (two separate indexes are less efficient than one covering index)
-- ─────────────────────────────────────────────

-- shop_products: covers the active product listing query
CREATE INDEX IF NOT EXISTS idx_shop_products_active_sort
  ON public.shop_products (active, sort_order ASC)
  WHERE active = true;

-- notifications: covers the per-user fetch sorted by newest first
-- Replaces the need to use idx_notifications_user_id + idx_notifications_created_at separately
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
