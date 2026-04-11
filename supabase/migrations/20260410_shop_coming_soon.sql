-- Add coming_soon column to shop_products
ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS coming_soon boolean NOT NULL DEFAULT false;
