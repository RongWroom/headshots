/**
 * Debug script for Seedream upload API
 * Tests the upload endpoint and provides detailed error information
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function testUploadAPI() {
  console.log('🧪 Testing Seedream Upload API\n');

  // Check environment variables
  console.log('📋 Environment Check:');
  console.log('  NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.log('  NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
  console.log('  BLOB_READ_WRITE_TOKEN:', process.env.BLOB_READ_WRITE_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('');

  // Check if migration has been run
  console.log('🗄️  Database Check:');
  console.log('  Checking if seedream_uploads table exists...');
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Try to query the table (this will fail if table doesn't exist)
    const { data, error } = await supabase
      .from('seedream_uploads')
      .select('id')
      .limit(1);

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('  ❌ Table does not exist!');
        console.log('  📝 You need to run the migration:');
        console.log('     supabase/migrations/20250930000000_add_seedream_integration.sql');
        console.log('');
        console.log('  To run the migration:');
        console.log('  1. Go to your Supabase dashboard');
        console.log('  2. Navigate to SQL Editor');
        console.log('  3. Copy and paste the migration SQL');
        console.log('  4. Run the query');
        return;
      } else {
        console.log('  ⚠️  Error querying table:', error.message);
        console.log('  Details:', JSON.stringify(error, null, 2));
      }
    } else {
      console.log('  ✅ Table exists and is accessible');
    }
    console.log('');

    // Check table structure
    console.log('📊 Table Structure Check:');
    const { data: columns, error: structureError } = await supabase
      .rpc('get_table_columns', { table_name: 'seedream_uploads' })
      .catch(() => {
        // If RPC doesn't exist, try a different approach
        return { data: null, error: null };
      });

    if (columns) {
      console.log('  Columns:', columns);
    } else {
      console.log('  ℹ️  Cannot retrieve column information (this is normal)');
    }
    console.log('');

    // Test insert with mock data
    console.log('🧪 Testing Insert Operation:');
    console.log('  Attempting to insert test record...');
    
    const testUploadId = crypto.randomUUID();
    const testUserId = '00000000-0000-0000-0000-000000000000'; // Dummy user ID
    
    const { data: insertData, error: insertError } = await supabase
      .from('seedream_uploads')
      .insert({
        id: testUploadId,
        user_id: testUserId,
        images: [
          {
            filename: 'test.jpg',
            blobUrl: 'https://example.com/test.jpg',
            size: 1024
          }
        ]
      })
      .select()
      .single();

    if (insertError) {
      console.log('  ❌ Insert failed:', insertError.message);
      console.log('  Error code:', insertError.code);
      console.log('  Error details:', JSON.stringify(insertError, null, 2));
      
      if (insertError.code === '23503') {
        console.log('');
        console.log('  💡 This is a foreign key constraint error.');
        console.log('     The test user ID does not exist in the auth.users table.');
        console.log('     This is expected - you need to use a real authenticated user.');
      } else if (insertError.code === '42501') {
        console.log('');
        console.log('  💡 This is a permission error.');
        console.log('     RLS policies might be preventing the insert.');
        console.log('     Make sure you are authenticated when testing.');
      }
    } else {
      console.log('  ✅ Insert successful!');
      console.log('  Record:', JSON.stringify(insertData, null, 2));
      
      // Clean up test record
      await supabase
        .from('seedream_uploads')
        .delete()
        .eq('id', testUploadId);
      console.log('  🧹 Test record cleaned up');
    }
    console.log('');

    // Summary
    console.log('📝 Summary:');
    console.log('  If you see foreign key errors (23503), this is normal.');
    console.log('  The upload API needs a real authenticated user.');
    console.log('  Make sure you are signed in when testing the upload component.');
    console.log('');
    console.log('  If you see "relation does not exist" errors:');
    console.log('  1. Run the migration in Supabase SQL Editor');
    console.log('  2. Refresh your database connection');
    console.log('  3. Try again');

  } catch (error) {
    console.log('  ❌ Error:', error.message);
    console.log('  Stack:', error.stack);
  }
}

// Run the test
testUploadAPI().catch(console.error);
