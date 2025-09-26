-- Model Storage and Management System Migration
-- This migration adds tables and functionality for secure model storage, versioning, and management

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- MODEL STORAGE TABLES
-- =====================================================

-- Model weights storage table - stores trained model files and metadata
CREATE TABLE IF NOT EXISTS "public"."model_weights" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "model_id" bigint NOT NULL,
    "version" integer NOT NULL DEFAULT 1,
    "file_path" text NOT NULL,
    "file_size" bigint NOT NULL,
    "file_hash" text NOT NULL,
    "storage_provider" text NOT NULL DEFAULT 'supabase',
    "metadata" jsonb DEFAULT '{}',
    "training_config" jsonb DEFAULT '{}',
    "quality_metrics" jsonb DEFAULT '{}',
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone,
    "created_by" uuid,
    CONSTRAINT "model_weights_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE CASCADE,
    CONSTRAINT "model_weights_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL
);

-- Model sharing table - manages model sharing permissions and access
CREATE TABLE IF NOT EXISTS "public"."model_shares" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "model_id" bigint NOT NULL,
    "shared_by" uuid NOT NULL,
    "shared_with" uuid,
    "share_token" text UNIQUE,
    "access_level" text NOT NULL DEFAULT 'view' CHECK (access_level IN ('view', 'download', 'clone')),
    "expires_at" timestamp with time zone,
    "download_count" integer DEFAULT 0,
    "max_downloads" integer,
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "last_accessed" timestamp with time zone,
    CONSTRAINT "model_shares_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE CASCADE,
    CONSTRAINT "model_shares_shared_by_fkey" FOREIGN KEY ("shared_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "model_shares_shared_with_fkey" FOREIGN KEY ("shared_with") REFERENCES "auth"."users"("id") ON DELETE CASCADE
);

-- Model cleanup log - tracks automatic cleanup operations
CREATE TABLE IF NOT EXISTS "public"."model_cleanup_log" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "model_id" bigint,
    "cleanup_type" text NOT NULL CHECK (cleanup_type IN ('expired', 'user_requested', 'storage_limit', 'inactive')),
    "files_deleted" text[] DEFAULT '{}',
    "bytes_freed" bigint DEFAULT 0,
    "cleanup_reason" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "performed_by" uuid,
    CONSTRAINT "model_cleanup_log_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE SET NULL,
    CONSTRAINT "model_cleanup_log_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL
);

