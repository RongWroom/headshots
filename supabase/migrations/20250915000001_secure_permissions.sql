-- =====================================================
-- SECURE DATABASE PERMISSIONS AND GRANTS
-- =====================================================
-- This migration implements proper database permissions following the principle of least privilege
-- Replaces overly broad permissions with role-specific grants

-- =====================================================
-- REVOKE EXISTING BROAD PERMISSIONS
-- =====================================================

-- Revoke all existing permissions to start fresh
REVOKE ALL ON TABLE "public"."credits" FROM "anon";
REVOKE ALL ON TABLE "public"."credits" FROM "authenticated";
REVOKE ALL ON TABLE "public"."credits" FROM "service_role";

REVOKE ALL ON TABLE "public"."models" FROM "anon";
REVOKE ALL ON TABLE "public"."models" FROM "authenticated";
REVOKE ALL ON TABLE "public"."models" FROM "service_role";

REVOKE ALL ON TABLE "public"."samples" FROM "anon";
REVOKE ALL ON TABLE "public"."samples" FROM "authenticated";
REVOKE ALL ON TABLE "public"."samples" FROM "service_role";

REVOKE ALL ON TABLE "public"."images" FROM "anon";
REVOKE ALL ON TABLE "public"."images" FROM "authenticated";
REVOKE ALL ON TABLE "public"."images" FROM "service_role";

-- Revoke sequence permissions
REVOKE ALL ON SEQUENCE "public"."credits_id_seq" FROM "anon";
REVOKE ALL ON SEQUENCE "public"."credits_id_seq" FROM "authenticated";
REVOKE ALL ON SEQUENCE "public"."credits_id_seq" FROM "service_role";

REVOKE ALL ON SEQUENCE "public"."models_id_seq" FROM "anon";
REVOKE ALL ON SEQUENCE "public"."models_id_seq" FROM "authenticated";
REVOKE ALL ON SEQUENCE "public"."models_id_seq" FROM "service_role";

REVOKE ALL ON SEQUENCE "public"."samples_id_seq" FROM "anon";
REVOKE ALL ON SEQUENCE "public"."samples_id_seq" FROM "authenticated";
REVOKE ALL ON SEQUENCE "public"."samples_id_seq" FROM "service_role";

REVOKE ALL ON SEQUENCE "public"."images_id_seq" FROM "anon";
REVOKE ALL ON SEQUENCE "public"."images_id_seq" FROM "authenticated";
REVOKE ALL ON SEQUENCE "public"."images_id_seq" FROM "service_role";

-- =====================================================
-- SCHEMA-LEVEL PERMISSIONS
-- =====================================================

-- Grant schema usage to all roles (required for accessing objects)
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

-- =====================================================
-- CREDITS TABLE PERMISSIONS
-- =====================================================

-- Anonymous users: No access (must be authenticated to have credits)
-- No grants for anon role

-- Authenticated users: Can read and update their own credits (enforced by RLS)
GRANT SELECT, UPDATE ON TABLE "public"."credits" TO "authenticated";

-- Service role: Full access for payment processing and system operations
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."credits" TO "service_role";

-- Sequence permissions for credits
GRANT USAGE, SELECT ON SEQUENCE "public"."credits_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."credits_id_seq" TO "service_role";

-- =====================================================
-- MODELS TABLE PERMISSIONS
-- =====================================================

-- Anonymous users: No access (must be authenticated to create models)
-- No grants for anon role

-- Authenticated users: Can create, read, update, and delete their own models (enforced by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."models" TO "authenticated";

-- Service role: Full access for webhook operations and system management
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."models" TO "service_role";

-- Sequence permissions for models
GRANT USAGE, SELECT ON SEQUENCE "public"."models_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."models_id_seq" TO "service_role";

-- =====================================================
-- SAMPLES TABLE PERMISSIONS
-- =====================================================

-- Anonymous users: No access (must be authenticated to upload samples)
-- No grants for anon role

-- Authenticated users: Can create, read, update, and delete samples for their models (enforced by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."samples" TO "authenticated";

-- Service role: Full access for system operations
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."samples" TO "service_role";

-- Sequence permissions for samples
GRANT USAGE, SELECT ON SEQUENCE "public"."samples_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."samples_id_seq" TO "service_role";

-- =====================================================
-- IMAGES TABLE PERMISSIONS
-- =====================================================

-- Anonymous users: No access (must be authenticated to view generated images)
-- No grants for anon role

-- Authenticated users: Can read, update, and delete images for their models (enforced by RLS)
-- Note: INSERT is primarily handled by service role via webhooks
GRANT SELECT, UPDATE, DELETE ON TABLE "public"."images" TO "authenticated";

-- Service role: Full access for webhook operations and image generation
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."images" TO "service_role";

-- Sequence permissions for images
GRANT USAGE, SELECT ON SEQUENCE "public"."images_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."images_id_seq" TO "service_role";

-- =====================================================
-- FUNCTION PERMISSIONS
-- =====================================================

-- Grant execute permissions on auth functions that may be needed
GRANT EXECUTE ON FUNCTION "auth"."uid"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "auth"."uid"() TO "service_role";

-- =====================================================
-- DEFAULT PRIVILEGES FOR FUTURE OBJECTS
-- =====================================================

-- Set up default privileges for any future tables, sequences, or functions
-- This ensures consistent permissions for objects created later

-- Default table privileges
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "authenticated";

-- Default sequence privileges
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
  GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
  GRANT USAGE, SELECT ON SEQUENCES TO "authenticated";

-- Default function privileges (more restrictive)
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
  GRANT EXECUTE ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" 
  GRANT EXECUTE ON FUNCTIONS TO "authenticated";

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- The following queries can be used to verify permissions are set correctly
-- (These are comments for reference, not executed)

/*
-- Verify table permissions
SELECT 
    schemaname,
    tablename,
    grantor,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE schemaname = 'public' 
  AND tablename IN ('credits', 'models', 'samples', 'images')
ORDER BY tablename, grantee, privilege_type;

-- Verify sequence permissions
SELECT 
    schemaname,
    objectname,
    grantor,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.usage_privileges 
WHERE schemaname = 'public' 
  AND objectname LIKE '%_id_seq'
ORDER BY objectname, grantee;

-- Verify schema permissions
SELECT 
    schemaname,
    grantor,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.usage_privileges 
WHERE schemaname = 'public'
ORDER BY grantee;
*/

-- Migration complete - secure permissions configured