-- Migration: Add white-label branding columns to profiles table
-- Run this in Supabase SQL Editor

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_logo_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_primary_color TEXT DEFAULT '#2563eb';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT DEFAULT '#1A1A1A';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_accent_color TEXT DEFAULT '#0052FF';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_company_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_letterhead_text TEXT;

COMMENT ON COLUMN profiles.brand_logo_url IS 'URL to company logo in Supabase Storage (brand-logos bucket)';
COMMENT ON COLUMN profiles.brand_primary_color IS 'Primary brand color hex for reports/pitch decks';
COMMENT ON COLUMN profiles.brand_secondary_color IS 'Secondary brand color hex for text/headings';
COMMENT ON COLUMN profiles.brand_accent_color IS 'Accent color hex used for highlights and charts';
COMMENT ON COLUMN profiles.brand_company_name IS 'Company name displayed on branded documents';
COMMENT ON COLUMN profiles.brand_letterhead_text IS 'Letterhead tagline or text below company name';
