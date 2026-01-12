-- Migration: Add user_id to deals and enforce per-user RLS
-- Run this in Supabase SQL Editor

-- 1) Add user_id column
ALTER TABLE deals ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2) Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);

-- 3) Enable Row Level Security
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- 4) Policies to restrict access to own rows
DROP POLICY IF EXISTS deals_select_own ON deals;
DROP POLICY IF EXISTS deals_insert_own ON deals;
DROP POLICY IF EXISTS deals_update_own ON deals;
DROP POLICY IF EXISTS deals_delete_own ON deals;

CREATE POLICY deals_select_own ON deals FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY deals_insert_own ON deals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY deals_update_own ON deals FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY deals_delete_own ON deals FOR DELETE
  USING (user_id = auth.uid());

-- Optional: backfill existing rows to a specific user if needed
-- UPDATE deals SET user_id = '<your-user-id>' WHERE user_id IS NULL;