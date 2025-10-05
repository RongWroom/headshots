#!/usr/bin/env node

/**
 * Validation script for generation_jobs migration
 * Checks that the migration file contains all required elements
 */

const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, 'supabase/migrations/20250929000000_add_generation_jobs.sql');
const migrationContent = fs.readFileSync(migrationPath, 'utf8');

console.log('🔍 Validating generation_jobs migration...\n');

const checks = [
  {
    name: 'Table creation',
    test: () => migrationContent.includes('CREATE TABLE IF NOT EXISTS "public"."generation_jobs"'),
  },
  {
    name: 'All required columns',
    test: () => {
      const requiredColumns = [
        'id', 'user_id', 'status', 'progress', 'progress_message',
        'reference_images', 'num_outputs', 'style_intensity',
        'output_images', 'detected_features',
        'generation_time_seconds', 'estimated_cost_usd', 'error_message',
        'created_at', 'started_at', 'completed_at', 'updated_at'
      ];
      return requiredColumns.every(col => migrationContent.includes(`"${col}"`));
    },
  },
  {
    name: 'idx_user_status index',
    test: () => migrationContent.includes('idx_generation_jobs_user_status') &&
                migrationContent.includes('"user_id", "status"'),
  },
  {
    name: 'idx_created_at index',
    test: () => migrationContent.includes('idx_generation_jobs_created_at') &&
                migrationContent.includes('"created_at" DESC'),
  },
  {
    name: 'RLS enabled',
    test: () => migrationContent.includes('ENABLE ROW LEVEL SECURITY'),
  },
  {
    name: 'User SELECT policy',
    test: () => migrationContent.includes('Users can view their own generation jobs') &&
                migrationContent.includes('user_id = auth.uid()'),
  },
  {
    name: 'User INSERT policy',
    test: () => migrationContent.includes('Users can create their own generation jobs'),
  },
  {
    name: 'Service role policy',
    test: () => migrationContent.includes('Service role can manage all generation jobs') &&
                migrationContent.includes('service_role'),
  },
  {
    name: 'Triggers for timestamps',
    test: () => migrationContent.includes('update_generation_jobs_updated_at') &&
                migrationContent.includes('set_generation_job_started_at') &&
                migrationContent.includes('set_generation_job_completed_at'),
  },
  {
    name: 'Permissions granted',
    test: () => migrationContent.includes('GRANT ALL ON TABLE "public"."generation_jobs"'),
  },
];

let allPassed = true;

checks.forEach(check => {
  const passed = check.test();
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${check.name}`);
  if (!passed) allPassed = false;
});

console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('✅ All validation checks passed!');
  console.log('\nMigration file is ready for deployment.');
  process.exit(0);
} else {
  console.log('❌ Some validation checks failed!');
  console.log('\nPlease review the migration file.');
  process.exit(1);
}
