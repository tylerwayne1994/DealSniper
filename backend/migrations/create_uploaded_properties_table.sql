-- Create table for user-uploaded property spreadsheets
CREATE TABLE IF NOT EXISTS uploaded_properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  upload_name TEXT NOT NULL,
  property_name TEXT,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  property_data JSONB NOT NULL DEFAULT '{}',
  geocode_status TEXT DEFAULT 'pending', -- 'pending', 'success', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_uploaded_properties_user_id ON uploaded_properties(user_id);

-- Index for geocode status filtering
CREATE INDEX IF NOT EXISTS idx_uploaded_properties_geocode_status ON uploaded_properties(geocode_status);

-- Index for spatial queries if needed
CREATE INDEX IF NOT EXISTS idx_uploaded_properties_coords ON uploaded_properties(latitude, longitude);
