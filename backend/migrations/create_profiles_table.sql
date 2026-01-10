-- Migration: Create profiles table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,  -- Can link to Supabase auth.users if you add auth later
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  company TEXT,
  title TEXT,
  city TEXT,
  state TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE profiles IS 'User profile information for DealSniper app';

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Insert a default profile row (you can update this with your info in Supabase)
INSERT INTO profiles (first_name, last_name, phone, email, company, title, city, state)
VALUES ('', '', '', '', '', '', '', '')
ON CONFLICT DO NOTHING;
