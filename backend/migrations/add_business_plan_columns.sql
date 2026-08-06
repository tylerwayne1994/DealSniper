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

COMMENT ON COLUMN deals.business_plan_markdown IS 'Full markdown content of the AI-generated Business Plan, rendered as a section in the Deal Room';
COMMENT ON COLUMN deals.business_plan_generated_at IS 'Timestamp of the most recent Business Plan generation for this deal';
