/**
 * Test script for Seedream Generate API endpoint
 * 
 * This script tests the /api/seedream/generate endpoint with various scenarios:
 * 1. Valid generation request
 * 2. Invalid uploadId
 * 3. Invalid styleId
 * 4. Missing required fields
 * 5. Invalid customizations
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Test configuration
const TEST_CONFIG = {
  // You'll need to replace this with a real upload ID from a previous upload
  validUploadId: 'REPLACE_WITH_REAL_UPLOAD_ID',
  validStyleId: 'corporate-blue',
  invalidUploadId: '00000000-0000-0000-0000-000000000000',
  invalidStyleId: 'non-existent-style',
};

// Helper function to make API requests
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`\n🔵 Making request to: ${url}`);
  console.log(`📤 Method: ${options.method || 'GET'}`);
  
  if (options.body) {
    console.log(`📦 Body:`, JSON.stringify(JSON.parse(options.body), null, 2));
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    const data = await response.json();
    
    console.log(`📥 Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(data, null, 2));
    
    return { response, data };
  } catch (error) {
    console.error(`❌ Request failed:`, error.message);
    throw error;
  }
}

// Test 1: Valid generation request
async function testValidGeneration() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: Valid Generation Request');
  console.log('='.repeat(80));
  
  try {
    const { response, data } = await makeRequest('/api/seedream/generate', {
      method: 'POST',
      body: JSON.stringify({
        uploadId: TEST_CONFIG.validUploadId,
        styleId: TEST_CONFIG.validStyleId,
        numOutputs: 10,
        customizations: {
          removeJewelry: true,
          removeGlasses: false,
          removePiercings: false,
          cleanBackground: true
        }
      }),
    });
    
    if (response.status === 200 && data.success) {
      console.log('✅ TEST PASSED: Valid generation request succeeded');
      console.log(`   Job ID: ${data.jobId}`);
      console.log(`   Poll URL: ${data.pollUrl}`);
      console.log(`   Estimated Time: ${data.estimatedTime}`);
      return data.jobId;
    } else if (response.status === 401) {
      console.log('⚠️  TEST SKIPPED: Authentication required (expected for this test)');
      return null;
    } else {
      console.log('❌ TEST FAILED: Unexpected response');
      return null;
    }
  } catch (error) {
    console.log('❌ TEST FAILED:', error.message);
    return null;
  }
}

// Test 2: Invalid uploadId
async function testInvalidUploadId() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Invalid Upload ID');
  console.log('='.repeat(80));
  
  try {
    const { response, data } = await makeRequest('/api/seedream/generate', {
      method: 'POST',
      body: JSON.stringify({
        uploadId: TEST_CONFIG.invalidUploadId,
        styleId: TEST_CONFIG.validStyleId,
        numOutputs: 10
      }),
    });
    
    if (response.status === 404 || response.status === 401) {
      console.log('✅ TEST PASSED: Invalid uploadId properly rejected');
    } else {
      console.log('❌ TEST FAILED: Should have returned 404 or 401');
    }
  } catch (error) {
    console.log('❌ TEST FAILED:', error.message);
  }
}

// Test 3: Invalid styleId
async function testInvalidStyleId() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Invalid Style ID');
  console.log('='.repeat(80));
  
  try {
    const { response, data } = await makeRequest('/api/seedream/generate', {
      method: 'POST',
      body: JSON.stringify({
        uploadId: TEST_CONFIG.validUploadId,
        styleId: TEST_CONFIG.invalidStyleId,
        numOutputs: 10
      }),
    });
    
    if (response.status === 400 && data.errorCode === 'VALIDATION_ERROR') {
      console.log('✅ TEST PASSED: Invalid styleId properly rejected');
    } else if (response.status === 401) {
      console.log('⚠️  TEST SKIPPED: Authentication required');
    } else {
      console.log('❌ TEST FAILED: Should have returned 400 with VALIDATION_ERROR');
    }
  } catch (error) {
    console.log('❌ TEST FAILED:', error.message);
  }
}

// Test 4: Missing required fields
async function testMissingFields() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 4: Missing Required Fields');
  console.log('='.repeat(80));
  
  try {
    const { response, data } = await makeRequest('/api/seedream/generate', {
      method: 'POST',
      body: JSON.stringify({
        // Missing uploadId and styleId
        numOutputs: 10
      }),
    });
    
    if (response.status === 400 && data.errorCode === 'VALIDATION_ERROR') {
      console.log('✅ TEST PASSED: Missing fields properly rejected');
      console.log(`   Validation errors: ${data.details?.validationErrors?.join(', ')}`);
    } else {
      console.log('❌ TEST FAILED: Should have returned 400 with VALIDATION_ERROR');
    }
  } catch (error) {
    console.log('❌ TEST FAILED:', error.message);
  }
}

// Test 5: Invalid customizations
async function testInvalidCustomizations() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 5: Invalid Customizations');
  console.log('='.repeat(80));
  
  try {
    const { response, data } = await makeRequest('/api/seedream/generate', {
      method: 'POST',
      body: JSON.stringify({
        uploadId: TEST_CONFIG.validUploadId,
        styleId: TEST_CONFIG.validStyleId,
        numOutputs: 10,
        customizations: {
          removeJewelry: 'yes', // Should be boolean
          invalidKey: true // Invalid key
        }
      }),
    });
    
    if (response.status === 400 && data.errorCode === 'VALIDATION_ERROR') {
      console.log('✅ TEST PASSED: Invalid customizations properly rejected');
      console.log(`   Validation errors: ${data.details?.validationErrors?.join(', ')}`);
    } else if (response.status === 401) {
      console.log('⚠️  TEST SKIPPED: Authentication required');
    } else {
      console.log('❌ TEST FAILED: Should have returned 400 with VALIDATION_ERROR');
    }
  } catch (error) {
    console.log('❌ TEST FAILED:', error.message);
  }
}

// Test 6: Invalid numOutputs
async function testInvalidNumOutputs() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 6: Invalid numOutputs');
  console.log('='.repeat(80));
  
  try {
    const { response, data } = await makeRequest('/api/seedream/generate', {
      method: 'POST',
      body: JSON.stringify({
        uploadId: TEST_CONFIG.validUploadId,
        styleId: TEST_CONFIG.validStyleId,
        numOutputs: 15 // Should be max 10
      }),
    });
    
    if (response.status === 400 && data.errorCode === 'VALIDATION_ERROR') {
      console.log('✅ TEST PASSED: Invalid numOutputs properly rejected');
      console.log(`   Validation errors: ${data.details?.validationErrors?.join(', ')}`);
    } else if (response.status === 401) {
      console.log('⚠️  TEST SKIPPED: Authentication required');
    } else {
      console.log('❌ TEST FAILED: Should have returned 400 with VALIDATION_ERROR');
    }
  } catch (error) {
    console.log('❌ TEST FAILED:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n' + '🚀'.repeat(40));
  console.log('SEEDREAM GENERATE API TEST SUITE');
  console.log('🚀'.repeat(40));
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`Test Upload ID: ${TEST_CONFIG.validUploadId}`);
  console.log(`Test Style ID: ${TEST_CONFIG.validStyleId}`);
  
  console.log('\n⚠️  NOTE: Most tests will be skipped without authentication.');
  console.log('To run full tests, you need to:');
  console.log('1. Upload images using test-seedream-upload.js');
  console.log('2. Copy the uploadId from the response');
  console.log('3. Update TEST_CONFIG.validUploadId in this file');
  console.log('4. Add authentication headers to the requests');
  
  // Run tests
  await testMissingFields(); // This should work without auth
  await testInvalidStyleId();
  await testInvalidCustomizations();
  await testInvalidNumOutputs();
  await testInvalidUploadId();
  const jobId = await testValidGeneration();
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUITE COMPLETE');
  console.log('='.repeat(80));
  
  if (jobId) {
    console.log(`\n✅ Generation job created successfully!`);
    console.log(`   Job ID: ${jobId}`);
    console.log(`\n📊 To check the status, run:`);
    console.log(`   curl ${BASE_URL}/api/seedream/status/${jobId}`);
  } else {
    console.log(`\n⚠️  No job created (authentication required for full test)`);
  }
  
  console.log('\n' + '='.repeat(80));
}

// Run the tests
runAllTests().catch(console.error);
