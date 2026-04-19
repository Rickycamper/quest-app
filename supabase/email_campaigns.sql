-- ─────────────────────────────────────────────────────────────────────────────
-- QUEST — Email Marketing Campaigns
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create table
CREATE TABLE IF NOT EXISTS email_campaigns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,                         -- internal label, e.g. "Apertura Panamá Capital"
  subject         TEXT        NOT NULL DEFAULT '',              -- email subject line
  html_body       TEXT        NOT NULL DEFAULT '',              -- full HTML of the email
  audience        TEXT        NOT NULL DEFAULT 'all',          -- 'all' | 'premium' | 'panama' | 'david' | 'chitre'
  status          TEXT        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'scheduled', 'sent')),
  recipient_count INT,                                          -- filled when sent (or preview count)
  sent_at         TIMESTAMPTZ,
  created_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. Row-level security — only the store owner can read or write campaigns
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_only" ON email_campaigns;
CREATE POLICY "owner_only" ON email_campaigns
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_owner = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_owner = true)
  );

-- 3. Auto-update updated_at on every change
CREATE OR REPLACE FUNCTION update_email_campaign_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_campaigns_updated_at ON email_campaigns;
CREATE TRIGGER trg_email_campaigns_updated_at
  BEFORE UPDATE ON email_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_email_campaign_ts();

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper view: recipient count per audience segment (read-only, no RLS needed)
-- Usage: SELECT * FROM email_audience_counts;
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW email_audience_counts AS
SELECT
  'all'     AS audience, COUNT(*)                              AS count FROM profiles
UNION ALL
SELECT 'premium',        COUNT(*) FROM profiles WHERE role = 'premium'
UNION ALL
SELECT 'panama',         COUNT(*) FROM profiles WHERE branch = 'Panama'
UNION ALL
SELECT 'david',          COUNT(*) FROM profiles WHERE branch = 'David'
UNION ALL
SELECT 'chitre',         COUNT(*) FROM profiles WHERE branch = 'Chitre';