-- Model export requests - tracks model export operations
CREATE TABLE IF NOT EXISTS "public"."model_exports" (
    "id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "model_id" bigint NOT NULL,
    "user_id" uuid NOT NULL,
    "export_format" text NOT NULL DEFAULT 'safetensors' CHECK (export_format IN ('safetensors', 'pytorch', 'onnx', 'zip')),
    "export_status" text NOT NULL DEFAULT 'pending' CHECK (export_status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    "download_url" text,
    "file_size" bigint,
    "expires_at" timestamp with time zone DEFAULT (now() + interval '24 hours'),
    "error_message" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "model_exports_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE CASCADE,
    CONSTRAINT "model_exports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Model weights indexes
CREATE INDEX IF NOT EXISTS "idx_model_weights_model_id" ON "public"."model_weights"("model_id");
CREATE INDEX IF NOT EXISTS "idx_model_weights_version" ON "public"."model_weights"("model_id", "version");
CREATE INDEX IF NOT EXISTS "idx_model_weights_active" ON "public"."model_weights"("model_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_model_weights_expires" ON "public"."model_weights"("expires_at") WHERE "expires_at" IS NOT NULL;

-- Model shares indexes
CREATE INDEX IF NOT EXISTS "idx_model_shares_model_id" ON "public"."model_shares"("model_id");
CREATE INDEX IF NOT EXISTS "idx_model_shares_token" ON "public"."model_shares"("share_token");
CREATE INDEX IF NOT EXISTS "idx_model_shares_shared_by" ON "public"."model_shares"("shared_by");
CREATE INDEX IF NOT EXISTS "idx_model_shares_expires" ON "public"."model_shares"("expires_at") WHERE "expires_at" IS NOT NULL;

-- Model cleanup log indexes
CREATE INDEX IF NOT EXISTS "idx_model_cleanup_log_model_id" ON "public"."model_cleanup_log"("model_id");
CREATE INDEX IF NOT EXISTS "idx_model_cleanup_log_created_at" ON "public"."model_cleanup_log"("created_at");

-- Model exports indexes
CREATE INDEX IF NOT EXISTS "idx_model_exports_user_id" ON "public"."model_exports"("user_id");
CREATE INDEX IF NOT EXISTS "idx_model_exports_status" ON "public"."model_exports"("export_status");
CREATE INDEX IF NOT EXISTS "idx_model_exports_expires" ON "public"."model_exports"("expires_at");

-- =====================================================
-- UNIQUE CONSTRAINTS
-- =====================================================

-- Ensure only one active version per model
CREATE UNIQUE INDEX IF NOT EXISTS "idx_model_weights_active_unique" 
ON "public"."model_weights"("model_id") 
WHERE "is_active" = true;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE "public"."model_weights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."model_shares" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."model_cleanup_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."model_exports" ENABLE ROW LEVEL SECURITY;

-- Model weights policies
CREATE POLICY "Users can view their own model weights" ON "public"."model_weights"
    FOR SELECT TO "authenticated"
    USING (
        EXISTS (
            SELECT 1 FROM "public"."models" 
            WHERE "models"."id" = "model_weights"."model_id" 
            AND "models"."user_id" = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all model weights" ON "public"."model_weights"
    FOR ALL TO "service_role"
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can insert model weights for their models" ON "public"."model_weights"
    FOR INSERT TO "authenticated"
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "public"."models" 
            WHERE "models"."id" = "model_weights"."model_id" 
            AND "models"."user_id" = auth.uid()
        )
    );

-- Model shares policies
CREATE POLICY "Users can view shares for their models" ON "public"."model_shares"
    FOR SELECT TO "authenticated"
    USING (
        "shared_by" = auth.uid() OR 
        "shared_with" = auth.uid() OR
        ("is_public" = true AND "expires_at" > now())
    );

CREATE POLICY "Users can create shares for their models" ON "public"."model_shares"
    FOR INSERT TO "authenticated"
    WITH CHECK (
        "shared_by" = auth.uid() AND
        EXISTS (
            SELECT 1 FROM "public"."models" 
            WHERE "models"."id" = "model_shares"."model_id" 
            AND "models"."user_id" = auth.uid()
        )
    );

CREATE POLICY "Users can update their own shares" ON "public"."model_shares"
    FOR UPDATE TO "authenticated"
    USING ("shared_by" = auth.uid())
    WITH CHECK ("shared_by" = auth.uid());

CREATE POLICY "Users can delete their own shares" ON "public"."model_shares"
    FOR DELETE TO "authenticated"
    USING ("shared_by" = auth.uid());

CREATE POLICY "Service role can manage all shares" ON "public"."model_shares"
    FOR ALL TO "service_role"
    USING (true)
    WITH CHECK (true);

-- Model cleanup log policies
CREATE POLICY "Users can view cleanup logs for their models" ON "public"."model_cleanup_log"
    FOR SELECT TO "authenticated"
    USING (
        EXISTS (
            SELECT 1 FROM "public"."models" 
            WHERE "models"."id" = "model_cleanup_log"."model_id" 
            AND "models"."user_id" = auth.uid()
        ) OR "performed_by" = auth.uid()
    );

CREATE POLICY "Service role can manage all cleanup logs" ON "public"."model_cleanup_log"
    FOR ALL TO "service_role"
    USING (true)
    WITH CHECK (true);

-- Model exports policies
CREATE POLICY "Users can view their own exports" ON "public"."model_exports"
    FOR SELECT TO "authenticated"
    USING ("user_id" = auth.uid());

CREATE POLICY "Users can create exports for their models" ON "public"."model_exports"
    FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = auth.uid() AND
        EXISTS (
            SELECT 1 FROM "public"."models" 
            WHERE "models"."id" = "model_exports"."model_id" 
            AND "models"."user_id" = auth.uid()
        )
    );

CREATE POLICY "Users can update their own exports" ON "public"."model_exports"
    FOR UPDATE TO "authenticated"
    USING ("user_id" = auth.uid())
    WITH CHECK ("user_id" = auth.uid());

CREATE POLICY "Service role can manage all exports" ON "public"."model_exports"
    FOR ALL TO "service_role"
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- FUNCTIONS FOR AUTOMATIC CLEANUP
-- =====================================================

-- Function to clean up expired model weights
CREATE OR REPLACE FUNCTION cleanup_expired_model_weights()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cleanup_count integer := 0;
    weight_record record;
BEGIN
    -- Find and delete expired model weights
    FOR weight_record IN 
        SELECT id, model_id, file_path, file_size
        FROM model_weights 
        WHERE expires_at IS NOT NULL AND expires_at < now()
    LOOP
        -- Log the cleanup
        INSERT INTO model_cleanup_log (model_id, cleanup_type, files_deleted, bytes_freed, cleanup_reason)
        VALUES (
            weight_record.model_id,
            'expired',
            ARRAY[weight_record.file_path],
            weight_record.file_size,
            'Automatic cleanup of expired model weights'
        );
        
        -- Delete the weight record
        DELETE FROM model_weights WHERE id = weight_record.id;
        cleanup_count := cleanup_count + 1;
    END LOOP;
    
    RETURN cleanup_count;
END;
$$;

-- Function to clean up expired model shares
CREATE OR REPLACE FUNCTION cleanup_expired_model_shares()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cleanup_count integer := 0;
BEGIN
    -- Delete expired shares
    DELETE FROM model_shares 
    WHERE expires_at IS NOT NULL AND expires_at < now();
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    RETURN cleanup_count;
END;
$$;

-- Function to clean up expired model exports
CREATE OR REPLACE FUNCTION cleanup_expired_model_exports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cleanup_count integer := 0;
BEGIN
    -- Update status of expired exports
    UPDATE model_exports 
    SET export_status = 'expired'
    WHERE expires_at < now() AND export_status IN ('completed', 'processing');
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    RETURN cleanup_count;
END;
$$;

-- =====================================================
-- TRIGGERS FOR AUTOMATIC VERSIONING
-- =====================================================

-- Function to handle model weight versioning
CREATE OR REPLACE FUNCTION handle_model_weight_versioning()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- If this is a new active weight, deactivate previous versions
    IF NEW.is_active = true THEN
        UPDATE model_weights 
        SET is_active = false 
        WHERE model_id = NEW.model_id AND id != NEW.id AND is_active = true;
        
        -- Set version number if not provided
        IF NEW.version IS NULL OR NEW.version = 1 THEN
            SELECT COALESCE(MAX(version), 0) + 1 
            INTO NEW.version 
            FROM model_weights 
            WHERE model_id = NEW.model_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for model weight versioning
DROP TRIGGER IF EXISTS trigger_model_weight_versioning ON model_weights;
CREATE TRIGGER trigger_model_weight_versioning
    BEFORE INSERT OR UPDATE ON model_weights
    FOR EACH ROW
    EXECUTE FUNCTION handle_model_weight_versioning();

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant permissions on new tables
GRANT ALL ON TABLE "public"."model_weights" TO "anon";
GRANT ALL ON TABLE "public"."model_weights" TO "authenticated";
GRANT ALL ON TABLE "public"."model_weights" TO "service_role";

GRANT ALL ON TABLE "public"."model_shares" TO "anon";
GRANT ALL ON TABLE "public"."model_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."model_shares" TO "service_role";

GRANT ALL ON TABLE "public"."model_cleanup_log" TO "anon";
GRANT ALL ON TABLE "public"."model_cleanup_log" TO "authenticated";
GRANT ALL ON TABLE "public"."model_cleanup_log" TO "service_role";

GRANT ALL ON TABLE "public"."model_exports" TO "anon";
GRANT ALL ON TABLE "public"."model_exports" TO "authenticated";
GRANT ALL ON TABLE "public"."model_exports" TO "service_role";

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION cleanup_expired_model_weights() TO "service_role";
GRANT EXECUTE ON FUNCTION cleanup_expired_model_shares() TO "service_role";
GRANT EXECUTE ON FUNCTION cleanup_expired_model_exports() TO "service_role";

COMMENT ON TABLE "public"."model_weights" IS 'Stores trained model weights and metadata with versioning support';
COMMENT ON TABLE "public"."model_shares" IS 'Manages model sharing permissions and access control';
COMMENT ON TABLE "public"."model_cleanup_log" IS 'Tracks automatic cleanup operations for audit purposes';
COMMENT ON TABLE "public"."model_exports" IS 'Manages model export requests and download links';