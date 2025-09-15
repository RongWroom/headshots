#!/usr/bin/env node

/**
 * Environment Setup Verification
 * 
 * This script verifies that environment variables are properly configured
 * for the Next.js application. It can be run as part of the build process.
 * 
 * Usage: node verify-env-setup.js
 */

function verifyEnvironmentSetup() {
  console.log('🔍 Verifying Environment Setup for Next.js Application...\n');

  const requiredSupabaseVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  let allValid = true;
  const issues = [];

  // Check Supabase variables
  console.log('📋 Checking Supabase Configuration:');
  
  for (const varName of requiredSupabaseVars) {
    const value = process.env[varName];
    
    if (!value) {
      console.log(`   ❌ ${varName}: Missing`);
      issues.push(`${varName} is not set`);
      allValid = false;
    } else if (value.includes('your-') || value.includes('placeholder')) {
      console.log(`   ⚠️  ${varName}: Contains placeholder value`);
      issues.push(`${varName} still has placeholder value`);
      allValid = false;
    } else {
      console.log(`   ✅ ${varName}: Configured`);
    }
  }

  // Check URL format
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && !supabaseUrl.includes('your-')) {
    const urlPattern = /^https:\/\/[a-z0-9]+\.supabase\.co$/;
    if (!urlPattern.test(supabaseUrl)) {
      console.log(`   ⚠️  NEXT_PUBLIC_SUPABASE_URL: Invalid format`);
      issues.push('Supabase URL format should be: https://your-project-ref.supabase.co');
      allValid = false;
    }
  }

  // Check JWT format for keys
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (anonKey && !anonKey.includes('your-') && !anonKey.startsWith('eyJ')) {
    console.log(`   ⚠️  NEXT_PUBLIC_SUPABASE_ANON_KEY: Invalid JWT format`);
    issues.push('Anon key should be a JWT token starting with "eyJ"');
    allValid = false;
  }
  
  if (serviceKey && !serviceKey.includes('your-') && !serviceKey.startsWith('eyJ')) {
    console.log(`   ⚠️  SUPABASE_SERVICE_ROLE_KEY: Invalid JWT format`);
    issues.push('Service role key should be a JWT token starting with "eyJ"');
    allValid = false;
  }

  console.log('\n📊 Verification Summary:');
  
  if (allValid) {
    console.log('   ✅ All Supabase environment variables are properly configured');
    console.log('   🚀 Ready to run the application');
    return true;
  } else {
    console.log('   ❌ Issues found with environment configuration');
    console.log('\n🔧 Issues to fix:');
    issues.forEach(issue => console.log(`   • ${issue}`));
    console.log('\n💡 To fix these issues:');
    console.log('   1. Run: node update-supabase-env.js (interactive helper)');
    console.log('   2. Or manually update .env.local with your Supabase credentials');
    console.log('   3. Get credentials from: https://app.supabase.com/project/_/settings/api');
    console.log('   4. Run this script again to verify');
    return false;
  }
}

const isValid = verifyEnvironmentSetup();
process.exit(isValid ? 0 : 1);