-- deal_documents table: per-deal uploaded due-diligence files, managed by
-- the sponsor from the Deal Room "Documents" tab (see DealRoomPage.jsx).
-- The table did not previously exist in this project (the app silently
-- falls back to storing documents embedded on deals.parsed_data.deal_room_documents
-- when this table/query is unavailable) — this migration creates it for real,
-- including the visible_to_investors flag that powers the investor-facing
-- Document Vault (InvestorDealRoom.jsx / investor_access.py).
--
-- visible_to_investors defaults to false — documents are private by default
-- and the sponsor opts individual files into the investor-facing vault.
-- Run against your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS deal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  category TEXT DEFAULT 'other',
  storage_path TEXT,
  bucket TEXT,
  public_url TEXT,
  visible_to_investors BOOLEAN NOT NULL DEFAULT false,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- In case the table already existed from an earlier ad-hoc setup without
-- this column, add it safely too.
ALTER TABLE deal_documents
  ADD COLUMN IF NOT EXISTS visible_to_investors BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_deal_documents_deal ON deal_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_documents_user ON deal_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_documents_visible ON deal_documents(deal_id, visible_to_investors);

ALTER TABLE deal_documents ENABLE ROW LEVEL SECURITY;

-- Sponsors can only manage their own documents. The investor-facing read
-- (investor_access.py) goes through the backend's Supabase service role key,
-- which bypasses RLS entirely, so no public/anon policy is needed here.
DROP POLICY IF EXISTS sponsors_manage_deal_documents ON deal_documents;
CREATE POLICY sponsors_manage_deal_documents ON deal_documents
  FOR ALL USING (user_id = auth.uid());
