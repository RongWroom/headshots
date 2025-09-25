-- Create quality_assessments table for storing training quality metrics
CREATE TABLE IF NOT EXISTS quality_assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_id TEXT NOT NULL,
    generated_image_url TEXT NOT NULL,
    original_image_urls TEXT[] NOT NULL,
    clip_similarity DECIMAL(5,4) NOT NULL CHECK (clip_similarity >= 0 AND clip_similarity <= 1),
    face_recognition_score DECIMAL(5,4) NOT NULL CHECK (face_recognition_score >= 0 AND face_recognition_score <= 1),
    overall_quality DECIMAL(5,4) NOT NULL CHECK (overall_quality >= 0 AND overall_quality <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_quality_assessments_model_id ON quality_assessments(model_id);
CREATE INDEX IF NOT EXISTS idx_quality_assessments_created_at ON quality_assessments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_assessments_overall_quality ON quality_assessments(overall_quality);

-- Create RLS policies for quality_assessments table
ALTER TABLE quality_assessments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read quality assessments for their own models
CREATE POLICY "Users can read their model quality assessments" ON quality_assessments
    FOR SELECT USING (
        model_id IN (
            SELECT id::text FROM models WHERE user_id = auth.uid()
        )
    );

-- Policy: Service role can insert quality assessments
CREATE POLICY "Service role can insert quality assessments" ON quality_assessments
    FOR INSERT WITH CHECK (true);

-- Policy: Service role can read all quality assessments
CREATE POLICY "Service role can read all quality assessments" ON quality_assessments
    FOR SELECT USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quality_assessments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_quality_assessments_updated_at
    BEFORE UPDATE ON quality_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_quality_assessments_updated_at();

-- Create view for quality assessment summary
CREATE OR REPLACE VIEW quality_assessment_summary AS
SELECT 
    model_id,
    COUNT(*) as total_assessments,
    AVG(clip_similarity) as avg_clip_similarity,
    AVG(face_recognition_score) as avg_face_recognition_score,
    AVG(overall_quality) as avg_overall_quality,
    MIN(overall_quality) as min_overall_quality,
    MAX(overall_quality) as max_overall_quality,
    COUNT(CASE WHEN overall_quality >= 0.85 THEN 1 END) as passing_assessments,
    ROUND(
        (COUNT(CASE WHEN overall_quality >= 0.85 THEN 1 END)::decimal / COUNT(*)) * 100, 
        2
    ) as pass_rate_percentage,
    MAX(created_at) as last_assessment_date
FROM quality_assessments
GROUP BY model_id;

-- Grant permissions on the view
GRANT SELECT ON quality_assessment_summary TO authenticated;
GRANT SELECT ON quality_assessment_summary TO service_role;

-- Create quality_alerts table for storing quality monitoring alerts
CREATE TABLE IF NOT EXISTS quality_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_id TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('low_quality', 'retraining_needed', 'quality_degradation')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    message TEXT NOT NULL,
    recommendations TEXT[] NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for quality_alerts
CREATE INDEX IF NOT EXISTS idx_quality_alerts_model_id ON quality_alerts(model_id);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_resolved ON quality_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_created_at ON quality_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_severity ON quality_alerts(severity);

-- Enable RLS for quality_alerts
ALTER TABLE quality_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read alerts for their own models
CREATE POLICY "Users can read their model quality alerts" ON quality_alerts
    FOR SELECT USING (
        model_id IN (
            SELECT id::text FROM models WHERE user_id = auth.uid()
        )
    );

-- Policy: Service role can manage all quality alerts
CREATE POLICY "Service role can manage quality alerts" ON quality_alerts
    FOR ALL USING (true);

-- Policy: Users can update alerts for their own models (to resolve them)
CREATE POLICY "Users can resolve their model quality alerts" ON quality_alerts
    FOR UPDATE USING (
        model_id IN (
            SELECT id::text FROM models WHERE user_id = auth.uid()
        )
    );