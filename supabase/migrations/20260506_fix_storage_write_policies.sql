-- ─────────────────────────────────────────────
-- QUEST — Fix missing storage write policies
--
-- All buckets previously had only SELECT policies.
-- INSERT / UPDATE / DELETE were never created, so any
-- upload attempt threw "new row violates row-level security".
--
-- Path pattern for all buckets: {user_id}/{filename}
-- → first folder segment always equals the uploader's user_id.
-- ─────────────────────────────────────────────

-- ══ avatars ════════════════════════════════════════════════════════════════════
-- Any authenticated user can upload/replace their own avatar.
-- Path: {user_id}/avatar.jpg

DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ══ posts ══════════════════════════════════════════════════════════════════════
-- Any authenticated user can upload images/videos for their own posts.
-- Path: {user_id}/{timestamp}_{uid}.{ext}

DROP POLICY IF EXISTS "posts_insert" ON storage.objects;
CREATE POLICY "posts_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'posts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "posts_update" ON storage.objects;
CREATE POLICY "posts_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'posts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "posts_delete" ON storage.objects;
CREATE POLICY "posts_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'posts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ══ packages ═══════════════════════════════════════════════════════════════════
-- Any authenticated user can upload package images.
-- Path: {user_id}/{timestamp}.{ext}

DROP POLICY IF EXISTS "packages_insert" ON storage.objects;
CREATE POLICY "packages_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'packages'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "packages_update" ON storage.objects;
CREATE POLICY "packages_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'packages'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "packages_delete" ON storage.objects;
CREATE POLICY "packages_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'packages'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ══ auctions ═══════════════════════════════════════════════════════════════════
-- Only staff/admin/owner can upload auction images.
-- Path: {user_id}/{timestamp}.{ext}

DROP POLICY IF EXISTS "auctions_insert" ON storage.objects;
CREATE POLICY "auctions_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'auctions'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND (is_owner OR role IN ('admin', 'staff'))
    )
  );

DROP POLICY IF EXISTS "auctions_update" ON storage.objects;
CREATE POLICY "auctions_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'auctions'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND (is_owner OR role IN ('admin', 'staff'))
    )
  );

DROP POLICY IF EXISTS "auctions_delete" ON storage.objects;
CREATE POLICY "auctions_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'auctions'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND (is_owner OR role IN ('admin', 'staff'))
    )
  );
