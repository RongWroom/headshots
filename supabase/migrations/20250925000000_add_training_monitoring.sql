-- Training Monitoring and Status Tracking Migration
-- Adds comprehensive training monitoring, status tracking, and history tables

-- Training Sessions table: Tracks detailed training session information
CREATE TABLE IF NOT EXISTS "public"."training_sessions" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "model_id" bigint NOT NULL REFERENCES "public"."models"("id") ON DELETE CASCADE,
    "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "provider" text NOT NULL DEFAULT 'runpod', -- 'runpod', 'replicate', 'fal'
    "external_training_id" text, -- Provider's training job ID
    "status" text NOT NULL DEFAULT 'pending', -- 'pending', 'queued', 'training', 'completed', 'failed', 'cancelled'
    "progress" integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    "current_step" integer DEFAULT 0,
    "total_steps" integer,
    "estimated_completion_time" timestamp with time zone,
    "training_started_at" timestamp with time zone,
    "training_completed_at" timestamp with time zone,
    "training_duration" integer, -- Duration in milliseconds
    "error_message" text,
    "error_code" text,
    "retry_count" integer DEFAULT 0,
    "webhook_events" jsonb DEFAULT '[]'::jsonb,
    "training_config" jsonb, -- Store training parameters
    "performance_metrics" jsonb, -- Store performance data
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Training Status Updates table: Tracks all status changes and progress updates
CREATE TABLE IF NOT EXISTS "public"."training_status_updates" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "training_session_id" uuid NOT NULL REFERENCES "public"."training_sessions"("id") ON DELETE CASCADE,
    "status" text NOT NULL,
    "progress" integer,
    "current_step" integer,
    "message" text,
    "details" jsonb,
    "source" text NOT NULL DEFAULT 'system', -- 'system', 'webhook', 'manual'
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Training Performance Metrics table: Stores detailed performance data
CREATE TABLE IF NOT EXISTS "public"."training_performance_metrics" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "training_session_id" uuid NOT NULL REFERENCES "public"."training_sessions"("id") ON DELETE CASCADE,
    "metric_type" text NOT NULL, -- 'loss', 'learning_rate', 'gpu_usage', 'memory_usage', etc.
    "metric_value" numeric NOT NULL,
    "step" integer,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    "metadata" jsonb
);

-- Training History Summary table: Aggregated statistics for reporting
CREATE TABLE IF NOT EXISTS "public"."training_history_summary" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "provider" text NOT NULL,
    "date" date NOT NULL DEFAULT CURRENT_DATE,
    "total_sessions" integer DEFAULT 0,
    "successful_sessions" integer DEFAULT 0,
    "failed_sessions" integer DEFAULT 0,
    "cancelled_sessions" integer DEFAULT 0,
    "average_duration" integer, -- Average duration in milliseconds
    "total_training_time" integer, -- Total training time in milliseconds
    "success_rate" numeric(5,2), -- Success rate as percentage
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(user_id, provider, date)
);

-- Webhook Events table: Stores all webhook events for debugging and audit
CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "training_session_id" uuid REFERENCES "public"."training_sessions"("id") ON DELETE SET NULL,
    "provider" text NOT NULL,
    "event_type" text NOT NULL,
    "event_data" jsonb NOT NULL,
    "processed" boolean DEFAULT false,
    "processing_error" text,
    "received_at" timestamp with time zone DEFAULT now() NOT NULL,
    "processed_at" timestamp with time zone
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_training_sessions_model_id" ON "public"."training_sessions"("model_id");
CREATE INDEX IF NOT EXISTS "idx_training_sessions_user_id" ON "public"."training_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_training_sessions_status" ON "public"."training_sessions"("status");
CREATE INDEX IF NOT EXISTS "idx_training_sessions_provider" ON "public"."training_sessions"("provider");
CREATE INDEX IF NOT EXISTS "idx_training_sessions_external_id" ON "public"."training_sessions"("external_training_id");
CREATE INDEX IF NOT EXISTS "idx_training_sessions_created_at" ON "public"."training_sessions"("created_at");

CREATE INDEX IF NOT EXISTS "idx_training_status_updates_session_id" ON "public"."training_status_updates"("training_session_id");
CREATE INDEX IF NOT EXISTS "idx_training_status_updates_created_at" ON "public"."training_status_updates"("created_at");

CREATE INDEX IF NOT EXISTS "idx_training_performance_metrics_session_id" ON "public"."training_performance_metrics"("training_session_id");
CREATE INDEX IF NOT EXISTS "idx_training_performance_metrics_type" ON "public"."training_performance_metrics"("metric_type");
CREATE INDEX IF NOT EXISTS "idx_training_performance_metrics_timestamp" ON "public"."training_performance_metrics"("timestamp");

