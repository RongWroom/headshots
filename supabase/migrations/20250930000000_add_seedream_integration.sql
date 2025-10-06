-- Replicate Seedream Integration Migration
-- Adds tables for managing Seedream-based professional headshot generation

-- Drop existing tables if they exist (to ensure clean migration)
DROP TABLE IF EXISTS "public"."seedream_jobs" CASCADE;
DROP TABLE IF EXISTS "public"."seedream_uploads" CASCADE;

-- Seedream Uploads table: Stores user photo uploads for processing
CREATE TABLE "public"."seedream_uploads" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "images" jsonb NOT NULL, -- Array of {filename, blobUrl, size}
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT (now() + interval '24 hours') NOT NULL
);

-- Seedream Jobs table: Tracks headshot generation jobs via Replicate API
CREATE TABLE "public"."seedream_jobs" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "upload_id" uuid NOT NULL REFERENCES "public"."seedream_uploads"("id") ON DELETE CASCADE,
    
    -- Job configuration
    "style_id" text NOT NULL,
    "num_outputs" integer NOT NULL DEFAULT 10,
    "customizations" jsonb, -- {removeJewelry, removeGlasses, removePiercings, cleanBackground}
    
    -- Replicate tracking
    "replicate_prediction_id" text UNIQUE,
    
    -- Status tracking
    "status" text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    "progress" integer NOT NULL DEFAULT 0, -- 0-100
    "error_message" text,
    
    -- Results
    "output_images" jsonb, -- Array of {url, thumbnail}
    
    -- Metrics
    "generation_time_seconds" numeric(6,2),
    "estimated_cost_usd" numeric(6,4),
    
    -- Timestamps
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_seedream_uploads_user" ON "public"."seedream_uploads"("user_id");
CREATE INDEX IF NOT EXISTS "idx_seedream_uploads_expires" ON "public"."seedream_uploads"("expires_at");

CREATE INDEX IF NOT EXISTS "idx_seedream_jobs_user" ON "public"."seedream_jobs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_seedream_jobs_status" ON "public"."seedream_jobs"("status");
CREATE INDEX IF NOT EXISTS "idx_seedream_jobs_replicate" ON "public"."seedream_jobs"("replicate_prediction_id");
CREATE INDEX IF NOT EXISTS "idx_seedream_jobs_user_status" ON "public"."seedream_jobs"("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_seedream_jobs_created_at" ON "public"."seedream_jobs"("created_at" DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_seedream_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at timestamp
DROP TRIGGER IF EXISTS trigger_update_seedream_jobs_updated_at ON seedream_jobs;
CREATE TRIGGER trigger_update_seedream_jobs_updated_at
    BEFORE UPDATE ON seedream_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_seedream_jobs_updated_at();

-- Create function to automatically set started_at when status changes to 'processing'
CREATE OR REPLACE FUNCTION set_seedream_job_started_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'processing' AND OLD.status != 'processing' AND NEW.started_at IS NULL THEN
        NEW.started_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set started_at
DROP TRIGGER IF EXISTS trigger_set_seedream_job_started_at ON seedream_jobs;
CREATE TRIGGER trigger_set_seedream_job_started_at
    BEFORE UPDATE ON seedream_jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_seedream_job_started_at();

-- Create function to automatically set completed_at when status changes to 'completed' or 'failed'
CREATE OR REPLACE FUNCTION set_seedream_job_completed_at()
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
DROP TRIGGER IF EXISTS trigger_set_seedream_job_completed_at ON seedream_jobs;
CREATE TRIGGER trigger_set_seedream_job_completed_at
    BEFORE UPDATE ON seedream_jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_seedream_job_completed_at();

-- Enable RLS on both tables
ALTER TABLE "public"."seedream_uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."seedream_jobs" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for seedream_uploads

-- Users can view their own uploads
CREATE POLICY "Users can view their own seedream uploads" ON "public"."seedream_uploads"
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Users can create their own uploads
CREATE POLICY "Users can create their own seedream uploads" ON "public"."seedream_uploads"
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Users can delete their own uploads
CREATE POLICY "Users can delete their own seedream uploads" ON "public"."seedream_uploads"
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Service role can manage all uploads
CREATE POLICY "Service role can manage all seedream uploads" ON "public"."seedream_uploads"
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS Policies for seedream_jobs

-- Users can view their own jobs
CREATE POLICY "Users can view their own seedream jobs" ON "public"."seedream_jobs"
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Users can create jobs for themselves
CREATE POLICY "Users can create their own seedream jobs" ON "public"."seedream_jobs"
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Users can update their own jobs (for cancellation, etc.)
CREATE POLICY "Users can update their own seedream jobs" ON "public"."seedream_jobs"
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can delete their own jobs
CREATE POLICY "Users can delete their own seedream jobs" ON "public"."seedream_jobs"
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Service role can manage all jobs (for webhook updates)
CREATE POLICY "Service role can manage all seedream jobs" ON "public"."seedream_jobs"
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE "public"."seedream_uploads" TO "authenticated";
GRANT ALL ON TABLE "public"."seedream_uploads" TO "service_role";

GRANT ALL ON TABLE "public"."seedream_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."seedream_jobs" TO "service_role";

-- Add helpful comments to the tables
COMMENT ON TABLE "public"."seedream_uploads" IS 'Stores user photo uploads for Seedream headshot generation';
COMMENT ON COLUMN "public"."seedream_uploads"."images" IS 'JSON array of uploaded images with filename, blobUrl, and size';
COMMENT ON COLUMN "public"."seedream_uploads"."expires_at" IS 'Uploads expire after 24 hours for cleanup';

COMMENT ON TABLE "public"."seedream_jobs" IS 'Tracks Replicate Seedream headshot generation jobs with progress and results';
COMMENT ON COLUMN "public"."seedream_jobs"."status" IS 'Job status: pending, processing, completed, failed';
COMMENT ON COLUMN "public"."seedream_jobs"."progress" IS 'Progress percentage from 0 to 100';
COMMENT ON COLUMN "public"."seedream_jobs"."style_id" IS 'Style identifier from the style catalog (e.g., corporate-blue, warm-studio)';
COMMENT ON COLUMN "public"."seedream_jobs"."num_outputs" IS 'Number of headshots to generate (default 10)';
COMMENT ON COLUMN "public"."seedream_jobs"."customizations" IS 'JSON object with user customization preferences';
COMMENT ON COLUMN "public"."seedream_jobs"."replicate_prediction_id" IS 'Replicate API prediction ID for tracking';
COMMENT ON COLUMN "public"."seedream_jobs"."output_images" IS 'JSON array of generated image URLs and thumbnails';
COMMENT ON COLUMN "public"."seedream_jobs"."generation_time_seconds" IS 'Total time taken for generation in seconds';
COMMENT ON COLUMN "public"."seedream_jobs"."estimated_cost_usd" IS 'Estimated cost in USD for analytics';
