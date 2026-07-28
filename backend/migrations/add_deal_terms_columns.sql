-- Adds sponsor-set deal terms (preferred return / GP promote) to the deals table.
-- These are the real negotiated terms for a deal, used to default new investor
-- allocations in the Investor Portal. Run against your Supabase SQL editor.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS preferred_return_pct NUMERIC DEFAULT 8,
  ADD COLUMN IF NOT EXISTS gp_promote_pct NUMERIC DEFAULT 20;
