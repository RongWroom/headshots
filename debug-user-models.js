#!/usr/bin/env node

/**
 * Debug script to check what models are available for the authenticated user
 */

require('dotenv').config({ path: '.env.local' });

async function checkUserModels() {
  console.log('🔍 Checking user models in database...\n');
  
  const { createClient } = require('@supabase/supabase-js');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Get all users and their models
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError.message);
      return;
    }
    
    console.log(`📊 Found ${users.users.length} users in the system`);
    
    for (const user of users.users) {
      console.log(`\n👤 User: ${user.email || 'No email'} (ID: ${user.id})`);
      
      // Get models for this user
      const { data: models, error: modelsError } = await supabase
        .from('models')
        .select('id, name, type, status, modelId, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (modelsError) {
        console.log('  ❌ Error fetching models:', modelsError.message);
        continue;
      }
      
      if (models.length === 0) {
        console.log('  📭 No models found for this user');
      } else {
        console.log(`  📋 Found ${models.length} models:`);
        models.forEach(model => {
          console.log(`    - ID: ${model.id}, Name: ${model.name}, Status: ${model.status}, Type: ${model.type}`);
          console.log(`      RunPod ID: ${model.modelId}, Created: ${new Date(model.created_at).toLocaleDateString()}`);
        });
      }
    }
    
    // Also check generation jobs
    console.log('\n🔄 Recent generation jobs:');
    const { data: jobs, error: jobsError } = await supabase
      .from('generation_jobs')
      .select('id, user_id, status, created_at, runpod_job_id')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (jobsError) {
      console.log('❌ Error fetching generation jobs:', jobsError.message);
    } else if (jobs.length === 0) {
      console.log('📭 No generation jobs found');
    } else {
      jobs.forEach(job => {
        console.log(`  - Job ID: ${job.id}, User: ${job.user_id}, Status: ${job.status}, RunPod: ${job.runpod_job_id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

checkUserModels().catch(console.error);