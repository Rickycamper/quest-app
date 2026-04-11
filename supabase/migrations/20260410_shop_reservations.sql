-- ─────────────────────────────────────────────
-- QUEST — Shop Reservations (Pre-orders)
-- Owner tags a user, sets qty + paid %, user gets notified
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_reservations (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id  uuid        NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  qty         integer     NOT NULL DEFAULT 1,
  paid_pct    integer     NOT NULL DEFAULT 50 CHECK (paid_pct IN (50, 100)),
  branch      text        NOT NULL DEFAULT 'david' CHECK (branch IN ('david', 'panama', 'chitre')),
  notes       text,
  created_by  uuid        REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.shop_reservations ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
DROP POLICY IF EXISTS "reservations_owner_all" ON public.shop_reservations;
CREATE POLICY "reservations_owner_all" ON public.shop_reservations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_owner = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_owner = true)
  );

-- Users can read their own reservations
DROP POLICY IF EXISTS "reservations_user_read" ON public.shop_reservations;
CREATE POLICY "reservations_user_read" ON public.shop_reservations
  FOR SELECT USING (user_id = auth.uid());
