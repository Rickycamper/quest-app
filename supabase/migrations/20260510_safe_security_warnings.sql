-- ─────────────────────────────────────────────
-- QUEST — Safe security warnings fix
--
-- Only changes that are guaranteed NOT to affect the running app.
-- The other SECURITY DEFINER warnings from the linter are intentional
-- (the app calls those RPCs and revoking EXECUTE breaks features).
-- Those functions already have internal auth.uid() role checks where
-- needed (see 20260427_lint_function_security.sql).
-- ─────────────────────────────────────────────

-- 1. Pin search_path on set_updated_at trigger function.
--    Pure hardening — locks the function to the 'public' schema so
--    nothing in the call chain can hijack it via search_path. No
--    behaviour change for any caller. set_updated_at is a trigger
--    used to bump updated_at columns; not exposed to the REST API.
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- 2. Drop the broad SELECT policy on the public 'avatars' bucket.
--    The app only does .upload() and .getPublicUrl() — never .list()
--    or .download(). Public bucket URLs continue to work because
--    Supabase serves files from public buckets directly without
--    checking storage.objects policies. Removing this just prevents
--    clients from enumerating the bucket contents.
DROP POLICY IF EXISTS avatars_auth_read ON storage.objects;
