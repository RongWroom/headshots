#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function debugDatabase() {
  console.log('🔍 Debugging database and authentication...\n');
  
  // Check environment variables
  console.log('Environment check:');
  console.log('- Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Present' : '❌ Missing');
  console.log('- Supabase Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Present' : '❌ Missing');
  console.log('- Supabase Service Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Present' : '❌ Missing');
  
  // Test database connection using service role key
  console.log('\n📊 Testing database connection...');
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Check if models table exists and has data
    console.log('Checking models table...');
    const { data: models, error: modelsError } = await supabase
      .from('models')
      .select('id, name, type, status, user_id, created_at')
      .limit(5);
    
    if (modelsError) {
      console.error('❌ Models table error:', modelsError.message);
    } else {
      console.log(`✅ Models table accessible, found ${models.length} models`);
      if (models.length > 0) {
        console.log('Sample models:');
        models.forEach(model => {
          console.log(`  - ID: ${model.id}, Name: ${model.name}, Status: ${model.status}, Type: ${model.type}`);
        });
      } else {
        console.log('⚠️  No models found in database');
        console.log('💡 Users need to train models first before generating headshots');
      }
    }
    
    // Check generation_jobs table
    console.log('\nChecking generation_jobs table...');
    const { data: jobs, error: jobsError } = await supabase
      .from('generation_jobs')
      .select('id, status, created_at')
      .limit(3);
    
    if (jobsError) {
      console.error('❌ Generation jobs table error:', jobsError.message);
    } else {
      console.log(`✅ Generation jobs table accessible, found ${jobs.length} jobs`);
    }
    
    // Test authentication (this won't work without a real user session)
    console.log('\n🔐 Testing authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('⚠️  No authenticated user (expected in server context)');
      console.log('💡 Authentication happens in the API route with user cookies');
    } else {
      console.log('✅ User authenticated:', user.id);
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

debugDatabase().catch(console.error);