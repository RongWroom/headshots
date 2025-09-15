#!/usr/bin/env node

/**
 * Environment Configuration Validation Script
 * 
 * This script validates that all environment variables are properly configured
 * and match the expected format for the headshots application.
 * 
 * Usage: node validate-env-config.js
 */

// Load environment variables from .env.local manually
const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key] = value;
        }
      }
    });
  } catch (error) {
    console.log('⚠️  Could not load .env.local file. Make sure it exists.');
  }
}

loadEnvFile();

function validateEnvironmentConfig() {
  console.log('🔍 Validating Environment Configuration...\n');

  const requiredVars = {
    // Supabase Configuration
    'NEXT_PUBLIC_SUPABASE_URL': {
      required: true,
      pattern: /^https:\/\/[a-z0-9]+\.supabase\.co$/,
      description: 'Supabase project URL (format: https://your-project-ref.supabase.co)'
    },
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': {
      required: true,
      pattern: /^eyJ[A-Za-z0-9_-]+$/,
      description: 'Supabase anon/public key (JWT format)'
    },
    'SUPABASE_SERVICE_ROLE_KEY': {
      required: true,
      pattern: /^eyJ[A-Za-z0-9_-]+$/,
      description: 'Supabase service role key (JWT format)'
    },
    
    // Replicate Configuration
    'REPLICATE_API_TOKEN': {
      required: true,
      pattern: /^r8_[A-Za-z0-9]+$/,
      description: 'Replicate API token (format: r8_...)'
    },
    'REPLICATE_USERNAME': {
      required: true,
      pattern: /^[a-zA-Z0-9_-]+$/,
      description: 'Replicate username'
    },
    'REPLICATE_WEBHOOK_SECRET': {
      required: true,
      pattern: /.+/,
      description: 'Replicate webhook secret'
    },
    
    // Vercel Blob Configuration
    'BLOB_READ_WRITE_TOKEN': {
      required: true,
      pattern: /^vercel_blob_rw_[A-Za-z0-9_]+$/,
      description: 'Vercel Blob storage token (format: vercel_blob_rw_...)'
    },
    
    // App Configuration
    'APP_WEBHOOK_SECRET': {
      required: true,
      pattern: /.+/,
      description: 'Application webhook secret'
    },
    'DEPLOYMENT_URL': {
      required: true,
      pattern: /^https?:\/\/.+$/,
      description: 'Deployment URL for webhooks'
    }
  };

  let allValid = true;
  let validCount = 0;
  let totalCount = Object.keys(requiredVars).length;

  console.log('📋 Required Environment Variables:\n');

  for (const [varName, config] of Object.entries(requiredVars)) {
    const value = process.env[varName];
    let status = '';
    let message = '';

    if (!value) {
      status = '❌ Missing';
      message = `Required variable not set`;
      allValid = false;
    } else if (value.includes('your-') || value.includes('your_')) {
      status = '⚠️  Placeholder';
      message = `Still contains placeholder value`;
      allValid = false;
    } else if (!config.pattern.test(value)) {
      status = '❌ Invalid';
      message = `Format doesn't match expected pattern`;
      allValid = false;
    } else {
      status = '✅ Valid';
      message = 'Properly configured';
      validCount++;
    }

    console.log(`   ${varName}:`);
    console.log(`      Status: ${status}`);
    console.log(`      Description: ${config.description}`);
    console.log(`      Message: ${message}\n`);
  }

  // Summary
  console.log('📊 Validation Summary:');
  console.log(`   Valid: ${validCount}/${totalCount}`);
  console.log(`   Overall Status: ${allValid ? '✅ All Valid' : '❌ Issues Found'}\n`);

  if (!allValid) {
    console.log('🔧 To fix issues:');
    console.log('   1. Update .env.local with your actual Supabase credentials');
    console.log('   2. Replace any placeholder values with real configuration');
    console.log('   3. Ensure all tokens and URLs follow the expected format');
    console.log('   4. Run this script again to verify fixes\n');
  } else {
    console.log('🎉 All environment variables are properly configured!');
    console.log('   You can now run: node test-db-connection.js\n');
  }

  return allValid;
}

const isValid = validateEnvironmentConfig();
process.exit(isValid ? 0 : 1);