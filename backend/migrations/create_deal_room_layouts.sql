-- Deal Room Layouts
-- Lets a sponsor (GP) arrange/customize the investor-facing Deal Room
-- (section order, which widgets appear in each section, and a global
-- theme) from their authenticated dashboard. This is ADDITIVE to the
-- existing deal data (deals / deal_investors / distributions / deal_documents)
-- which stays the source of truth for numbers — this table only describes
-- HOW that real data is arranged and displayed, never a copy of the data
-- itself.
--
-- One layout per deal. If no row exists for a deal yet, the backend
-- generates a default layout on read that mirrors the original hardcoded
-- InvestorDealRoom.jsx section order, so nothing breaks for existing decks.
--
-- All reads/writes happen through the backend (FastAPI) using the Supabase
-- service role key (same pattern as investor_access_links), sponsor-authed
-- via X-User-ID. RLS is enabled with a sponsor-only policy for completeness/
-- direct-Supabase-client use, same rationale as investor_access_links.
-- Run against your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS deal_room_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT NOT NULL UNIQUE,
  sponsor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_room_layouts_deal ON deal_room_layouts(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_room_layouts_sponsor ON deal_room_layouts(sponsor_id);

ALTER TABLE deal_room_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sponsors_manage_deal_room_layouts ON deal_room_layouts;
CREATE POLICY sponsors_manage_deal_room_layouts ON deal_room_layouts
  FOR ALL USING (sponsor_id = auth.uid());
