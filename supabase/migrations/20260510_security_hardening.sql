-- ─────────────────────────────────────────────
-- QUEST — Security hardening
--
-- Closes verified holes without changing app behaviour:
-- 1. recalc_fecha_points should not be callable by anon (DoS surface)
-- 2. Caption / comment length limits to prevent DB bloat attacks
-- ─────────────────────────────────────────────

-- 1. Revoke EXECUTE on recalc_fecha_points from anon.
--    The app only calls this from staff-authenticated flows
--    (when entering positions in a fecha).
REVOKE EXECUTE ON FUNCTION public.recalc_fecha_points(uuid) FROM anon, public;

-- 2. Cap caption length on posts (5000 chars ~ 1000 words).
--    A malicious user could create 10 MB captions to bloat the DB.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='posts') THEN
    BEGIN
      ALTER TABLE public.posts
        ADD CONSTRAINT posts_caption_length CHECK (length(coalesce(caption, '')) <= 5000);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN check_violation THEN NULL;  -- existing data exceeds limit; skip
    END;
  END IF;
END $$;

-- 3. Cap comment length (2000 chars).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='post_comments') THEN
    BEGIN
      ALTER TABLE public.post_comments
        ADD CONSTRAINT post_comments_content_length CHECK (length(coalesce(content, '')) <= 2000);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN check_violation THEN NULL;
    END;
  END IF;
END $$;
