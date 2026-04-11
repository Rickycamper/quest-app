-- Add category + subcategory to shop_products
ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS category    text NOT NULL DEFAULT 'sealed',  -- 'sealed' | 'single' | 'accessory'
  ADD COLUMN IF NOT EXISTS subcategory text;                             -- accessories: 'sleeve'|'playmat'|'dado'|'deckbox'|'other'

-- All existing products are sealed
UPDATE public.shop_products SET category = 'sealed' WHERE category IS NULL OR category = '';

-- Subcategory for sealed/single = the game field (already exists)
-- Subcategory for accessories = sleeve/playmat/dado/deckbox/other
