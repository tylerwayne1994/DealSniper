-- Add trial tracking columns to profiles table
-- subscription_status: 'trialing', 'active', 'canceled', 'past_due'
-- trial_ends_at: timestamp when the 7-day free trial expires

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trialing',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Backfill existing users: if they already have a stripe_subscription_id, mark active
UPDATE profiles
SET subscription_status = 'active'
WHERE stripe_subscription_id IS NOT NULL
  AND subscription_status IS NULL;

-- New users without a subscription stay as 'trialing'
UPDATE profiles
SET subscription_status = 'trialing'
WHERE stripe_subscription_id IS NULL
  AND subscription_status IS NULL;
