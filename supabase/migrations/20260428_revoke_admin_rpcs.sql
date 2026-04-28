-- ─────────────────────────────────────────────
-- QUEST — Revoke EXECUTE on admin-only functions from authenticated
--
-- set_user_points and adjust_user_points are admin/owner tools called
-- only from the internal dashboard, never from the public app frontend.
-- They already enforce an is_admin/is_owner check internally, but
-- exposing them to authenticated via /rest/v1/rpc is unnecessary surface.
--
-- Revoke from authenticated (and anon/public for safety).
-- The Supabase dashboard and any server-side calls use service_role,
-- which bypasses RLS and retains access regardless.
-- ─────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.set_user_points(uuid, integer)    FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.adjust_user_points(uuid, integer) FROM authenticated, anon, public;
