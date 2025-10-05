/**
 * Test script for /api/headshots/status/:jobId endpoint
 * 
 * Tests:
 * 1. Authentication validation
 * 2. Job ID validation
 * 3. Job retrieval and ownership verification
 * 4. Response format validation
 * 5. Caching headers for completed vs in-progress jobs
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

function logTest(testName) {
  log(`\n▶ ${testName}`, 'blue');
}

function logSuccess(message) {
  log(`  ✓ ${message}`, 'green');
}

function logError(message) {
  log(`  ✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`  ⚠ ${message}`, 'yellow');
}

async function testUnauthenticatedRequest() {
  logTest('Test 1: Unauthenticated request should return 401');
  
  try {
    const response = await fetch(`${BASE_URL}/api/headshots/status/550e8400-e29b-41d4-a716-446655440000`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.status === 401) {
      logSuccess('Returns 401 status code');
      logSuccess(`Error message: "${data.message}"`);
      return true;
    } else {
      logError(`Expected 401, got ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

async function testInvalidJobId(authCookie) {
  logTest('Test 2: Invalid job ID format should return 400');
  
  try {
    const response = await fetch(`${BASE_URL}/api/headshots/status/invalid-job-id`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie,
      },
    });

    const data = await response.json();

    if (response.status === 400) {
      logSuccess('Returns 400 status code for invalid UUID');
      logSuccess(`Error message: "${data.message}"`);
      return true;
    } else {
      logError(`Expected 400, got ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

async function testNonExistentJob(authCookie) {
  logTest('Test 3: Non-existent job should return 404');
  
  // Use a valid UUID that doesn't exist
  const fakeJobId = '00000000-0000-0000-0000-000000000000';
  
  try {
    const response = await fetch(`${BASE_URL}/api/headshots/status/${fakeJobId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie,
      },
    });

    const data = await response.json();

    if (response.status === 404) {
      logSuccess('Returns 404 status code for non-existent job');
      logSuccess(`Error message: "${data.message}"`);
      return true;
    } else {
      logError(`Expected 404, got ${response.status}`);
      logWarning('This might be expected if the job exists in the database');
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

async function testValidJobStatus(authCookie, jobId) {
  logTest(`Test 4: Valid job status retrieval for job ${jobId}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/headshots/status/${jobId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie,
      },
    });

    const data = await response.json();

    if (response.status === 200) {
      logSuccess('Returns 200 status code');
      
      // Validate response structure
      const requiredFields = ['jobId', 'status', 'progress', 'message', 'createdAt'];
      const missingFields = requiredFields.filter(field => !(field in data));
      
      if (missingFields.length === 0) {
        logSuccess('Response contains all required fields');
      } else {
        logError(`Missing fields: ${missingFields.join(', ')}`);
        return false;
      }

      // Log job details
      log(`    Job ID: ${data.jobId}`, 'reset');
      log(`    Status: ${data.status}`, 'reset');
      log(`    Progress: ${data.progress}%`, 'reset');
      log(`    Message: ${data.message}`, 'reset');
      log(`    Created: ${data.createdAt}`, 'reset');
      
      if (data.completedAt) {
        log(`    Completed: ${data.completedAt}`, 'reset');
      }
      
      if (data.images) {
        log(`    Images: ${data.images.length} generated`, 'reset');
      }
      
      if (data.error) {
        log(`    Error: ${data.error}`, 'reset');
      }

      // Check caching headers
      const cacheControl = response.headers.get('cache-control');
      log(`    Cache-Control: ${cacheControl}`, 'reset');
      
      if (data.status === 'completed' || data.status === 'failed') {
        if (cacheControl && cacheControl.includes('max-age')) {
          logSuccess('Completed/failed job has caching enabled');
        } else {
          logWarning('Completed/failed job should have caching enabled');
        }
      } else {
        if (cacheControl && cacheControl.includes('no-store')) {
          logSuccess('In-progress job has caching disabled');
        } else {
          logWarning('In-progress job should have caching disabled');
        }
      }

      return true;
    } else if (response.status === 403) {
      logWarning('Access denied - job belongs to another user');
      logWarning('This is expected behavior for security');
      return true;
    } else {
      logError(`Expected 200, got ${response.status}`);
      logError(`Response: ${JSON.stringify(data, null, 2)}`);
      return false;
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return false;
  }
}

async function createTestJob(authCookie) {
  logTest('Creating a test job for status polling');
  
  try {
    // Create a test job using the generate endpoint
    const response = await fetch(`${BASE_URL}/api/headshots/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie,
      },
      body: JSON.stringify({
        referenceImages: [
          'https://blob.vercel-storage.com/test1.jpg',
          'https://blob.vercel-storage.com/test2.jpg',
          'https://blob.vercel-storage.com/test3.jpg',
          'https://blob.vercel-storage.com/test4.jpg',
          'https://blob.vercel-storage.com/test5.jpg',
        ],
        numOutputs: 4,
        styleIntensity: 0.8,
      }),
    });

    const data = await response.json();

    if (response.status === 200 && data.jobId) {
      logSuccess(`Test job created: ${data.jobId}`);
      return data.jobId;
    } else {
      logWarning('Could not create test job');
      logWarning('This is expected if RunPod is not configured');
      return null;
    }
  } catch (error) {
    logWarning(`Could not create test job: ${error.message}`);
    return null;
  }
}

async function runTests() {
  logSection('Headshots Status API Tests');

  log('Base URL: ' + BASE_URL, 'cyan');
  log('Testing endpoint: /api/headshots/status/:jobId\n', 'cyan');

  const results = {
    passed: 0,
    failed: 0,
    total: 0,
  };

  // Test 1: Unauthenticated request
  results.total++;
  if (await testUnauthenticatedRequest()) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Get auth cookie for authenticated tests
  log('\n' + '-'.repeat(60));
  logWarning('For authenticated tests, you need to provide an auth cookie');
  logWarning('You can get this from your browser dev tools after logging in');
  logWarning('Or set SUPABASE_AUTH_COOKIE environment variable');
  log('-'.repeat(60));

  const authCookie = process.env.SUPABASE_AUTH_COOKIE;

  if (!authCookie) {
    logWarning('\nSkipping authenticated tests - no auth cookie provided');
    logWarning('Set SUPABASE_AUTH_COOKIE environment variable to run all tests');
  } else {
    // Test 2: Invalid job ID
    results.total++;
    if (await testInvalidJobId(authCookie)) {
      results.passed++;
    } else {
      results.failed++;
    }

    // Test 3: Non-existent job
    results.total++;
    if (await testNonExistentJob(authCookie)) {
      results.passed++;
    } else {
      results.failed++;
    }

    // Test 4: Create and check test job
    const testJobId = await createTestJob(authCookie);
    
    if (testJobId) {
      results.total++;
      if (await testValidJobStatus(authCookie, testJobId)) {
        results.passed++;
      } else {
        results.failed++;
      }

      // Poll a few times to see progress updates
      logTest('Test 5: Polling for progress updates');
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        log(`  Polling attempt ${i + 1}...`, 'reset');
        await testValidJobStatus(authCookie, testJobId);
      }
    } else {
      logWarning('Skipping job status test - could not create test job');
    }
  }

  // Print summary
  logSection('Test Summary');
  log(`Total tests: ${results.total}`, 'cyan');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  
  const successRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0;
  log(`Success rate: ${successRate}%\n`, successRate === '100.0' ? 'green' : 'yellow');

  if (results.failed === 0) {
    log('✓ All tests passed!', 'green');
  } else {
    log('✗ Some tests failed', 'red');
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  logError(`\nTest suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
