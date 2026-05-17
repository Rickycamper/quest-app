-- ─────────────────────────────────────────────
-- QUEST — Restore narrow SELECT policy on avatars bucket
--
-- Earlier today we dropped `avatars_auth_read` to address a linter warning
-- about the bucket allowing public listing. That worked in theory but broke
-- avatar uploads in practice: the Supabase Storage SDK's `.upload({ upsert: true })`
-- internally does a HEAD/SELECT to decide INSERT vs UPDATE. With NO SELECT
-- policy, that check fails and the upload returns the misleading
-- "new row violates row-level security policy" error.
--
-- Fix: re-add SELECT, but scoped to the user's OWN avatar file only —
-- much tighter than the original "anyone with auth can list all files".
-- ─────────────────────────────────────────────

CREATE POLICY avatars_select_own
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
