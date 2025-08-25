-- Add financial_data column to store calculated financial analysis results
ALTER TABLE analyses
ADD COLUMN IF NOT EXISTS financial_data JSONB;

-- Add comment
COMMENT ON COLUMN analyses.financial_data IS 'Financial analysis results from dynamic calculations';

-- Create index for performance (for queries filtering by financial viability)
CREATE INDEX IF NOT EXISTS idx_analyses_financial_data_payback ON analyses 
USING GIN ((financial_data->'simple_payback_years'));

CREATE INDEX IF NOT EXISTS idx_analyses_financial_data_npv ON analyses 
USING GIN ((financial_data->'net_present_value'));
