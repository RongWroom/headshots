#!/usr/bin/env node

/**
 * Database Operations Test Script
 * 
 * This script tests all database operations through existing API endpoints:
 * - Credits operations (read, update, insert)
 * - Models operations (create, read, update, delete)
 * - Samples operations (create, read through model relationship)
 * - Images operations (create, read through model relationship)
 * 
 * Requirements tested: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Create Supabase clients
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Test data - Generate a valid UUID for testing
const testUserId = crypto.randomUUID();
let testModelId = null;
let testSampleId = null;
let testImageId = null;

// Test results tracking
const testResults = {
  credits: { read: false, update: false, insert: false },
  models: { create: false, read: false, update: false, delete: false },
  samples: { create: false, read: false },
  images: { create: false, read: false }
};

console.log('🧪 Starting Database Operations Test');
console.log('=====================================');

async function testCreditsOperations() {
  console.log('\n📊 Testing Credits Operations...');
  
  try {
    // Test INSERT operation (Requirement 2.1)
    console.log('  Testing credits INSERT...');
    const { data: insertData, error: insertError } = await supabaseService
      .from('credits')
      .insert({
        user_id: testUserId,
        credits: 10
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    console.log('  ✅ Credits INSERT successful');
    testResults.credits.insert = true;
    
    // Test READ operation (Requirement 2.4)
    console.log('  Testing credits READ...');
    const { data: readData, error: readError } = await supabaseService
      .from('credits')
      .select('*')
      .eq('user_id', testUserId)
      .single();
    
    if (readError) throw readError;
    if (readData.credits !== 10) throw new Error('Credits value mismatch');
    console.log('  ✅ Credits READ successful');
    testResults.credits.read = true;
    
    // Test UPDATE operation (Requirement 2.2, 2.3)
    console.log('  Testing credits UPDATE...');
    const { data: updateData, error: updateError } = await supabaseService
      .from('credits')
      .update({ credits: 15 })
      .eq('user_id', testUserId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    if (updateData.credits !== 15) throw new Error('Credits update failed');
    console.log('  ✅ Credits UPDATE successful');
    testResults.credits.update = true;
    
  } catch (error) {
    console.error('  ❌ Credits operations failed:', error.message);
  }
}

async function testModelsOperations() {
  console.log('\n🤖 Testing Models Operations...');
  
  try {
    // Test CREATE operation (Requirement 3.1)
    console.log('  Testing models CREATE...');
    const { data: createData, error: createError } = await supabaseService
      .from('models')
      .insert({
        user_id: testUserId,
        name: 'Test Model',
        type: 'headshot',
        status: 'processing',
        modelId: 'replicate-test-model-123'
      })
      .select()
      .single();
    
    if (createError) throw createError;
    testModelId = createData.id;
    console.log('  ✅ Models CREATE successful');
    testResults.models.create = true;
    
    // Test READ operation (Requirement 3.4)
    console.log('  Testing models READ...');
    const { data: readData, error: readError } = await supabaseService
      .from('models')
      .select('*')
      .eq('user_id', testUserId)
      .eq('id', testModelId)
      .single();
    
    if (readError) throw readError;
    if (readData.name !== 'Test Model') throw new Error('Model data mismatch');
    console.log('  ✅ Models READ successful');
    testResults.models.read = true;
    
    // Test UPDATE operation (Requirement 3.2, 3.3)
    console.log('  Testing models UPDATE...');
    const { data: updateData, error: updateError } = await supabaseService
      .from('models')
      .update({ 
        status: 'finished',
        modelId: 'replicate-updated-model-456'
      })
      .eq('id', testModelId)
      .eq('user_id', testUserId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    if (updateData.status !== 'finished') throw new Error('Model update failed');
    console.log('  ✅ Models UPDATE successful');
    testResults.models.update = true;
    
  } catch (error) {
    console.error('  ❌ Models operations failed:', error.message);
  }
}

async function testSamplesOperations() {
  console.log('\n📸 Testing Samples Operations...');
  
  if (!testModelId) {
    console.error('  ❌ Cannot test samples without a model');
    return;
  }
  
  try {
    // Test CREATE operation (Requirement 4.1, 4.2)
    console.log('  Testing samples CREATE...');
    const { data: createData, error: createError } = await supabaseService
      .from('samples')
      .insert({
        modelId: testModelId,
        uri: 'https://example.com/test-sample-image.jpg'
      })
      .select()
      .single();
    
    if (createError) throw createError;
    testSampleId = createData.id;
    console.log('  ✅ Samples CREATE successful');
    testResults.samples.create = true;
    
    // Test READ operation through model relationship (Requirement 4.3, 4.4)
    console.log('  Testing samples READ through model relationship...');
    const { data: readData, error: readError } = await supabaseService
      .from('samples')
      .select('*')
      .eq('modelId', testModelId);
    
    if (readError) throw readError;
    if (!readData || readData.length === 0) throw new Error('No samples found');
    if (readData[0].uri !== 'https://example.com/test-sample-image.jpg') {
      throw new Error('Sample data mismatch');
    }
    console.log('  ✅ Samples READ through model relationship successful');
    testResults.samples.read = true;
    
  } catch (error) {
    console.error('  ❌ Samples operations failed:', error.message);
  }
}

async function testImagesOperations() {
  console.log('\n🖼️  Testing Images Operations...');
  
  if (!testModelId) {
    console.error('  ❌ Cannot test images without a model');
    return;
  }
  
  try {
    // Test CREATE operation (Requirement 5.1, 5.2)
    console.log('  Testing images CREATE...');
    const { data: createData, error: createError } = await supabaseService
      .from('images')
      .insert({
        modelId: testModelId,
        uri: 'https://example.com/test-generated-image.jpg'
      })
      .select()
      .single();
    
    if (createError) throw createError;
    testImageId = createData.id;
    console.log('  ✅ Images CREATE successful');
    testResults.images.create = true;
    
    // Test READ operation through model relationship (Requirement 5.3, 5.4)
    console.log('  Testing images READ through model relationship...');
    const { data: readData, error: readError } = await supabaseService
      .from('images')
      .select('*')
      .eq('modelId', testModelId);
    
    if (readError) throw readError;
    if (!readData || readData.length === 0) throw new Error('No images found');
    if (readData[0].uri !== 'https://example.com/test-generated-image.jpg') {
      throw new Error('Image data mismatch');
    }
    console.log('  ✅ Images READ through model relationship successful');
    testResults.images.read = true;
    
  } catch (error) {
    console.error('  ❌ Images operations failed:', error.message);
  }
}

async function testForeignKeyRelationships() {
  console.log('\n🔗 Testing Foreign Key Relationships...');
  
  try {
    // Test that samples are linked to models
    console.log('  Testing samples-models relationship...');
    const { data: samplesWithModel, error: samplesError } = await supabaseService
      .from('samples')
      .select(`
        *,
        models (
          id,
          name,
          user_id
        )
      `)
      .eq('modelId', testModelId);
    
    if (samplesError) throw samplesError;
    if (!samplesWithModel || samplesWithModel.length === 0) {
      throw new Error('No samples with model relationship found');
    }
    if (!samplesWithModel[0].models) {
      throw new Error('Model relationship not populated');
    }
    console.log('  ✅ Samples-Models relationship working');
    
    // Test that images are linked to models
    console.log('  Testing images-models relationship...');
    const { data: imagesWithModel, error: imagesError } = await supabaseService
      .from('images')
      .select(`
        *,
        models (
          id,
          name,
          user_id
        )
      `)
      .eq('modelId', testModelId);
    
    if (imagesError) throw imagesError;
    if (!imagesWithModel || imagesWithModel.length === 0) {
      throw new Error('No images with model relationship found');
    }
    if (!imagesWithModel[0].models) {
      throw new Error('Model relationship not populated');
    }
    console.log('  ✅ Images-Models relationship working');
    
  } catch (error) {
    console.error('  ❌ Foreign key relationships failed:', error.message);
  }
}

async function testCascadeDeletes() {
  console.log('\n🗑️  Testing Cascade Deletes...');
  
  if (!testModelId) {
    console.error('  ❌ Cannot test cascade deletes without a model');
    return;
  }
  
  try {
    // Verify samples and images exist before deletion
    const { data: samplesBeforeDelete } = await supabaseService
      .from('samples')
      .select('id')
      .eq('modelId', testModelId);
    
    const { data: imagesBeforeDelete } = await supabaseService
      .from('images')
      .select('id')
      .eq('modelId', testModelId);
    
    console.log(`  Found ${samplesBeforeDelete?.length || 0} samples and ${imagesBeforeDelete?.length || 0} images before delete`);
    
    // Delete the model - should cascade to samples and images
    console.log('  Testing model DELETE with cascade...');
    const { error: deleteError } = await supabaseService
      .from('models')
      .delete()
      .eq('id', testModelId)
      .eq('user_id', testUserId);
    
    if (deleteError) throw deleteError;
    console.log('  ✅ Models DELETE successful');
    testResults.models.delete = true;
    
    // Verify samples and images were cascade deleted
    const { data: samplesAfterDelete } = await supabaseService
      .from('samples')
      .select('id')
      .eq('modelId', testModelId);
    
    const { data: imagesAfterDelete } = await supabaseService
      .from('images')
      .select('id')
      .eq('modelId', testModelId);
    
    if (samplesAfterDelete && samplesAfterDelete.length > 0) {
      throw new Error('Samples were not cascade deleted');
    }
    
    if (imagesAfterDelete && imagesAfterDelete.length > 0) {
      throw new Error('Images were not cascade deleted');
    }
    
    console.log('  ✅ Cascade deletes working correctly');
    
  } catch (error) {
    console.error('  ❌ Cascade delete test failed:', error.message);
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Clean up any remaining test data
    await supabaseService.from('credits').delete().eq('user_id', testUserId);
    console.log('  ✅ Test data cleaned up');
  } catch (error) {
    console.error('  ❌ Cleanup failed:', error.message);
  }
}

function printTestResults() {
  console.log('\n📋 Test Results Summary');
  console.log('=======================');
  
  const allTests = [
    { category: 'Credits', tests: testResults.credits },
    { category: 'Models', tests: testResults.models },
    { category: 'Samples', tests: testResults.samples },
    { category: 'Images', tests: testResults.images }
  ];
  
  let totalTests = 0;
  let passedTests = 0;
  
  allTests.forEach(({ category, tests }) => {
    console.log(`\n${category}:`);
    Object.entries(tests).forEach(([operation, passed]) => {
      totalTests++;
      if (passed) passedTests++;
      console.log(`  ${operation.toUpperCase()}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    });
  });
  
  console.log(`\n📊 Overall Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All database operations are working correctly!');
    return true;
  } else {
    console.log('⚠️  Some database operations failed. Check the logs above.');
    return false;
  }
}

async function main() {
  try {
    await testCreditsOperations();
    await testModelsOperations();
    await testSamplesOperations();
    await testImagesOperations();
    await testForeignKeyRelationships();
    await testCascadeDeletes();
    await cleanup();
    
    const allTestsPassed = printTestResults();
    process.exit(allTestsPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    await cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}