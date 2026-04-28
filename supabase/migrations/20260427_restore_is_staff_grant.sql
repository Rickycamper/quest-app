-- ─────────────────────────────────────────────
-- QUEST — Restore EXECUTE on is_staff() for authenticated + anon
-- Regression introduced by 20260427_lint_function_security.sql:
-- Revoking is_staff() from 'authenticated' breaks any RLS policy that
-- calls is_staff() — policies evaluate in the caller's role context, so
-- authenticated must be able to invoke the function.
-- is_staff() is safe to expose: it only reads whether auth.uid() is staff,
-- it is SECURITY DEFINER with a fixed search_path, and it returns a boolean.
-- ─────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
-- anon also needs it so RLS policies work on public/unauthenticated reads
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon;