CREATE INDEX IF NOT EXISTS "idx_training_history_summary_user_id" ON "public"."training_history_summary"("user_id");
CREATE INDEX IF NOT EXISTS "idx_training_history_summary_date" ON "public"."training_history_summary"("date");

CREATE INDEX IF NOT EXISTS "idx_webhook_events_training_session_id" ON "public"."webhook_events"("training_session_id");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_provider" ON "public"."webhook_events"("provider");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_processed" ON "public"."webhook_events"("processed");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_received_at" ON "public"."webhook_events"("received_at");

-- Create function to update training_history_summary
CREATE OR REPLACE FUNCTION update_training_history_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update summary when training session is completed, failed, or cancelled
    IF NEW.status IN ('completed', 'failed', 'cancelled') AND 
       (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'failed', 'cancelled')) THEN
        
        INSERT INTO training_history_summary (
            user_id, 
            provider, 
            date,
            total_sessions,
            successful_sessions,
            failed_sessions,
            cancelled_sessions,
            average_duration,
            total_training_time,
            success_rate
        )
        SELECT 
            NEW.user_id,
            NEW.provider,
            CURRENT_DATE,
            COUNT(*),
            COUNT(*) FILTER (WHERE status = 'completed'),
            COUNT(*) FILTER (WHERE status = 'failed'),
            COUNT(*) FILTER (WHERE status = 'cancelled'),
            AVG(training_duration) FILTER (WHERE training_duration IS NOT NULL),
            SUM(training_duration) FILTER (WHERE training_duration IS NOT NULL),
            (COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*))
        FROM training_sessions 
        WHERE user_id = NEW.user_id 
          AND provider = NEW.provider 
          AND DATE(created_at) = CURRENT_DATE
        ON CONFLICT (user_id, provider, date) 
        DO UPDATE SET
            total_sessions = EXCLUDED.total_sessions,
            successful_sessions = EXCLUDED.successful_sessions,
            failed_sessions = EXCLUDED.failed_sessions,
            cancelled_sessions = EXCLUDED.cancelled_sessions,
            average_duration = EXCLUDED.average_duration,
            total_training_time = EXCLUDED.total_training_time,
            success_rate = EXCLUDED.success_rate,
            updated_at = now();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update training history summary
DROP TRIGGER IF EXISTS trigger_update_training_history_summary ON training_sessions;
CREATE TRIGGER trigger_update_training_history_summary
    AFTER UPDATE ON training_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_training_history_summary();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at timestamps
DROP TRIGGER IF EXISTS trigger_update_training_sessions_updated_at ON training_sessions;
CREATE TRIGGER trigger_update_training_sessions_updated_at
    BEFORE UPDATE ON training_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_training_history_summary_updated_at ON training_history_summary;
CREATE TRIGGER trigger_update_training_history_summary_updated_at
    BEFORE UPDATE ON training_history_summary
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all new tables
ALTER TABLE "public"."training_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."training_status_updates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."training_performance_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."training_history_summary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for training_sessions
CREATE POLICY "Users can view their own training sessions" ON "public"."training_sessions"
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own training sessions" ON "public"."training_sessions"
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own training sessions" ON "public"."training_sessions"
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage all training sessions" ON "public"."training_sessions"
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS Policies for training_status_updates
CREATE POLICY "Users can view status updates for their training sessions" ON "public"."training_status_updates"
    FOR SELECT TO authenticated
    USING (
        training_session_id IN (
            SELECT id FROM training_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all status updates" ON "public"."training_status_updates"
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS Policies for training_performance_metrics
CREATE POLICY "Users can view metrics for their training sessions" ON "public"."training_performance_metrics"
    FOR SELECT TO authenticated
    USING (
        training_session_id IN (
            SELECT id FROM training_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all performance metrics" ON "public"."training_performance_metrics"
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS Policies for training_history_summary
CREATE POLICY "Users can view their own training history" ON "public"."training_history_summary"
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all training history" ON "public"."training_history_summary"
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS Policies for webhook_events
CREATE POLICY "Users can view webhook events for their training sessions" ON "public"."webhook_events"
    FOR SELECT TO authenticated
    USING (
        training_session_id IN (
            SELECT id FROM training_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all webhook events" ON "public"."webhook_events"
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE "public"."training_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."training_sessions" TO "service_role";

GRANT ALL ON TABLE "public"."training_status_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."training_status_updates" TO "service_role";

GRANT ALL ON TABLE "public"."training_performance_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."training_performance_metrics" TO "service_role";

GRANT ALL ON TABLE "public"."training_history_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."training_history_summary" TO "service_role";

GRANT ALL ON TABLE "public"."webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_events" TO "service_role";