-- ─────────────────────────────────────────────────────────────────────────────
-- QUEST — Membership tiers + usage tracking
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Allow new role values (wizard / mage / archmage) alongside existing ones.
--    Drop the old CHECK and add a wider one.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('client','staff','admin','premium','wizard','mage','archmage'));

-- 2. Usage log — one row per benefit consumed
CREATE TABLE IF NOT EXISTS membership_usage (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  benefit      TEXT        NOT NULL CHECK (benefit IN ('booster','tournament')),
  branch       TEXT,                                        -- which branch registered it
  recorded_by  UUID        REFERENCES profiles(id),        -- which admin logged it
  used_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE membership_usage ENABLE ROW LEVEL SECURITY;

-- Members can read their own log
CREATE POLICY "member_read_own" ON membership_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Staff / admin / owner can insert and read all
CREATE POLICY "staff_all" ON membership_usage
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (role IN ('staff','admin') OR is_owner = true)
    )
  );

-- 3. Helper function: monthly usage summary for one user
--    Returns rows: { benefit, used, allowed }
CREATE OR REPLACE FUNCTION public.membership_usage_summary(p_user_id uuid)
RETURNS TABLE(benefit text, used bigint, allowed integer)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH counts AS (
    SELECT mu.benefit, COUNT(*) AS used
    FROM   membership_usage mu
    WHERE  mu.user_id   = p_user_id
      AND  mu.used_at  >= date_trunc('month', now())
    GROUP  BY mu.benefit
  ),
  tier AS (
    SELECT role FROM profiles WHERE id = p_user_id
  )
  SELECT
    b.benefit,
    COALESCE(c.used, 0) AS used,
    CASE
      WHEN t.role = 'wizard'   THEN b.allowed_wizard
      WHEN t.role = 'mage'     THEN b.allowed_mage
      WHEN t.role = 'archmage' THEN b.allowed_archmage
      WHEN t.role = 'premium'  THEN b.allowed_wizard   -- legacy
      ELSE 0
    END AS allowed
  FROM (VALUES
    ('booster',    1, 2, 3),
    ('tournament', 1, 2, 3)
  ) AS b(benefit, allowed_wizard, allowed_mage, allowed_archmage)
  CROSS JOIN tier t
  LEFT  JOIN counts c USING (benefit)
$$;

GRANT EXECUTE ON FUNCTION public.membership_usage_summary(uuid) TO authenticated;
