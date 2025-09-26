-- Training Queue and Concurrency Management Migration
-- Adds job queue system, user rate limiting, and load balancing capabilities

-- Training Queue table: Manages job queue with priority and scheduling
CREATE TABLE IF NOT EXISTS "public"."training_queue" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "model_id" bigint NOT NULL REFERENCES "public"."models"("id") ON DELETE CASCADE,
    "priority" integer NOT NULL DEFAULT 5, -- 1 (highest) to 10 (lowest)
    "status" text NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed', 'cancelled'
    "provider" text NOT NULL DEFAULT 'runpod', -- 'runpod', 'replicate', 'fal'
    "estimated_duration" integer, -- Estimated duration in milliseconds
    "estimated_start_time" timestamp with time zone,
    "actual_start_time" timestamp with time zone,
    "completion_time" timestamp with time zone,
    "queue_position" integer,
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "training_config" jsonb NOT NULL, -- Training parameters and configuration
    "error_message" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- User Rate Limits table: Tracks user-based rate limiting
CREATE TABLE IF NOT EXISTS "public"."user_rate_limits" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "limit_type" text NOT NULL, -- 'hourly', 'daily', 'monthly'
    "limit_value" integer NOT NULL, -- Maximum number of jobs
    "current_usage" integer DEFAULT 0,
    "reset_time" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(user_id, limit_type)
);

-- Provider Capacity table: Tracks available capacity for each provider
CREATE TABLE IF NOT EXISTS "public"."provider_capacity" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "provider" text NOT NULL, -- 'runpod', 'replicate', 'fal'
    "instance_id" text, -- Specific instance identifier (for RunPod)
    "max_concurrent_jobs" integer NOT NULL DEFAULT 1,
    "current_jobs" integer DEFAULT 0,
    "status" text NOT NULL DEFAULT 'active', -- 'active', 'maintenance', 'disabled'
    "health_score" numeric(3,2) DEFAULT 1.0, -- 0.0 to 1.0
    "average_job_duration" integer, -- Average duration in milliseconds
    "last_health_check" timestamp with time zone DEFAULT now(),
    "metadata" jsonb, -- Provider-specific metadata
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(provider, instance_id)
);

-- Queue Statistics table: Tracks queue performance metrics
CREATE TABLE IF NOT EXISTS "public"."queue_statistics" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "date" date NOT NULL DEFAULT CURRENT_DATE,
    "provider" text NOT NULL,
    "total_queued" integer DEFAULT 0,
    "total_processed" integer DEFAULT 0,
    "total_failed" integer DEFAULT 0,
    "total_cancelled" integer DEFAULT 0,
    "average_wait_time" integer, -- Average wait time in milliseconds
    "average_processing_time" integer, -- Average processing time in milliseconds
    "peak_queue_size" integer DEFAULT 0,
    "throughput_per_hour" numeric(10,2), -- Jobs processed per hour
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(date, provider)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_training_queue_user_id" ON "public"."training_queue"("user_id");
CREATE INDEX IF NOT EXISTS "idx_training_queue_status" ON "public"."training_queue"("status");
CREATE INDEX IF NOT EXISTS "idx_training_queue_provider" ON "public"."training_queue"("provider");
CREATE INDEX IF NOT EXISTS "idx_training_queue_priority" ON "public"."training_queue"("priority");
CREATE INDEX IF NOT EXISTS "idx_training_queue_created_at" ON "public"."training_queue"("created_at");
CREATE INDEX IF NOT EXISTS "idx_training_queue_queue_position" ON "public"."training_queue"("queue_position");

CREATE INDEX IF NOT EXISTS "idx_user_rate_limits_user_id" ON "public"."user_rate_limits"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_rate_limits_reset_time" ON "public"."user_rate_limits"("reset_time");

CREATE INDEX IF NOT EXISTS "idx_provider_capacity_provider" ON "public"."provider_capacity"("provider");
CREATE INDEX IF NOT EXISTS "idx_provider_capacity_status" ON "public"."provider_capacity"("status");

CREATE INDEX IF NOT EXISTS "idx_queue_statistics_date" ON "public"."queue_statistics"("date");
CREATE INDEX IF NOT EXISTS "idx_queue_statistics_provider" ON "public"."queue_statistics"("provider");

