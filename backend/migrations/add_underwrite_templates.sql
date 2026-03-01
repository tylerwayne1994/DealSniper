-- Add underwrite_templates JSONB column to profiles table
-- Stores user-defined default templates for underwriting
-- Shape: { underwrite: {...}, email_underwrite: {...} }
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS underwrite_templates JSONB DEFAULT '{}'::jsonb;
