-- Fix the signup trigger to handle all required columns
-- Run this in Supabase SQL Editor

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create updated function with all profile columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    token_balance, 
    monthly_limit, 
    subscription_tier, 
    tokens_reset_at,
    first_name,
    last_name,
    phone,
    company,
    title,
    city,
    state,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    25,
    25,
    'base',
    NOW() + INTERVAL '1 month',
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    COALESCE(new.raw_user_meta_data->>'company', ''),
    COALESCE(new.raw_user_meta_data->>'title', ''),
    COALESCE(new.raw_user_meta_data->>'city', ''),
    COALESCE(new.raw_user_meta_data->>'state', ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    company = COALESCE(EXCLUDED.company, profiles.company),
    title = COALESCE(EXCLUDED.title, profiles.title),
    city = COALESCE(EXCLUDED.city, profiles.city),
    state = COALESCE(EXCLUDED.state, profiles.state),
    updated_at = NOW();
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the signup
    RAISE WARNING 'Error creating profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Test query to verify
SELECT 
  'Trigger reinstalled successfully' as status,
  COUNT(*) as existing_profiles
FROM profiles;
