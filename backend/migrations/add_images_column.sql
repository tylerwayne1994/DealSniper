-- Migration: Add images column to deals table for storing property photos
-- Run this in Supabase SQL Editor
-- NOTE: Run each statement separately if you get errors

-- Step 1: Add images column
ALTER TABLE deals ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
