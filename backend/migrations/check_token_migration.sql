-- Check if token system migration has been run
-- Run this query in Supabase SQL Editor

-- Check if token columns exist in profiles table
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('token_balance', 'subscription_tier', 'monthly_token_limit', 'tokens_reset_at')
ORDER BY column_name;

-- Check if token_usage table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'token_usage'
) AS token_usage_table_exists;

-- If both queries return results, the migration has been run successfully
-- If not, run the add_token_system.sql migration
