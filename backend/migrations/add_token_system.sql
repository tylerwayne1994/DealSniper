-- Migration: Add token system for AI operations
-- Run this in Supabase SQL Editor

-- Add token fields to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS token_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'base',
ADD COLUMN IF NOT EXISTS monthly_token_limit INTEGER DEFAULT 25,
ADD COLUMN IF NOT EXISTS tokens_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 month',
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Create token usage tracking table
CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL, -- 'loi_generation', 'market_research_results', 'market_research_dashboard'
  tokens_used INTEGER DEFAULT 1,
  deal_id TEXT,
  deal_name TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_token_usage_profile_id ON token_usage(profile_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_operation_type ON token_usage(operation_type);

-- Add comments
COMMENT ON TABLE token_usage IS 'Tracks AI operation token usage per user';
COMMENT ON COLUMN profiles.token_balance IS 'Current available tokens for AI operations';
COMMENT ON COLUMN profiles.subscription_tier IS 'User subscription tier (base: $39.99/25 tokens, pro: $49.99/55 tokens)';
COMMENT ON COLUMN profiles.monthly_token_limit IS 'Maximum tokens per month based on subscription';
COMMENT ON COLUMN profiles.tokens_reset_at IS 'When tokens will be reset to monthly limit';
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe customer ID for webhook processing';
COMMENT ON COLUMN profiles.stripe_subscription_id IS 'Active Stripe subscription ID';

-- Function to automatically reset tokens monthly
CREATE OR REPLACE FUNCTION reset_monthly_tokens()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET 
    token_balance = monthly_token_limit,
    tokens_reset_at = NOW() + INTERVAL '1 month'
  WHERE tokens_reset_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to reset tokens (run this separately in Supabase if pg_cron is available)
-- SELECT cron.schedule('reset-monthly-tokens', '0 0 1 * *', 'SELECT reset_monthly_tokens();');
