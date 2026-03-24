-- Migration: Add Google Sheet ID column to profiles table
-- Run this in Supabase SQL Editor

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_sheet_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_sheet_tab TEXT DEFAULT 'Underwriting Model';

COMMENT ON COLUMN profiles.google_sheet_id IS 'Google Sheets spreadsheet ID for underwriting export (from URL)';
COMMENT ON COLUMN profiles.google_sheet_tab IS 'Tab/sheet name within the spreadsheet to populate';
