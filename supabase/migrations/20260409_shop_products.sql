-- ─────────────────────────────────────────────
-- QUEST — Shop Products
-- Owner-managed product catalog with per-branch inventory
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shop_products (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  sku         text    NOT NULL UNIQUE,
  name        text    NOT NULL,
  game        text,                          -- 'MTG' | 'Pokemon' | 'Gundam' | 'One Piece'
  price       numeric(10,2) NOT NULL DEFAULT 0,
  image_url   text,                          -- fetched from Coqui API
  qty_david   integer NOT NULL DEFAULT 0,    -- Sucursal David
  qty_panama  integer NOT NULL DEFAULT 0,    -- Sucursal Panamá
  qty_chitre  integer NOT NULL DEFAULT 0,    -- Sucursal Chitré
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_read_all"    ON public.shop_products;
DROP POLICY IF EXISTS "shop_owner_write" ON public.shop_products;

-- Anyone can read active products
CREATE POLICY "shop_read_all" ON public.shop_products
  FOR SELECT USING (true);

-- Only owner can write
CREATE POLICY "shop_owner_write" ON public.shop_products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_owner = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_owner = true
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS shop_products_updated_at ON public.shop_products;
CREATE TRIGGER shop_products_updated_at
  BEFORE UPDATE ON public.shop_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Seed data from Sales Order SO 0088857 ────────────────────────────
-- Quantities to Boquete (primary location); Federal Mall starts at 0
-- Prices = MSRP where available; owner can adjust anytime
-- ─────────────────────────────────────────────────────────────────────
-- qty_david, qty_panama, qty_chitre — admin sets per branch from the app
-- Quantities split equally across David / Panamá / Chitré
-- Remainder (when not divisible by 3) goes to David
INSERT INTO public.shop_products (sku, name, game, price, qty_david, qty_panama, qty_chitre, sort_order) VALUES
--                                                                               David  Panamá Chitré  Total
  ('WOCD5168SP',     'TMNT Prerelease Pack (Español)',                            'MTG',       35.00, 10, 10, 10,  1), -- 30
  ('WOCD5163',       'TMNT Play Booster Display',                                 'MTG',      209.70,  2,  2,  2,  2), -- 6
  ('WOCD5165',       'TMNT Collector''s Booster Display',                         'MTG',      455.88,  2,  2,  2,  3), -- 6
  ('WOCD5169',       'TMNT Commander Deck Display (4 Mazos)',                     'MTG',      279.96,  1,  1,  0,  4), -- 2
  ('WOCD5170',       'TMNT Bundle',                                               'MTG',       69.99,  2,  2,  2,  5), -- 6
  ('WOCD5174',       'TMNT Draft Night Box',                                      'MTG',      119.99,  1,  1,  0,  6), -- 2
  ('WOCD5171',       'TMNT Pizza Bundle',                                         'MTG',       99.99,  2,  1,  1,  7), -- 4
  ('PKU10371-106SP', 'Mega Evolution 03 Perfect Order Pre-Release Kit (Español)', 'Pokemon',  259.99,  1,  1,  1,  8), -- 3
  ('PKU10302',       'Mega Evolution 02.5 Ascended Heroes Premium Poster Collection (6u)', 'Pokemon', 299.94, 2, 1, 1, 9), -- 4
  ('PKU10358',       'First Partner Illustration Collection Serie 1 (6u)',        'Pokemon',   89.94,  4,  4,  4, 10), -- 12
  ('PKU10372',       'Mega Evolution 03 Perfect Order Elite Trainer Box',         'Pokemon',   49.99, 10, 10, 10, 11), -- 30
  ('PKU10375',       'Mega Evolution 03 - 3-Booster Blister Case (24 Blisters)', 'Pokemon',  335.76,  1,  0,  0, 12), -- 1
  ('PKU10377',       'Mega Evolution 03 - Booster Bundle',                        'Pokemon',   26.94,  7,  7,  6, 13), -- 20
  ('PKU10378',       'Mega Evolution 03 - Sleeved Booster Case (144 packs)',      'Pokemon',  646.56,  1,  0,  0, 14), -- 1
  ('PKU10380',       'Mega Evolution 03 - Booster Display (36 Packs)',            'Pokemon',  161.64,  3,  3,  2, 15), -- 8
  ('BAN2820796',     'Gundam Assemble Premium Set - Iron Blooded Orphans [PC01A]', 'Gundam', 159.96,  1,  0,  0, 16), -- 1
  ('BAN2820797',     'Gundam Assemble Premium Set - GQuuuuuuX [PC02A]',          'Gundam',   159.96,  1,  0,  0, 17), -- 1
  ('BAN2828968',     'Gundam Premium Accessory Set - Mobile Suit WING (PB01)',    'Gundam',    89.99,  1,  1,  0, 18), -- 2
  ('BAN2839368',     'Gundam Ultimate Deck Display-01 [ST09] (6 Mazos)',          'Gundam',   239.94,  1,  1,  0, 19), -- 2
  ('BAN2835217',     'One Piece TCG: Japanese 3rd Anniversary Set',               'One Piece', 200.00, 2,  1,  1, 20), -- 4
  ('BAN2835213',     'One Piece TCG: Adventure on Kami''s Island Booster Display OP-15 (24u)', 'One Piece', 107.76, 20, 20, 20, 21) -- 60
ON CONFLICT (sku) DO NOTHING;
