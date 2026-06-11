-- ─────────────────────────────────────────────
-- QUEST — Admins pueden gestionar la tienda y las reservas
-- ─────────────────────────────────────────────
-- Antes: shop_reservations era is_owner-only y shop_products write también,
-- así que los admins no podían crear/ver reservas (ni descontar inventario).
-- Alineamos con is_staff() = owner|staff|admin, igual que el resto del app.
-- Defensiva (to_regclass) e idempotente. Depende de is_staff().
-- ─────────────────────────────────────────────

-- shop_reservations: staff/admin/owner pueden CRUD; el usuario lee las suyas.
DO $$ BEGIN
  IF to_regclass('public.shop_reservations') IS NOT NULL THEN
    EXECUTE $q$DROP POLICY IF EXISTS "reservations_owner_all" ON public.shop_reservations$q$;
    EXECUTE $q$DROP POLICY IF EXISTS "reservations_staff_all" ON public.shop_reservations$q$;
    EXECUTE $q$CREATE POLICY "reservations_staff_all" ON public.shop_reservations FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff())$q$;
    EXECUTE $q$DROP POLICY IF EXISTS "reservations_user_read" ON public.shop_reservations$q$;
    EXECUTE $q$CREATE POLICY "reservations_user_read" ON public.shop_reservations FOR SELECT USING ((SELECT auth.uid()) = user_id)$q$;
  END IF;
END $$;

-- shop_products: permitir a staff/admin escribir (necesario para descontar/
-- restaurar inventario al crear/borrar reservas, y para co-gestionar la tienda).
-- Aditivo: NO quita la lectura pública existente (los clientes siguen viendo
-- el catálogo); solo agrega acceso de escritura al equipo.
DO $$ BEGIN
  IF to_regclass('public.shop_products') IS NOT NULL THEN
    EXECUTE $q$DROP POLICY IF EXISTS "shop_products_staff_write" ON public.shop_products$q$;
    EXECUTE $q$CREATE POLICY "shop_products_staff_write" ON public.shop_products FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff())$q$;
  END IF;
END $$;
