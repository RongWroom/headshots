-- =====================================================
-- DATABASE SETUP SCRIPT
-- =====================================================
-- This script sets up the complete database schema with secure permissions
-- Run this script on a fresh Supabase project to configure everything

-- Step 1: Create the main schema
\echo 'Creating database schema...'
\i 20250915000000_recreate_schema.sql

-- Step 2: Apply secure permissions
\echo 'Applying secure permissions...'
\i 20250915000001_secure_permissions.sql

-- Step 3: Apply additional RLS policies if needed
\echo 'Applying additional RLS policies...'
\i rls-policies.sql

-- Step 4: Verify the setup
\echo 'Verifying permissions configuration...'
\i verify_permissions.sql

\echo 'Database setup complete!'
\echo 'Please review the verification results above to ensure everything is configured correctly.'