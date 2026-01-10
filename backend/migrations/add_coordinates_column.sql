-- Add latitude and longitude columns to deals table
-- This allows us to cache geocoded coordinates and avoid repeated API calls

ALTER TABLE deals
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add index for faster spatial queries
CREATE INDEX IF NOT EXISTS idx_deals_coordinates ON deals(latitude, longitude);

-- Add comment explaining the columns
COMMENT ON COLUMN deals.latitude IS 'Geocoded latitude - cached to avoid repeated API calls (saves geocoding quota)';
COMMENT ON COLUMN deals.longitude IS 'Geocoded longitude - cached to avoid repeated API calls (saves geocoding quota)';
