-- ─────────────────────────────────────────────
-- QUEST — Fix public bucket listing policies
-- Public buckets serve files by URL automatically (no policy needed)
-- These broad SELECT policies allow anyone to LIST all files — not needed
-- Fix: restrict listing to authenticated users only
-- ─────────────────────────────────────────────

-- auctions bucket
DROP POLICY IF EXISTS "auctions_public_read" ON storage.objects;
CREATE POLICY "auctions_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'auctions');

-- avatars bucket (has 2 duplicate policies)
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select"      ON storage.objects;
CREATE POLICY "avatars_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- packages bucket
DROP POLICY IF EXISTS "Public can read package images" ON storage.objects;
CREATE POLICY "packages_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'packages');

-- posts bucket
DROP POLICY IF EXISTS "posts_img_select" ON storage.objects;
CREATE POLICY "posts_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'posts');
