-- =====================================================
-- PERMISSION VERIFICATION SCRIPT
-- =====================================================
-- This script verifies that database permissions are configured correctly
-- Run this after applying the secure permissions migration

-- =====================================================
-- TABLE PERMISSIONS VERIFICATION
-- =====================================================

SELECT 
    'TABLE PERMISSIONS' as check_type,
    schemaname,
    tablename,
    grantee,
    string_agg(privilege_type, ', ' ORDER BY privilege_type) as privileges
FROM information_schema.table_privileges 
WHERE schemaname = 'public' 
  AND tablename IN ('credits', 'models', 'samples', 'images')
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY schemaname, tablename, grantee
ORDER BY tablename, 
  CASE grantee 
    WHEN 'anon' THEN 1 
    WHEN 'authenticated' THEN 2 
    WHEN 'service_role' THEN 3 
  END;

-- =====================================================
-- SEQUENCE PERMISSIONS VERIFICATION
-- =====================================================

SELECT 
    'SEQUENCE PERMISSIONS' as check_type,
    schemaname,
    objectname as sequence_name,
    grantee,
    privilege_type
FROM information_schema.usage_privileges 
WHERE schemaname = 'public' 
  AND objectname LIKE '%_id_seq'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY objectname, 
  CASE grantee 
    WHEN 'anon' THEN 1 
    WHEN 'authenticated' THEN 2 
    WHEN 'service_role' THEN 3 
  END;

-- =====================================================
-- SCHEMA PERMISSIONS VERIFICATION
-- =====================================================

SELECT 
    'SCHEMA PERMISSIONS' as check_type,
    schemaname,
    grantee,
    privilege_type
FROM information_schema.usage_privileges 
WHERE schemaname = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee;

-- =====================================================
-- ROW LEVEL SECURITY STATUS
-- =====================================================

SELECT 
    'RLS STATUS' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM information_schema.tables 
WHERE schemaname = 'public' 
  AND tablename IN ('credits', 'models', 'samples', 'images')
ORDER BY tablename;

-- =====================================================
-- POLICY COUNT VERIFICATION
-- =====================================================

SELECT 
    'POLICY COUNT' as check_type,
    schemaname,
    tablename,
    count(*) as policy_count
FROM information_schema.table_privileges tp
JOIN pg_policies pp ON tp.table_name = pp.tablename
WHERE tp.schemaname = 'public' 
  AND tp.table_name IN ('credits', 'models', 'samples', 'images')
GROUP BY schemaname, tablename
ORDER BY tablename;

-- =====================================================
-- EXPECTED RESULTS SUMMARY
-- =====================================================

/*
EXPECTED RESULTS:

TABLE PERMISSIONS:
- anon: No permissions on any table
- authenticated: SELECT, UPDATE on credits; SELECT, INSERT, UPDATE, DELETE on models, samples; SELECT, UPDATE, DELETE on images
- service_role: SELECT, INSERT, UPDATE, DELETE on all tables

SEQUENCE PERMISSIONS:
- anon: No permissions on any sequence
- authenticated: USAGE on all sequences
- service_role: ALL privileges on all sequences

SCHEMA PERMISSIONS:
- All roles (anon, authenticated, service_role): USAGE on public schema

RLS STATUS:
- All tables should have rls_enabled = true

POLICY COUNT:
- Each table should have multiple policies (varies by table)
*/