-- Function to update queue positions
CREATE OR REPLACE FUNCTION update_queue_positions()
RETURNS TRIGGER AS $
BEGIN
    -- Recalculate queue positions for all queued jobs, ordered by priority and creation time
    WITH ranked_queue AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY provider 
                ORDER BY priority ASC, created_at ASC
            ) as new_position
        FROM training_queue 
        WHERE status = 'queued'
    )
    UPDATE training_queue 
    SET queue_position = ranked_queue.new_position
    FROM ranked_queue 
    WHERE training_queue.id = ranked_queue.id;
    
    RETURN COALESCE(NEW, OLD);
END;
$ LANGUAGE plpgsql;

-- Create trigger to automatically update queue positions
DROP TRIGGER IF EXISTS trigger_update_queue_positions ON training_queue;
CREATE TRIGGER trigger_update_queue_positions
    AFTER INSERT OR UPDATE OR DELETE ON training_queue
    FOR EACH STATEMENT
    EXECUTE FUNCTION update_queue_positions();

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(p_user_id uuid, p_limit_type text)
RETURNS boolean AS $
BEGIN
    -- Reset expired rate limits
    UPDATE user_rate_limits 
    SET current_usage = 0, 
        reset_time = CASE 
            WHEN p_limit_type = 'hourly' THEN now() + interval '1 hour'
            WHEN p_limit_type = 'daily' THEN now() + interval '1 day'
            WHEN p_limit_type = 'monthly' THEN now() + interval '1 month'
        END
    WHERE user_id = p_user_id 
      AND limit_type = p_limit_type 
      AND reset_time <= now();
    
    -- Check if user is within rate limit
    RETURN EXISTS (
        SELECT 1 FROM user_rate_limits 
        WHERE user_id = p_user_id 
          AND limit_type = p_limit_type 
          AND current_usage < limit_value
    );
END;
$ LANGUAGE plpgsql;

-- Function to increment rate limit usage
CREATE OR REPLACE FUNCTION increment_rate_limit(p_user_id uuid, p_limit_type text)
RETURNS void AS $
BEGIN
    INSERT INTO user_rate_limits (user_id, limit_type, limit_value, current_usage, reset_time)
    VALUES (
        p_user_id, 
        p_limit_type, 
        CASE 
            WHEN p_limit_type = 'hourly' THEN 10
            WHEN p_limit_type = 'daily' THEN 50
            WHEN p_limit_type = 'monthly' THEN 500
        END,
        1,
        CASE 
            WHEN p_limit_type = 'hourly' THEN now() + interval '1 hour'
            WHEN p_limit_type = 'daily' THEN now() + interval '1 day'
            WHEN p_limit_type = 'monthly' THEN now() + interval '1 month'
        END
    )
    ON CONFLICT (user_id, limit_type) 
    DO UPDATE SET 
        current_usage = user_rate_limits.current_usage + 1,
        updated_at = now();
END;
$ LANGUAGE plpgsql;

-- Function to update queue statistics
CREATE OR REPLACE FUNCTION update_queue_statistics()
RETURNS TRIGGER AS $
BEGIN
    -- Update daily statistics when queue status changes
    IF NEW.status != OLD.status THEN
        INSERT INTO queue_statistics (
            date, 
            provider,
            total_queued,
            total_processed,
            total_failed,
            total_cancelled,
            average_wait_time,
            average_processing_time,
            peak_queue_size,
            throughput_per_hour
        )
        SELECT 
            CURRENT_DATE,
            NEW.provider,
            COUNT(*) FILTER (WHERE status = 'queued'),
            COUNT(*) FILTER (WHERE status = 'completed'),
            COUNT(*) FILTER (WHERE status = 'failed'),
            COUNT(*) FILTER (WHERE status = 'cancelled'),
            AVG(EXTRACT(EPOCH FROM (actual_start_time - created_at)) * 1000) FILTER (WHERE actual_start_time IS NOT NULL),
            AVG(EXTRACT(EPOCH FROM (completion_time - actual_start_time)) * 1000) FILTER (WHERE completion_time IS NOT NULL AND actual_start_time IS NOT NULL),
            (SELECT COUNT(*) FROM training_queue WHERE provider = NEW.provider AND status = 'queued'),
            COUNT(*) FILTER (WHERE status = 'completed' AND DATE(completion_time) = CURRENT_DATE) / 
                GREATEST(EXTRACT(HOUR FROM now() - CURRENT_DATE::timestamp), 1)
        FROM training_queue 
        WHERE provider = NEW.provider 
          AND DATE(created_at) = CURRENT_DATE
        ON CONFLICT (date, provider) 
        DO UPDATE SET
            total_queued = EXCLUDED.total_queued,
            total_processed = EXCLUDED.total_processed,
            total_failed = EXCLUDED.total_failed,
            total_cancelled = EXCLUDED.total_cancelled,
            average_wait_time = EXCLUDED.average_wait_time,
            average_processing_time = EXCLUDED.average_processing_time,
            peak_queue_size = GREATEST(queue_statistics.peak_queue_size, EXCLUDED.peak_queue_size),
            throughput_per_hour = EXCLUDED.throughput_per_hour,
            updated_at = now();
    END IF;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Create trigger to automatically update queue statistics
