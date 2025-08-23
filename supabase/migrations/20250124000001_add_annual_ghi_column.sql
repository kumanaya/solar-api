-- Add annual_ghi column and update existing data
ALTER TABLE analyses
ADD COLUMN annual_ghi REAL NOT NULL DEFAULT 0;

-- Copy data from annual_irradiation to annual_ghi for existing records
UPDATE analyses
SET annual_ghi = annual_irradiation
WHERE annual_ghi = 0;

-- Add comment
COMMENT ON COLUMN analyses.annual_ghi IS 'Annual Global Horizontal Irradiance in kWh/m²/year';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_analyses_annual_ghi ON analyses (annual_ghi);

