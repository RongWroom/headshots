-- ComfyUI Headshot Generation Jobs Migration
-- Adds generation_jobs table for tracking headshot generation requests and results

-- Drop existing table if it exists (to ensure clean migration)
DROP TABLE IF EXISTS "public"."generation_jobs" CASCADE;

-- Generation Jobs table: Manages headshot generation jobs with progress tracking
CREATE TABLE "public"."generation_jobs" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "status" text NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
    "progress" integer NOT NULL DEFAULT 0, -- 0-100
    "progress_message" text DEFAULT 'Queued',
    
    -- Input data
    "reference_images" text[] NOT NULL, -- Array of Vercel Blob URLs (5-10 images)
    "num_outputs" integer NOT NULL DEFAULT 4, -- Number of headshots to generate
    "style_intensity" numeric(3,2) DEFAULT 0.80, -- 0.00-1.00, controls LoRA strength
    
    -- Output data
    "output_images" text[], -- Array of generated image URLs
    "detected_features" jsonb, -- Facial features detected by CLIP Interrogator
    
    -- Metadata
    "generation_time_seconds" numeric(5,2), -- How long generation took
    "estimated_cost_usd" numeric(5,4), -- Cost tracking for analytics
    "error_message" text, -- Error details if status = 'failed'
    
    -- Timestamps
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "started_at" timestamp with time zone, -- When processing began
    "completed_at" timestamp with time zone, -- When job finished (success or failure)
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_generation_jobs_user_status" ON "public"."generation_jobs"("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_generation_jobs_created_at" ON "public"."generation_jobs"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_generation_jobs_status" ON "public"."generation_jobs"("status");

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_generation_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at timestamp
DROP TRIGGER IF EXISTS trigger_update_generation_jobs_updated_at ON generation_jobs;
CREATE TRIGGER trigger_update_generation_jobs_updated_at
    BEFORE UPDATE ON generation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_generation_jobs_updated_at();

-- Create function to automatically set started_at when status changes to 'processing'
CREATE OR REPLACE FUNCTION set_generation_job_started_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'processing' AND OLD.status != 'processing' AND NEW.started_at IS NULL THEN
        NEW.started_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set started_at
DROP TRIGGER IF EXISTS trigger_set_generation_job_started_at ON generation_jobs;
CREATE TRIGGER trigger_set_generation_job_started_at
    BEFORE UPDATE ON generation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_generation_job_started_at();

-- Create function to automatically set completed_at when status changes to 'completed' or 'failed'
CREATE OR REPLACE FUNCTION set_generation_job_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'completed' OR NEW.status = 'failed') 
       AND (OLD.status != 'completed' AND OLD.status != 'failed') 
       AND NEW.completed_at IS NULL THEN
        NEW.completed_at = now();
        
        -- Calculate generation time if started_at is set
        IF NEW.started_at IS NOT NULL THEN
            NEW.generation_time_seconds = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at));
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set completed_at and calculate generation_time
DROP TRIGGER IF EXISTS trigger_set_generation_job_completed_at ON generation_jobs;
CREATE TRIGGER trigger_set_generation_job_completed_at
    BEFORE UPDATE ON generation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_generation_job_completed_at();

-- Enable RLS on generation_jobs table
ALTER TABLE "public"."generation_jobs" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for generation_jobs

-- Users can view their own jobs
CREATE POLICY "Users can view their own generation jobs" ON "public"."generation_jobs"
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Users can create jobs for themselves
CREATE POLICY "Users can create their own generation jobs" ON "public"."generation_jobs"
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Users can update their own jobs (for cancellation, etc.)
CREATE POLICY "Users can update their own generation jobs" ON "public"."generation_jobs"
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Service role can manage all jobs (for webhook updates)
CREATE POLICY "Service role can manage all generation jobs" ON "public"."generation_jobs"
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE "public"."generation_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."generation_jobs" TO "service_role";

-- Add helpful comments to the table
COMMENT ON TABLE "public"."generation_jobs" IS 'Tracks ComfyUI headshot generation jobs with progress and results';
COMMENT ON COLUMN "public"."generation_jobs"."status" IS 'Job status: queued, processing, completed, failed';
COMMENT ON COLUMN "public"."generation_jobs"."progress" IS 'Progress percentage from 0 to 100';
COMMENT ON COLUMN "public"."generation_jobs"."reference_images" IS 'Array of 5-10 Vercel Blob URLs for user photos';
COMMENT ON COLUMN "public"."generation_jobs"."num_outputs" IS 'Number of headshots to generate (default 4)';
COMMENT ON COLUMN "public"."generation_jobs"."style_intensity" IS 'LoRA strength from 0.00 to 1.00 (default 0.80)';
COMMENT ON COLUMN "public"."generation_jobs"."detected_features" IS 'JSON object with facial features detected by CLIP Interrogator';
COMMENT ON COLUMN "public"."generation_jobs"."generation_time_seconds" IS 'Total time taken for generation in seconds';
COMMENT ON COLUMN "public"."generation_jobs"."estimated_cost_usd" IS 'Estimated cost in USD for analytics';
