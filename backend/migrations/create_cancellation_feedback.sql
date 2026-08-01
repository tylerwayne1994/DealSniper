-- Cancellation feedback: captures why a user cancels (or considers cancelling)
-- their DealSniper subscription, whether they're on an active paid plan or
-- still mid free-trial. Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS cancellation_feedback (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
    email               TEXT,
    subscription_status TEXT,           -- 'trialing' | 'active' | other status at time of cancellation
    subscription_tier   TEXT,
    reason              TEXT NOT NULL,  -- selected reason code (see REASON_OPTIONS in the frontend)
    comments            TEXT,           -- optional free-text elaboration
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_profile_id ON cancellation_feedback(profile_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_created_at ON cancellation_feedback(created_at DESC);

-- Row Level Security: service role only (this is written via the backend
-- using the service key; no direct client-side inserts/reads needed).
ALTER TABLE cancellation_feedback ENABLE ROW LEVEL SECURITY;
