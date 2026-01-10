-- Add LLC owners column to deals table
-- This stores OpenCorporates data including company info and officers

ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS llc_owners JSONB;

-- Create index for JSON queries
CREATE INDEX IF NOT EXISTS idx_deals_llc_owners ON deals USING gin (llc_owners);

-- Add comment
COMMENT ON COLUMN deals.llc_owners IS 'OpenCorporates LLC/company data including officers and beneficial owners';
