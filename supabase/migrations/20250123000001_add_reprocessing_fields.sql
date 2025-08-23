-- Add fields for analysis reprocessing and history tracking
ALTER TABLE analyses 
ADD COLUMN original_analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
ADD COLUMN reprocess_parameters JSONB;

-- Add comments for new fields
COMMENT ON COLUMN analyses.original_analysis_id IS 'Reference to original analysis for reprocessed versions';
COMMENT ON COLUMN analyses.reprocess_parameters IS 'Parameters used for reprocessing (tiltEstimated, preferredSource, etc.)';

-- Create index for linking reprocessed analyses
CREATE INDEX IF NOT EXISTS idx_analyses_original_analysis_id ON analyses (original_analysis_id);

-- Create view to get analysis history
CREATE OR REPLACE VIEW analysis_history AS
SELECT 
    a.id,
    a.user_id,
    a.address,
    a.coordinates,
    a.coverage,
    a.confidence,
    a.usable_area,
    a.area_source,
    a.usage_factor,
    a.annual_ghi,
    a.irradiation_source,
    a.shading_index,
    a.shading_loss,
    a.estimated_production,
    a.verdict,
    a.reasons,
    a.footprints,
    a.google_solar_data,
    a.created_at,
    a.updated_at,
    a.original_analysis_id,
    a.reprocess_parameters,
    CASE 
        WHEN a.original_analysis_id IS NULL THEN 'original'
        ELSE 'reprocessed'
    END as analysis_type,
    -- Count how many times this analysis has been reprocessed
    (
        SELECT COUNT(*) 
        FROM analyses b 
        WHERE b.original_analysis_id = COALESCE(a.original_analysis_id, a.id)
    ) as reprocess_count,
    -- Get the root analysis ID
    COALESCE(a.original_analysis_id, a.id) as root_analysis_id
FROM analyses a
ORDER BY a.created_at DESC;

-- Grant permissions to authenticated users
GRANT SELECT ON analysis_history TO authenticated;

-- Note: RLS policies for reprocessed analyses are handled by existing policies
-- The existing "Users can view their own analyses" policy already covers this case