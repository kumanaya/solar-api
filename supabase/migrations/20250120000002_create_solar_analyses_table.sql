-- Create table for solar analyses
CREATE TABLE IF NOT EXISTS solar_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    coordinates JSONB NOT NULL, -- {lat: number, lng: number}
    
    -- Analysis results
    coverage JSONB NOT NULL, -- {google: boolean, fallback?: string}
    confidence TEXT NOT NULL CHECK (confidence IN ('Alta', 'Média', 'Baixa')),
    usable_area REAL NOT NULL,
    area_source TEXT NOT NULL CHECK (area_source IN ('google', 'estimate', 'footprint', 'manual')),
    annual_irradiation REAL NOT NULL,
    irradiation_source TEXT NOT NULL,
    shading_index REAL NOT NULL,
    shading_loss REAL NOT NULL,
    estimated_production REAL NOT NULL,
    verdict TEXT NOT NULL CHECK (verdict IN ('Apto', 'Parcial', 'Não apto')),
    reasons JSONB NOT NULL, -- string[]
    usage_factor REAL NOT NULL DEFAULT 0.75,
    
    -- Optional polygon data
    custom_polygon JSONB, -- GeoJSON polygon if manually drawn
    
    -- Footprints data
    footprints JSONB NOT NULL DEFAULT '[]', -- Array of footprint objects
    
    -- Google Solar API data (optional)
    google_solar_data JSONB,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_solar_analyses_user_id ON solar_analyses (user_id);
CREATE INDEX IF NOT EXISTS idx_solar_analyses_created_at ON solar_analyses (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_solar_analyses_address ON solar_analyses USING GIN (to_tsvector('portuguese', address));
CREATE INDEX IF NOT EXISTS idx_solar_analyses_verdict ON solar_analyses (verdict);
CREATE INDEX IF NOT EXISTS idx_solar_analyses_estimated_production ON solar_analyses (estimated_production DESC);

-- Add RLS (Row Level Security)
ALTER TABLE solar_analyses ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own analyses
CREATE POLICY "Users can view their own analyses" ON solar_analyses
    FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own analyses
CREATE POLICY "Users can insert their own analyses" ON solar_analyses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own analyses
CREATE POLICY "Users can update their own analyses" ON solar_analyses
    FOR UPDATE USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own analyses
CREATE POLICY "Users can delete their own analyses" ON solar_analyses
    FOR DELETE USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE solar_analyses IS 'Solar energy analyses performed by users';
COMMENT ON COLUMN solar_analyses.address IS 'Address analyzed for solar potential';
COMMENT ON COLUMN solar_analyses.coordinates IS 'Latitude and longitude of the analyzed location';
COMMENT ON COLUMN solar_analyses.coverage IS 'Data source coverage information';
COMMENT ON COLUMN solar_analyses.confidence IS 'Confidence level of the analysis';
COMMENT ON COLUMN solar_analyses.usable_area IS 'Usable roof area in square meters';
COMMENT ON COLUMN solar_analyses.area_source IS 'Source of area calculation';
COMMENT ON COLUMN solar_analyses.annual_irradiation IS 'Annual solar irradiation in kWh/m²/year';
COMMENT ON COLUMN solar_analyses.irradiation_source IS 'Source of irradiation data';
COMMENT ON COLUMN solar_analyses.estimated_production IS 'Estimated annual energy production in kWh/year';
COMMENT ON COLUMN solar_analyses.verdict IS 'Final recommendation for solar installation';
COMMENT ON COLUMN solar_analyses.custom_polygon IS 'Manually drawn polygon in GeoJSON format';
COMMENT ON COLUMN solar_analyses.footprints IS 'Building footprint data';
COMMENT ON COLUMN solar_analyses.google_solar_data IS 'Raw data from Google Solar API';

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_solar_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_solar_analyses_updated_at
    BEFORE UPDATE ON solar_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_solar_analyses_updated_at();