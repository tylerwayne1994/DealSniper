-- Investor Portal / LP Dashboard tables
-- Run against your Supabase SQL editor

-- 1. Investors table: each investor linked to a sponsor (the DealSniper user)
CREATE TABLE IF NOT EXISTS investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  company TEXT,
  investor_type TEXT DEFAULT 'lp',  -- 'lp', 'gp', 'co-gp'
  status TEXT DEFAULT 'invited',    -- 'invited', 'active', 'inactive'
  invite_token TEXT UNIQUE,
  password_hash TEXT,               -- simple portal access (optional, can use magic link)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sponsor_id, email)
);

-- 2. Deal-investor junction: which investors are in which deals + their capital commitment
CREATE TABLE IF NOT EXISTS deal_investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT NOT NULL,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  sponsor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  commitment_amount NUMERIC DEFAULT 0,
  contributed_amount NUMERIC DEFAULT 0,
  ownership_pct NUMERIC DEFAULT 0,
  preferred_return_pct NUMERIC DEFAULT 8,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(deal_id, investor_id)
);

-- 3. Distributions: track every payout to an investor
CREATE TABLE IF NOT EXISTS distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_investor_id UUID NOT NULL REFERENCES deal_investors(id) ON DELETE CASCADE,
  distribution_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  distribution_type TEXT DEFAULT 'cash_flow',  -- 'cash_flow', 'return_of_capital', 'capital_gain', 'refinance'
  memo TEXT,
  quarter TEXT,  -- e.g. 'Q1 2025'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. K-1 and document uploads for investors
CREATE TABLE IF NOT EXISTS investor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_investor_id UUID NOT NULL REFERENCES deal_investors(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'k1',  -- 'k1', 'quarterly_report', 'subscription_agreement', 'other'
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT,
  tax_year INTEGER,
  quarter TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Quarterly updates / investor communications
CREATE TABLE IF NOT EXISTS investor_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT NOT NULL,
  sponsor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  quarter TEXT,
  metrics JSONB,  -- { noi, occupancy, distributions_this_quarter, projected_irr, etc. }
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_investors_sponsor ON investors(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_investors_email ON investors(email);
CREATE INDEX IF NOT EXISTS idx_deal_investors_deal ON deal_investors(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_investors_investor ON deal_investors(investor_id);
CREATE INDEX IF NOT EXISTS idx_distributions_deal_investor ON distributions(deal_investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_documents_deal_investor ON investor_documents(deal_investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_updates_deal ON investor_updates(deal_id);

-- RLS policies
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_updates ENABLE ROW LEVEL SECURITY;

-- Sponsors can manage their own investors
CREATE POLICY sponsors_manage_investors ON investors
  FOR ALL USING (sponsor_id = auth.uid());

CREATE POLICY sponsors_manage_deal_investors ON deal_investors
  FOR ALL USING (sponsor_id = auth.uid());

CREATE POLICY sponsors_manage_distributions ON distributions
  FOR ALL USING (
    deal_investor_id IN (
      SELECT id FROM deal_investors WHERE sponsor_id = auth.uid()
    )
  );

CREATE POLICY sponsors_manage_documents ON investor_documents
  FOR ALL USING (
    deal_investor_id IN (
      SELECT id FROM deal_investors WHERE sponsor_id = auth.uid()
    )
  );

CREATE POLICY sponsors_manage_updates ON investor_updates
  FOR ALL USING (sponsor_id = auth.uid());