DROP TRIGGER IF EXISTS trigger_update_queue_statistics ON training_queue;
CREATE TRIGGER trigger_update_queue_statistics
    AFTER UPDATE ON training_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_queue_statistics();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at timestamps
DROP TRIGGER IF EXISTS trigger_update_training_queue_updated_at ON training_queue;
CREATE TRIGGER trigger_update_training_queue_updated_at
    BEFORE UPDATE ON training_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_user_rate_limits_updated_at ON user_rate_limits;
CREATE TRIGGER trigger_update_user_rate_limits_updated_at
    BEFORE UPDATE ON user_rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_provider_capacity_updated_at ON provider_capacity;
CREATE TRIGGER trigger_update_provider_capacity_updated_at
    BEFORE UPDATE ON provider_capacity
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_queue_statistics_updated_at ON queue_statistics;
CREATE TRIGGER trigger_update_queue_statistics_updated_at
    BEFORE UPDATE ON queue_statistics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all new tables
ALTER TABLE "public"."training_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_rate_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."provider_capacity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."queue_statistics" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for training_queue
CREATE POLICY "Users can view their own queue entries" ON "public"."training_queue"
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own queue entries" ON "public"."training_queue"
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own queue entries" ON "public"."training_queue"
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage all queue entries" ON "public"."training_queue"
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS Policies for user_rate_limits
CREATE POLICY "Users can view their own rate limits" ON "public"."user_rate_limits"
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all rate limits" ON "public"."user_rate_limits"
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS Policies for provider_capacity (read-only for authenticated users)
CREATE POLICY "Users can view provider capacity" ON "public"."provider_capacity"
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Service role can manage provider capacity" ON "public"."provider_capacity"
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS Policies for queue_statistics (read-only for authenticated users)
CREATE POLICY "Users can view queue statistics" ON "public"."queue_statistics"
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Service role can manage queue statistics" ON "public"."queue_statistics"
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE "public"."training_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."training_queue" TO "service_role";

GRANT ALL ON TABLE "public"."user_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_rate_limits" TO "service_role";

GRANT ALL ON TABLE "public"."provider_capacity" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_capacity" TO "service_role";

GRANT ALL ON TABLE "public"."queue_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."queue_statistics" TO "service_role";

-- Insert default provider capacity entries
INSERT INTO provider_capacity (provider, max_concurrent_jobs, status) VALUES
    ('runpod', 5, 'active'),
    ('replicate', 10, 'active'),
    ('fal', 8, 'active')
ON CONFLICT (provider, instance_id) DO NOTHING;

-- Insert default rate limits for existing users (if any)
INSERT INTO user_rate_limits (user_id, limit_type, limit_value, reset_time)
SELECT 
    id as user_id,
    'hourly' as limit_type,
    10 as limit_value,
    now() + interval '1 hour' as reset_time
FROM auth.users
ON CONFLICT (user_id, limit_type) DO NOTHING;

INSERT INTO user_rate_limits (user_id, limit_type, limit_value, reset_time)
SELECT 
    id as user_id,
    'daily' as limit_type,
    50 as limit_value,
    now() + interval '1 day' as reset_time
FROM auth.users
ON CONFLICT (user_id, limit_type) DO NOTHING;

INSERT INTO user_rate_limits (user_id, limit_type, limit_value, reset_time)
SELECT 
    id as user_id,
    'monthly' as limit_type,
    500 as limit_value,
    now() + interval '1 month' as reset_time
FROM auth.users
ON CONFLICT (user_id, limit_type) DO NOTHING;