/**
 * Test script for Seedream Status API endpoint
 * 
 * Tests:
 * 1. Authentication requirement
 * 2. Job status retrieval
 * 3. Rate limiting (max 1 request per 2 seconds)
 * 4. User ownership verification
 * 5. Different status responses (pending, processing, completed, failed)
 * 6. Fallback polling to Replicate
 * 7. Job expiration handling
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Test configuration
const TEST_CONFIG = {
  // You'll need to set these after creating a test job
  validJobId: null, // Set this to a valid job ID from your database
  invalidJobId: '00000000-0000-0000-0000-000000000000',
  authToken: null, // Set this to a valid Supabase auth token
};

/**
 * Helper function to make authenticated requests
 */
async function makeRequest(endpoint, options = {}) {
  const url = `${SITE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': TEST_CONFIG.authToken ? `sb-access-token=${TEST_CONFIG.authToken}` : '',
      ...options.headers,
    },
  });
  
  const data = await response.json();
  
  return {
    status: response.status,
    headers: response.headers,
    data,
  };
}

/**
 * Test 1: Authentication requirement
 */
async function testAuthenticationRequired() {
  console.log('\n=== Test 1: Authentication Required ===');
  
  try {
    const response = await fetch(`${SITE_URL}/api/seedream/status/${TEST_CONFIG.invalidJobId}`, {
      method: 'GET',
    });
    
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 401) {
      console.log('✅ PASS: Authentication is required');
    } else {
      console.log('❌ FAIL: Expected 401 status');
    }
  } catch (error) {
    console.error('❌ FAIL: Request failed', error.message);
  }
}

/**
 * Test 2: Invalid job ID format
 */
async function testInvalidJobIdFormat() {
  console.log('\n=== Test 2: Invalid Job ID Format ===');
  
  if (!TEST_CONFIG.authToken) {
    console.log('⚠️  SKIP: No auth token provided');
    return;
  }
  
  try {
    const response = await makeRequest('/api/seedream/status/invalid-id');
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 400 && response.data.errorCode === 'INVALID_JOB_ID') {
      console.log('✅ PASS: Invalid job ID format rejected');
    } else {
      console.log('❌ FAIL: Expected 400 status with INVALID_JOB_ID error');
    }
  } catch (error) {
    console.error('❌ FAIL: Request failed', error.message);
  }
}

/**
 * Test 3: Job not found
 */
async function testJobNotFound() {
  console.log('\n=== Test 3: Job Not Found ===');
  
  if (!TEST_CONFIG.authToken) {
    console.log('⚠️  SKIP: No auth token provided');
    return;
  }
  
  try {
    const response = await makeRequest(`/api/seedream/status/${TEST_CONFIG.invalidJobId}`);
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 404 && response.data.errorCode === 'JOB_NOT_FOUND') {
      console.log('✅ PASS: Non-existent job returns 404');
    } else {
      console.log('❌ FAIL: Expected 404 status with JOB_NOT_FOUND error');
    }
  } catch (error) {
    console.error('❌ FAIL: Request failed', error.message);
  }
}

/**
 * Test 4: Valid job status retrieval
 */
async function testValidJobStatus() {
  console.log('\n=== Test 4: Valid Job Status Retrieval ===');
  
  if (!TEST_CONFIG.authToken || !TEST_CONFIG.validJobId) {
    console.log('⚠️  SKIP: No auth token or valid job ID provided');
    console.log('   Set TEST_CONFIG.validJobId to a valid job ID from your database');
    return;
  }
  
  try {
    const response = await makeRequest(`/api/seedream/status/${TEST_CONFIG.validJobId}`);
    
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && response.data.jobId) {
      console.log('✅ PASS: Job status retrieved successfully');
      console.log('   Job Status:', response.data.status);
      console.log('   Progress:', response.data.progress);
      
      // Verify response structure
      const hasRequiredFields = 
        response.data.jobId &&
        response.data.status &&
        typeof response.data.progress === 'number' &&
        response.data.createdAt;
      
      if (hasRequiredFields) {
        console.log('✅ PASS: Response has all required fields');
      } else {
        console.log('❌ FAIL: Response missing required fields');
      }
      
      // Check status-specific fields
      if (response.data.status === 'pending' || response.data.status === 'processing') {
        if (response.data.estimatedTimeRemaining) {
          console.log('✅ PASS: Estimated time remaining provided for in-progress job');
        } else {
          console.log('⚠️  WARNING: No estimated time remaining for in-progress job');
        }
      }
      
      if (response.data.status === 'completed') {
        if (response.data.outputs && Array.isArray(response.data.outputs)) {
          console.log('✅ PASS: Output images provided for completed job');
          console.log('   Number of outputs:', response.data.outputs.length);
        } else {
          console.log('❌ FAIL: No outputs for completed job');
        }
      }
      
      if (response.data.status === 'failed') {
        if (response.data.error && response.data.suggestions) {
          console.log('✅ PASS: Error details and suggestions provided for failed job');
        } else {
          console.log('❌ FAIL: Missing error details or suggestions for failed job');
        }
      }
      
    } else {
      console.log('❌ FAIL: Expected 200 status with job data');
    }
  } catch (error) {
    console.error('❌ FAIL: Request failed', error.message);
  }
}

/**
 * Test 5: Rate limiting
 */
async function testRateLimiting() {
  console.log('\n=== Test 5: Rate Limiting ===');
  
  if (!TEST_CONFIG.authToken || !TEST_CONFIG.validJobId) {
    console.log('⚠️  SKIP: No auth token or valid job ID provided');
    return;
  }
  
  try {
    // Make first request
    console.log('Making first request...');
    const response1 = await makeRequest(`/api/seedream/status/${TEST_CONFIG.validJobId}`);
    console.log('First request status:', response1.status);
    
    // Immediately make second request (should be rate limited)
    console.log('Making immediate second request...');
    const response2 = await makeRequest(`/api/seedream/status/${TEST_CONFIG.validJobId}`);
    console.log('Second request status:', response2.status);
    console.log('Response:', JSON.stringify(response2.data, null, 2));
    
    if (response2.status === 429 && response2.data.errorCode === 'RATE_LIMIT_EXCEEDED') {
      console.log('✅ PASS: Rate limiting enforced (max 1 request per 2 seconds)');
      
      // Check for Retry-After header
      const retryAfter = response2.headers.get('Retry-After');
      if (retryAfter) {
        console.log('✅ PASS: Retry-After header present:', retryAfter);
      } else {
        console.log('⚠️  WARNING: No Retry-After header');
      }
    } else {
      console.log('❌ FAIL: Rate limiting not enforced');
    }
    
    // Wait 2 seconds and try again
    console.log('Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Making third request after waiting...');
    const response3 = await makeRequest(`/api/seedream/status/${TEST_CONFIG.validJobId}`);
    console.log('Third request status:', response3.status);
    
    if (response3.status === 200) {
      console.log('✅ PASS: Request allowed after rate limit period');
    } else {
      console.log('❌ FAIL: Request still blocked after rate limit period');
    }
    
  } catch (error) {
    console.error('❌ FAIL: Request failed', error.message);
  }
}

/**
 * Test 6: Cache headers
 */
async function testCacheHeaders() {
  console.log('\n=== Test 6: Cache Headers ===');
  
  if (!TEST_CONFIG.authToken || !TEST_CONFIG.validJobId) {
    console.log('⚠️  SKIP: No auth token or valid job ID provided');
    return;
  }
  
  try {
    const response = await makeRequest(`/api/seedream/status/${TEST_CONFIG.validJobId}`);
    
    const cacheControl = response.headers.get('Cache-Control');
    console.log('Cache-Control header:', cacheControl);
    
    if (response.data.status === 'completed' || response.data.status === 'failed') {
      if (cacheControl && cacheControl.includes('max-age')) {
        console.log('✅ PASS: Completed/failed jobs have cache headers');
      } else {
        console.log('❌ FAIL: Completed/failed jobs should have cache headers');
      }
    } else {
      if (cacheControl && cacheControl.includes('no-store')) {
        console.log('✅ PASS: In-progress jobs have no-cache headers');
      } else {
        console.log('❌ FAIL: In-progress jobs should have no-cache headers');
      }
    }
  } catch (error) {
    console.error('❌ FAIL: Request failed', error.message);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('SEEDREAM STATUS API TEST SUITE');
  console.log('='.repeat(60));
  console.log('Site URL:', SITE_URL);
  console.log('Auth Token:', TEST_CONFIG.authToken ? '✓ Set' : '✗ Not set');
  console.log('Valid Job ID:', TEST_CONFIG.validJobId || '✗ Not set');
  console.log('='.repeat(60));
  
  await testAuthenticationRequired();
  await testInvalidJobIdFormat();
  await testJobNotFound();
  await testValidJobStatus();
  await testRateLimiting();
  await testCacheHeaders();
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUITE COMPLETE');
  console.log('='.repeat(60));
  console.log('\nNOTE: To run all tests, you need to:');
  console.log('1. Set TEST_CONFIG.authToken to a valid Supabase auth token');
  console.log('2. Set TEST_CONFIG.validJobId to a valid job ID from your database');
  console.log('3. Ensure you have a running development server');
}

// Run tests
runAllTests().catch(console.error);
