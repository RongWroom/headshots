#!/usr/bin/env node

/**
 * Supabase Environment Update Helper
 * 
 * This interactive script helps you update your Supabase environment variables
 * in .env.local with proper validation.
 * 
 * Usage: node update-supabase-env.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function validateSupabaseUrl(url) {
  const pattern = /^https:\/\/[a-z0-9]+\.supabase\.co$/;
  return pattern.test(url);
}

function validateJwtToken(token) {
  const pattern = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  return pattern.test(token);
}

async function updateSupabaseEnvironment() {
  console.log('🔧 Supabase Environment Update Helper\n');
  console.log('This script will help you update your Supabase credentials in .env.local\n');
  console.log('📋 You can find these values at: https://app.supabase.com/project/_/settings/api\n');

  try {
    // Get Supabase URL
    let supabaseUrl;
    while (true) {
      supabaseUrl = await question('Enter your Supabase Project URL (https://your-project-ref.supabase.co): ');
      if (validateSupabaseUrl(supabaseUrl)) {
        break;
      }
      console.log('❌ Invalid format. URL should be: https://your-project-ref.supabase.co\n');
    }

    // Get Anon Key
    let anonKey;
    while (true) {
      anonKey = await question('Enter your Supabase Anon/Public Key (starts with eyJ): ');
      if (validateJwtToken(anonKey)) {
        break;
      }
      console.log('❌ Invalid format. Key should be a JWT token starting with "eyJ"\n');
    }

    // Get Service Role Key
    let serviceKey;
    while (true) {
      serviceKey = await question('Enter your Supabase Service Role Key (starts with eyJ): ');
      if (validateJwtToken(serviceKey)) {
        break;
      }
      console.log('❌ Invalid format. Key should be a JWT token starting with "eyJ"\n');
    }

    // Update .env.local file
    const envPath = path.join(__dirname, '.env.local');
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Replace the Supabase configuration section
    const supabaseSection = `# Supabase Configuration - Updated for new database migration
NEXT_PUBLIC_SUPABASE_URL="${supabaseUrl}"
NEXT_PUBLIC_SUPABASE_ANON_KEY="${anonKey}"
SUPABASE_SERVICE_ROLE_KEY="${serviceKey}"`;

    // Find and replace the Supabase section
    const supabaseRegex = /# Supabase Configuration[^#]*(?=\n# |$)/s;
    if (supabaseRegex.test(envContent)) {
      envContent = envContent.replace(supabaseRegex, supabaseSection);
    } else {
      // If section not found, prepend it
      envContent = supabaseSection + '\n\n' + envContent;
    }

    // Write back to file
    fs.writeFileSync(envPath, envContent);

    console.log('\n✅ Successfully updated .env.local with your Supabase credentials!');
    console.log('\n🔍 Next steps:');
    console.log('   1. Run: node validate-env-config.js');
    console.log('   2. Run: node test-db-connection.js');
    console.log('   3. Ensure your database schema is created');

  } catch (error) {
    console.error('❌ Error updating environment:', error.message);
  } finally {
    rl.close();
  }
}

updateSupabaseEnvironment();