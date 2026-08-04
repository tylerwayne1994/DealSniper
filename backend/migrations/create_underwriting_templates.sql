-- Underwriting Templates
-- Lets a sponsor upload their own .xlsx underwriting model and use it (instead
-- of the built-in stock template) as the base workbook for the Underwriting
-- Model tab on the Results page (see client/public/spreadsheet/ and
-- client/src/components/results-tabs/UnderwritingModelTab.jsx).
--
-- One template per user (their current default) — uploading a new one
-- replaces the previous row/file. Actual file bytes live in Supabase
-- Storage bucket "underwriting-templates" at path {user_id}/{file_name};
-- this table just tracks the pointer + metadata.
--
-- All reads/writes happen through the backend (FastAPI) using the Supabase
-- service role key, sponsor-authed via X-User-ID (same pattern as
-- investor_access_links / deal_room_layouts). RLS enabled with a
-- sponsor-only policy for completeness / direct-Supabase-client use.
-- Run against your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS underwriting_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_underwriting_templates_user ON underwriting_templates(user_id);

ALTER TABLE underwriting_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_manage_own_underwriting_template ON underwriting_templates;
CREATE POLICY users_manage_own_underwriting_template ON underwriting_templates
  FOR ALL USING (user_id = auth.uid());
