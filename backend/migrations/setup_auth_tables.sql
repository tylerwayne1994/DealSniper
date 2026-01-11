-- Setup Supabase Authentication Tables
-- Run this in Supabase SQL Editor

-- Enable Row Level Security on profiles table (if not already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles table
-- Users can only read their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Enable RLS on token_usage table
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own token usage
CREATE POLICY "Users can view own token usage" ON token_usage
  FOR SELECT
  USING (auth.uid() = profile_id);

-- System can insert token usage records
CREATE POLICY "System can insert token usage" ON token_usage
  FOR INSERT
  WITH CHECK (true);

-- Enable RLS on email_deals table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_deals') THEN
    ALTER TABLE email_deals ENABLE ROW LEVEL SECURITY;
    
    -- Users can view their own email deals
    CREATE POLICY "Users can view own email deals" ON email_deals
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Enable RLS on deals_v2 table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'deals_v2') THEN
    ALTER TABLE deals_v2 ENABLE ROW LEVEL SECURITY;
    
    -- Users can view their own deals
    CREATE POLICY "Users can view own deals" ON deals_v2
      FOR SELECT
      USING (auth.uid() = user_id);
    
    -- Users can insert their own deals
    CREATE POLICY "Users can insert own deals" ON deals_v2
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
    
    -- Users can update their own deals
    CREATE POLICY "Users can update own deals" ON deals_v2
      FOR UPDATE
      USING (auth.uid() = user_id);
    
    -- Users can delete their own deals
    CREATE POLICY "Users can delete own deals" ON deals_v2
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create function to automatically create profile on signup (if not exists)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, token_balance, monthly_limit, subscription_tier, tokens_reset_at)
  VALUES (
    new.id,
    new.email,
    25,  -- Default token balance
    25,  -- Default monthly limit
    'base',  -- Default tier
    NOW() + INTERVAL '1 month'  -- Reset date
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup (if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT ON token_usage TO authenticated;
GRANT INSERT ON token_usage TO service_role;

-- Verify setup
SELECT 
  'Profiles table' as table_name,
  COUNT(*) as row_count,
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles') as rls_enabled
FROM profiles
UNION ALL
SELECT 
  'Token usage table',
  COUNT(*),
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'token_usage')
FROM token_usage;
