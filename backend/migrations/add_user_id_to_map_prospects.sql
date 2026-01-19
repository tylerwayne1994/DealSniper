-- Migration: Add user_id to map_prospects for per-user property tracking
-- Run this in Supabase SQL Editor

-- 1) Add user_id column
ALTER TABLE map_prospects ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2) Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_map_prospects_user_id ON map_prospects(user_id);

-- 3) Enable RLS (Row Level Security)
ALTER TABLE map_prospects ENABLE ROW LEVEL SECURITY;

-- 4) Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own map prospects" ON map_prospects;
DROP POLICY IF EXISTS "Users can insert their own map prospects" ON map_prospects;
DROP POLICY IF EXISTS "Users can update their own map prospects" ON map_prospects;
DROP POLICY IF EXISTS "Users can delete their own map prospects" ON map_prospects;

-- 5) Create RLS policies
CREATE POLICY "Users can view their own map prospects"
  ON map_prospects FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own map prospects"
  ON map_prospects FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own map prospects"
  ON map_prospects FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own map prospects"
  ON map_prospects FOR DELETE
  USING (user_id = auth.uid());

-- Optional: If you want to assign existing NULL user_id rows to a specific user, uncomment:
-- UPDATE map_prospects SET user_id = '<your-user-id>' WHERE user_id IS NULL;
