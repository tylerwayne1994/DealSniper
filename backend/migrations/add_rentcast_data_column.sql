-- Migration: Add rentcast_data column to deals table
-- Run this in Supabase SQL Editor
-- This stores cached RentCast API responses so users don't burn an API call
-- every time they revisit the Rent Roll tab.

-- Add the rentcast_data column as JSONB to store full RentCast response
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS rentcast_data JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN deals.rentcast_data IS 'Cached RentCast API response including rent estimate, price/sqft, rent range, lat/lng, and nearby rental comparables. Saved on fetch to avoid repeat API calls.';

-- Create GIN index for faster queries on rentcast data (optional, for analytics)
CREATE INDEX IF NOT EXISTS idx_deals_rentcast_data ON deals USING GIN (rentcast_data);

-- Also add costseg_data column if it doesn't exist (same pattern)
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS costseg_data JSONB DEFAULT NULL;

COMMENT ON COLUMN deals.costseg_data IS 'Cached cost segregation analysis results.';
