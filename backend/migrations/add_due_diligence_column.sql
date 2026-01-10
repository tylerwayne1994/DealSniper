-- Migration: Add due_diligence_data column to deals table
-- Run this in Supabase SQL Editor

-- Add the due_diligence_data column as JSONB to store DD checklist, notes, documents, and chat history
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS due_diligence_data JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN deals.due_diligence_data IS 'Stores due diligence data including checklist status, notes, uploaded document summaries, and AI chat history';

-- Create index for faster queries on DD data (optional, for larger datasets)
CREATE INDEX IF NOT EXISTS idx_deals_due_diligence_data ON deals USING GIN (due_diligence_data);
