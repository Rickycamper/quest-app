-- ─────────────────────────────────────────────
-- QUEST — Fix "Auth RLS Initialization Plan" warnings
--
-- auth.uid() / auth.role() inside RLS policies are volatile function calls
-- that PostgreSQL re-evaluates once per row. Wrapping them in a subquery
-- (SELECT auth.uid()) makes PostgreSQL treat them as stable, evaluating once
-- per query — materially faster on large tables.
--
-- This DO block reads pg_policies for every policy in the public schema that
-- contains bare auth.*() calls, replaces them, and applies with ALTER POLICY.
-- Covers all tables including posts (dashboard-created policies not in files).
-- ─────────────────────────────────────────────

DO $$
DECLARE
  r         RECORD;
  new_qual  text;
  new_check text;
  changed   boolean;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        qual       LIKE '%auth.uid()%'  OR qual       LIKE '%auth.role()%'
        OR with_check LIKE '%auth.uid()%' OR with_check LIKE '%auth.role()%'
      )
  LOOP
    new_qual  := r.qual;
    new_check := r.with_check;
    changed   := false;

    -- Replace bare auth.uid() → (SELECT auth.uid())
    -- Guard: skip if already wrapped to avoid double-nesting
    IF new_qual IS NOT NULL
       AND new_qual LIKE '%auth.uid()%'
       AND new_qual NOT LIKE '%(SELECT auth.uid())%'
    THEN
      new_qual := replace(new_qual, 'auth.uid()', '(SELECT auth.uid())');
      changed  := true;
    END IF;

    IF new_check IS NOT NULL
       AND new_check LIKE '%auth.uid()%'
       AND new_check NOT LIKE '%(SELECT auth.uid())%'
    THEN
      new_check := replace(new_check, 'auth.uid()', '(SELECT auth.uid())');
      changed   := true;
    END IF;

    -- Replace bare auth.role() → (SELECT auth.role())
    IF new_qual IS NOT NULL
       AND new_qual LIKE '%auth.role()%'
       AND new_qual NOT LIKE '%(SELECT auth.role())%'
    THEN
      new_qual := replace(new_qual, 'auth.role()', '(SELECT auth.role())');
      changed  := true;
    END IF;

    IF new_check IS NOT NULL
       AND new_check LIKE '%auth.role()%'
       AND new_check NOT LIKE '%(SELECT auth.role())%'
    THEN
      new_check := replace(new_check, 'auth.role()', '(SELECT auth.role())');
      changed   := true;
    END IF;

    IF NOT changed THEN CONTINUE; END IF;

    BEGIN
      IF new_qual IS NOT NULL AND new_check IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
          r.policyname, r.schemaname, r.tablename,
          new_qual, new_check
        );
      ELSIF new_qual IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON %I.%I USING (%s)',
          r.policyname, r.schemaname, r.tablename, new_qual
        );
      ELSIF new_check IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
          r.policyname, r.schemaname, r.tablename, new_check
        );
      END IF;
      RAISE NOTICE 'Fixed: % on %.%', r.policyname, r.schemaname, r.tablename;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped: % on %.% — %',
        r.policyname, r.schemaname, r.tablename, SQLERRM;
    END;
  END LOOP;
END $$;
