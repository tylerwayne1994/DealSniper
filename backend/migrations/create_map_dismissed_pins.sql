-- Lets a user "delete" a pipeline deal's pin from the home dashboard map
-- without deleting the deal itself. Pipeline pins are re-derived from the
-- deals table on every map load, so without this table a "deleted" pin
-- would just reappear on the next reload/deployment.
CREATE TABLE IF NOT EXISTS map_dismissed_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  deal_id TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, deal_id)
);

CREATE INDEX IF NOT EXISTS idx_map_dismissed_pins_user ON map_dismissed_pins (user_id);

ALTER TABLE map_dismissed_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own dismissed pins" ON map_dismissed_pins
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
