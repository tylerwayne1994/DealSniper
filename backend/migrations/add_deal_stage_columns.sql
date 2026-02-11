-- Add deal pipeline stage tracking columns to deals table
-- These columns support the CRM pipeline feature in PipelinePage

ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_stage TEXT DEFAULT 'underwritten';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS death_reason TEXT;

-- Set stage_changed_at for existing deals that don't have it
UPDATE deals SET stage_changed_at = updated_at WHERE stage_changed_at IS NULL;
