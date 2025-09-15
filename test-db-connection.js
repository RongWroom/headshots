#!/usr/bin/env node

/**
 * Database Connection Test Script
 * 
 * This script tests the Supabase database connection using the environment variables
 * configured in .env.local. It verifies that:
 * 1. Environment variables are properly set
 * 2. Database connection can be established
 * 3. Basic table access works (credits, models, samples, images)
 * 
 * Usage: node test-db-connection.js
 */

const { createClient } = require('@supabase/supabase-js');

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

async function testDatabaseConnection() {
  console.log('🔍 Testing Supabase Database Connection...\n');

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('📋 Environment Variables Check:');
  console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`   NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? '✅ Set' : '❌ Missing'}\n`);

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.log('❌ Missing required environment variables. Please update .env.local with your new Supabase credentials.');
    process.exit(1);
  }

  // Test with anon key (client-side access)
  console.log('🔗 Testing connection with anon key...');
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    const { data, error } = await anonClient.from('credits').select('count').limit(1);
    if (error) {
      console.log(`   ❌ Anon client error: ${error.message}`);
    } else {
      console.log('   ✅ Anon client connection successful');
    }
  } catch (err) {
    console.log(`   ❌ Anon client connection failed: ${err.message}`);
  }

  // Test with service role key (server-side access)
  console.log('🔗 Testing connection with service role key...');
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const { data, error } = await serviceClient.from('credits').select('count').limit(1);
    if (error) {
      console.log(`   ❌ Service client error: ${error.message}`);
    } else {
      console.log('   ✅ Service client connection successful');
    }
  } catch (err) {
    console.log(`   ❌ Service client connection failed: ${err.message}`);
  }

  // Test table access
  console.log('\n📊 Testing table access...');
  const tables = ['credits', 'models', 'samples', 'images'];
  
  for (const table of tables) {
    try {
      const { data, error } = await serviceClient.from(table).select('*').limit(1);
      if (error) {
        console.log(`   ${table}: ❌ ${error.message}`);
      } else {
        console.log(`   ${table}: ✅ Accessible`);
      }
    } catch (err) {
      console.log(`   ${table}: ❌ ${err.message}`);
    }
  }

  console.log('\n🎉 Database connection test completed!');
  console.log('\n💡 Next steps:');
  console.log('   1. If you see errors above, verify your Supabase credentials in .env.local');
  console.log('   2. Ensure your database schema has been created (run the migration SQL)');
  console.log('   3. Check that RLS policies are properly configured');
}

testDatabaseConnection().catch(console.error);