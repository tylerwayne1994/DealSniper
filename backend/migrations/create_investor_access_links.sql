-- Investor Access Links
-- Lets a sponsor (GP) generate a short access code for a specific deal's
-- investor-facing Deal Room / pitch deck, and hand that code (or a link
-- containing it) to an investor. The investor never logs in — they just
-- enter the code on the public /investor gateway page and are routed
-- straight to that one deal's pitch deck, nothing else.
--
-- All reads/writes to this table happen through the backend (FastAPI) using
-- the Supabase service role key, which bypasses RLS. RLS is still enabled
-- with an explicit sponsor-only policy so a logged-in sponsor's own
-- Supabase client session could also manage their links directly if needed;
-- there is deliberately NO public/anon policy, since code redemption for
-- unauthenticated investors is only ever done server-side after validating
-- the code, expiry, and revoked status.
-- Run against your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS investor_access_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT NOT NULL,
  sponsor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_code TEXT NOT NULL UNIQUE,
  investor_name TEXT,
  investor_email TEXT,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investor_access_links_deal ON investor_access_links(deal_id);
CREATE INDEX IF NOT EXISTS idx_investor_access_links_sponsor ON investor_access_links(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_investor_access_links_code ON investor_access_links(access_code);

ALTER TABLE investor_access_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sponsors_manage_investor_access_links ON investor_access_links;
CREATE POLICY sponsors_manage_investor_access_links ON investor_access_links
  FOR ALL USING (sponsor_id = auth.uid());
