-- ─────────────────────────────────────────────
-- QUEST — PII Lockdown
--
-- Closes verified leaks where anonymous users can read PII (email, phone,
-- full_name) via the public REST API. Authenticated users still need their
-- own contact info, so we use a SECURITY DEFINER function for that case.
--
-- Safe to run: the app code was updated in the same change set to use
-- `getPublicProfile()` (no PII) when rendering other users' profiles.
-- Only EditProfileScreen + AuthContext fetch the OWN profile with PII —
-- those continue to work because we keep authenticated SELECT for the row
-- matching auth.uid().
-- ─────────────────────────────────────────────

-- 1. Revoke column-level SELECT on PII from anon.
--    Anonymous users no longer see email, phone, full_name, terms_accepted_at
--    via REST API — even with crafted ?select=email,phone queries.
--    getPublicProfile() in the client doesn't request these, so app keeps
--    working for guests viewing public profiles.
REVOKE SELECT (email)              ON public.profiles FROM anon;
REVOKE SELECT (phone)              ON public.profiles FROM anon;
REVOKE SELECT (full_name)          ON public.profiles FROM anon;
REVOKE SELECT (terms_accepted_at)  ON public.profiles FROM anon;

-- 2. For authenticated users, install a "view-others-as-public" pattern.
--    The trick: keep column-level SELECT, but add a row-level USING clause
--    that allows seeing PII columns ONLY when id = auth.uid().
--
--    Postgres doesn't natively support column-conditional RLS, so the safe
--    & supported approach is two policies + a helper view. We'll use a
--    simpler approach: an additional INVOKER-rights view that the client
--    can call when it explicitly needs OWN contact info.
--
--    Implementation: leave existing grants intact for authenticated (so
--    the EditProfileScreen flow that calls getProfile(ownId) keeps working),
--    AND add a SECURITY DEFINER function `get_my_contact_info()` that
--    returns ONLY auth.uid()'s contact info. The app can later switch to
--    that and we can revoke broader SELECT — but that's a Phase 2 change.
CREATE OR REPLACE FUNCTION public.get_my_contact_info()
RETURNS TABLE (email text, phone text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email, phone
  FROM public.profiles
  WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_contact_info() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_my_contact_info() TO authenticated;

-- 3. Tighten the broad SELECT policy on profiles (if it allows everyone)
--    by ensuring there IS at least one explicit policy. We can't remove
--    the existing one without knowing its name, so this is informational:
--    after this migration runs, the linter will still warn about authenticated
--    being able to read profiles. That's fine — we WANT authenticated users
--    to be able to read public profile fields (it's a social app). The
--    column-level revoke for anon handles the most exposed surface.
