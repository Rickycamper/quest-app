-- ─────────────────────────────────────────────
-- QUEST — Auditoría y cierre de funciones SECURITY DEFINER
-- ─────────────────────────────────────────────
-- Origen: place_paid_order() resultó ejecutable con la anon key EN PROD,
-- pese a que las migraciones de abril (20260427_*) ya habían intentado el
-- cierre global. Conclusión: o no corrieron enteras en prod, o funciones
-- creadas después renacieron con permisos heredados. Este script no asume
-- nada del repo: recorre pg_proc EN VIVO, así que también alcanza funciones
-- que existen solo en prod.
--
-- Qué hace:
--   1. Revoca EXECUTE de PUBLIC en todo el schema (la fuente de la herencia)
--      y lo bloquea para funciones futuras.
--   2. Recorre TODA función SECURITY DEFINER y le revoca anon+authenticated,
--      garantizando a la vez EXECUTE para service_role.
--   3. Re-otorga exactamente lo que la app llama vía supabase.rpc()
--      (allowlist sacada de grep sobre src/ y api/ — commit 961afc5).
--   4. Imprime el estado final para verificar.
--
-- Los permisos de rol son la primera puerta; los chequeos internos
-- (is_staff(), propiedad) siguen vigentes dentro de cada función.
--
-- Aplicar en SQL Editor. Idempotente. Pegar el resultado del SELECT final.
-- ─────────────────────────────────────────────

-- ── 1. Cortar la herencia de PUBLIC ──────────────────────────────────────────
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ── 2. Cerrar TODA función SECURITY DEFINER (incluidas las que solo viven
--       en prod) y asegurar service_role ────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT format('public.%I(%s)', p.proname,
                  pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', r.sig);
      EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO service_role',           r.sig);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'saltada %: %', r.sig, SQLERRM;
    END;
  END LOOP;
END $$;

-- ── 3a. Re-otorgar a AUTHENTICATED lo que la app llama logueada ─────────────
-- Fuente: grep de supabase.rpc() en src/. Los chequeos finos (staff, dueño)
-- viven DENTRO de cada función.
DO $$
DECLARE
  nombres text[] := ARRAY[
    'approve_redemption', 'award_points', 'create_notification',
    'create_package_as_user', 'create_preorder', 'delete_community_message',
    'end_auction', 'get_game_leaderboard', 'get_my_contact_info',
    'get_package_recipient_phone', 'membership_usage_summary',
    'next_preorder_code', 'notify_auction_watchers', 'place_bid',
    'recalc_fecha_points', 'redeem_points', 'reject_redemption',
    'respond_to_match', 'set_deck_card_image', 'set_package_recipient_phone',
    'upsert_deck_cards_batch',
    -- admin UI (guardas is_staff internas, agregadas en 20260427):
    'adjust_user_points', 'set_user_points',
    -- usada por políticas RLS al evaluar consultas de usuarios logueados:
    'is_staff'
  ];
  r record;
BEGIN
  FOR r IN
    SELECT format('public.%I(%s)', p.proname,
                  pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (nombres)
  LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'saltada %: %', r.sig, SQLERRM;
    END;
  END LOOP;
END $$;

-- ── 3b. Re-otorgar a ANON solo lo que usan los INVITADOS ────────────────────
-- La tienda y el chat son públicos:
--   is_staff                 → la llaman las políticas RLS también para anon
--                              (ya se rompió una vez: 20260427_restore_is_staff_grant)
--   delete_community_message → invitados borran sus mensajes (guest_id)
--   create_preorder /
--   next_preorder_code       → invitados pueden pre-ordenar (p_guest_id)
--   get_game_leaderboard     → el ranking se ve sin cuenta
DO $$
DECLARE
  nombres text[] := ARRAY[
    'is_staff', 'delete_community_message',
    'create_preorder', 'next_preorder_code', 'get_game_leaderboard'
  ];
  r record;
BEGIN
  FOR r IN
    SELECT format('public.%I(%s)', p.proname,
                  pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (nombres)
  LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.sig);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'saltada %: %', r.sig, SQLERRM;
    END;
  END LOOP;
END $$;

-- ── 4. Estado final — pegar este resultado ───────────────────────────────────
-- Esperado: anon=true SOLO en las 5 de invitados; authenticated=true solo en
-- la allowlist; el resto todo false. service_role=true en todas.
SELECT
  p.proname                                            AS funcion,
  has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
  has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
ORDER BY has_function_privilege('anon', p.oid, 'EXECUTE') DESC,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') DESC,
         p.proname;
