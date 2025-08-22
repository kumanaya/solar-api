-- Add RLS policies for analyses table
-- Allow authenticated users to insert, select, update their own analyses

-- Enable RLS on analyses table (if not already enabled)
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own analyses
CREATE POLICY "Users can insert their own analyses" ON analyses
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can select their own analyses
CREATE POLICY "Users can select their own analyses" ON analyses
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Policy: Users can update their own analyses
CREATE POLICY "Users can update their own analyses" ON analyses
    FOR UPDATE 
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own analyses
CREATE POLICY "Users can delete their own analyses" ON analyses
    FOR DELETE 
    USING (auth.uid() = user_id);