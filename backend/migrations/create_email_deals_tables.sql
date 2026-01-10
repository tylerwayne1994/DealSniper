-- Email Deals Tables for Gmail Integration
-- Run this in Supabase SQL Editor

-- 1. Email Integrations (stores OAuth tokens per user)
CREATE TABLE IF NOT EXISTS email_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'gmail',
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'revoked')),
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- 2. Raw Emails (stores fetched emails before processing)
CREATE TABLE IF NOT EXISTS raw_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    provider_message_id TEXT NOT NULL,
    thread_id TEXT,
    from_address TEXT,
    subject TEXT,
    snippet TEXT,
    received_at TIMESTAMPTZ,
    raw_payload JSONB,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider_message_id)
);

-- 3. Deal Links (extracted URLs from emails)
CREATE TABLE IF NOT EXISTS deal_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    email_id UUID REFERENCES raw_emails(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('crexi', 'loopnet', 'cbre', 'marcus_millichap', 'colliers', 'other')),
    url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'parsed', 'ignored', 'underwritten')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, url)
);

-- 4. Screened Deals (napkin underwriting results)
CREATE TABLE IF NOT EXISTS screened_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    deal_link_id UUID REFERENCES deal_links(id) ON DELETE CASCADE,
    
    -- Basic listing info (scraped or placeholder)
    property_name TEXT,
    property_address TEXT,
    price NUMERIC,
    units INTEGER,
    beds INTEGER,
    sqft INTEGER,
    year_built INTEGER,
    
    -- Estimated financials
    estimated_rent NUMERIC,
    estimated_income NUMERIC,
    estimated_expenses NUMERIC,
    estimated_noi NUMERIC,
    
    -- Napkin underwriting metrics
    estimated_cap_rate NUMERIC,
    estimated_dscr NUMERIC,
    estimated_cash_on_cash NUMERIC,
    estimated_price_per_unit NUMERIC,
    
    -- Screening result
    score TEXT CHECK (score IN ('pass', 'maybe', 'fail')),
    screening_notes TEXT,
    
    -- Metadata
    scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. User Buy Box Settings (for napkin underwriting)
CREATE TABLE IF NOT EXISTS user_buy_box (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    
    -- Price constraints
    min_price NUMERIC,
    max_price NUMERIC,
    max_price_per_unit NUMERIC,
    
    -- Unit constraints
    min_units INTEGER,
    max_units INTEGER,
    
    -- Return constraints
    min_cap_rate NUMERIC,  -- as decimal (e.g., 0.06 = 6%)
    max_cap_rate NUMERIC,
    min_dscr NUMERIC,
    min_cash_on_cash NUMERIC,
    max_expense_ratio NUMERIC,  -- as decimal (e.g., 0.45 = 45%)
    
    -- Property constraints
    max_vacancy NUMERIC,  -- as decimal (e.g., 0.10 = 10%)
    min_year_built INTEGER,
    
    -- Target markets (stored as JSON array)
    target_markets JSONB DEFAULT '[]',
    
    -- Financing assumptions for napkin calcs
    assumed_ltv NUMERIC DEFAULT 0.75,
    assumed_interest_rate NUMERIC DEFAULT 0.07,
    assumed_amortization INTEGER DEFAULT 30,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_integrations_user ON email_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_raw_emails_user ON raw_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_raw_emails_processed ON raw_emails(user_id, processed);
CREATE INDEX IF NOT EXISTS idx_deal_links_user ON deal_links(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_links_status ON deal_links(user_id, status);
CREATE INDEX IF NOT EXISTS idx_screened_deals_user ON screened_deals(user_id);
CREATE INDEX IF NOT EXISTS idx_screened_deals_score ON screened_deals(user_id, score);

-- ============================================================================
-- Deals table: ensure we can store external listing URLs (e.g., CREXI links)
-- ============================================================================

-- Add a listing_url column to deals if it doesn't exist yet.
-- This is used by the Rapid Fire pipeline queue to remember the
-- original marketplace URL for each deal.
ALTER TABLE IF EXISTS public.deals
    ADD COLUMN IF NOT EXISTS listing_url TEXT;

-- Enable RLS (Row Level Security) if needed
-- ALTER TABLE email_integrations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE raw_emails ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE deal_links ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE screened_deals ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_buy_box ENABLE ROW LEVEL SECURITY;
