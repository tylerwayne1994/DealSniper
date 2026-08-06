-- Migration: Add business_plan_markdown column(s) to deals table
-- Run this in Supabase SQL Editor

-- Stores the full AI-generated Business Plan markdown for a deal, so it
-- persists as its own dedicated column (not buried inside parsed_data) and
-- renders as a live "Business Plan" section in the Deal Room every time the
-- deal is loaded, independent of whether the PDF-to-Documents export step
-- succeeds.
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS business_plan_markdown TEXT DEFAULT NULL;

ALTER TABLE deals
ADD COLUMN IF NOT EXISTS business_plan_generated_at TIMESTAMPTZ DEFAULT NULL;

-- Structured JSON version of the Business Plan (title, offeringHighlights,
-- investmentThesis, sections[] with typed blocks: subheading/paragraph/
-- table/list/checklist). Generated via Claude tool-calling, so it's
-- guaranteed valid JSON -- the frontend renders it directly into real UI
-- components instead of parsing AI-written markdown text. This replaced
-- the markdown-based approach (business_plan_markdown, kept above only for
-- backward compatibility with plans generated before this column existed).
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS business_plan_data JSONB DEFAULT NULL;

COMMENT ON COLUMN deals.business_plan_markdown IS 'DEPRECATED legacy markdown content of the AI-generated Business Plan (kept for backward compatibility) -- superseded by business_plan_data';
COMMENT ON COLUMN deals.business_plan_generated_at IS 'Timestamp of the most recent Business Plan generation for this deal';
COMMENT ON COLUMN deals.business_plan_data IS 'Structured JSON of the AI-generated Business Plan (title, offeringHighlights, investmentThesis, sections[]), rendered as a section in the Deal Room';
