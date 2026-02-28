-- Migration: Add email_aliases column to profiles
-- Run this in Supabase SQL Editor
--
-- Allows users to link multiple sender emails to their account
-- so forwarded OMs from any of those addresses get matched.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_aliases TEXT[] DEFAULT '{}';

COMMENT ON COLUMN profiles.email_aliases IS 'Additional email addresses that should be matched to this user during email sync';

-- Create a GIN index for fast array lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email_aliases ON profiles USING GIN (email_aliases);
