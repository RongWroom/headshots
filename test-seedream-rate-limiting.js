#!/usr/bin/env node

/**
 * Seedream Rate Limiting Test Suite
 * 
 * Tests rate limiting functionality for upload and generate endpoints
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Make HTTP request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      ...options
    };
    
    const req = lib.request(reqOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    
    req.end();
  });
}

/**
 * Sign in and get session cookie
 */
async function signIn() {
  log('\n=== Signing In ===', 'cyan');
  
  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    log('⚠ TEST_USER_EMAIL and TEST_USER_PASSWORD not set', 'yellow');
    log('  Set these environment variables to test authenticated endpoints', 'yellow');
    return null;
  }
  
  try {
    const response = await makeRequest(`${BASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD
      })
    });
    
    if (response.status === 200 && response.data.access_token) {
      log('✓ Signed in successfully', 'green');
      return response.data.access_token;
    } else {
      log(`✗ Sign in failed: ${response.status}`, 'red');
      return null;
    }
  } catch (error) {
    log(`✗ Sign in error: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Test upload rate limiting
 */
async function testUploadRateLimit(authToken) {
  log('\n=== Test 1: Upload Rate Limiting ===', 'cyan');
  
  if (!authToken) {
    log('⚠ Skipping test - no auth token', 'yellow');
    return;
  }
  
  log('  Testing upload rate limit (10 per hour)...', 'blue');
  
  // Create a simple test file
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
  const testFileContent = Buffer.from('fake image data');
  
  const formData = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="test.jpg"',
    'Content-Type: image/jpeg',
    '',
    testFileContent.toString('base64'),
    `--${boundary}--`
  ].join('\r\n');
  
  let rateLimitHit = false;
  let successCount = 0;
  let lastResponse = null;
  
  // Make requests until rate limit is hit (max 12 attempts)
  for (let i = 0; i < 12; i++) {
    try {
      const response = await makeRequest(`${BASE_URL}/api/seedream/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: formData
      });
      
      lastResponse = response;
      
      if (response.status === 429) {
        rateLimitHit = true;
        log(`  ✓ Rate limit hit after ${successCount} successful requests`, 'green');
        log(`    Status: ${response.status}`, 'blue');
        log(`    Error: ${response.data.error}`, 'blue');
        log(`    Retry-After: ${response.headers['retry-after']} seconds`, 'blue');
        log(`    X-RateLimit-Limit: ${response.headers['x-ratelimit-limit']}`, 'blue');
        log(`    X-RateLimit-Remaining: ${response.headers['x-ratelimit-remaining']}`, 'blue');
        break;
      } else if (response.status === 200 || response.status === 201) {
        successCount++;
        log(`  Request ${i + 1}: Success (${response.headers['x-ratelimit-remaining']} remaining)`, 'green');
      } else {
        log(`  Request ${i + 1}: Unexpected status ${response.status}`, 'yellow');
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      log(`  ✗ Request ${i + 1} failed: ${error.message}`, 'red');
    }
  }
  
  if (!rateLimitHit && successCount >= 10) {
    log('  ⚠ Rate limit not hit after 10+ requests (may need more attempts)', 'yellow');
  } else if (!rateLimitHit) {
    log('  ✗ Rate limit not hit and not enough successful requests', 'red');
  }
  
  // Verify rate limit headers are present
  if (lastResponse && lastResponse.headers['x-ratelimit-limit']) {
    log('  ✓ Rate limit headers present', 'green');
  } else {
    log('  ✗ Rate limit headers missing', 'red');
  }
}

/**
 * Test generate rate limiting
 */
async function testGenerateRateLimit(authToken) {
  log('\n=== Test 2: Generate Rate Limiting ===', 'cyan');
  
  if (!authToken) {
    log('⚠ Skipping test - no auth token', 'yellow');
    return;
  }
  
  log('  Testing generate rate limit (5 per hour)...', 'blue');
  
  const requestBody = {
    uploadId: '00000000-0000-0000-0000-000000000000', // Fake upload ID
    styleId: 'corporate-blue',
    numOutputs: 10
  };
  
  let rateLimitHit = false;
  let successCount = 0;
  let lastResponse = null;
  
  // Make requests until rate limit is hit (max 7 attempts)
  for (let i = 0; i < 7; i++) {
    try {
      const response = await makeRequest(`${BASE_URL}/api/seedream/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      lastResponse = response;
      
      if (response.status === 429) {
        rateLimitHit = true;
        log(`  ✓ Rate limit hit after ${successCount} requests`, 'green');
        log(`    Status: ${response.status}`, 'blue');
        log(`    Error: ${response.data.error}`, 'blue');
        log(`    Retry-After: ${response.headers['retry-after']} seconds`, 'blue');
        log(`    X-RateLimit-Limit: ${response.headers['x-ratelimit-limit']}`, 'blue');
        log(`    X-RateLimit-Remaining: ${response.headers['x-ratelimit-remaining']}`, 'blue');
        break;
      } else if (response.status === 404 || response.status === 400) {
        // Expected - upload doesn't exist, but rate limit still applies
        successCount++;
        log(`  Request ${i + 1}: Expected error (${response.headers['x-ratelimit-remaining']} remaining)`, 'green');
      } else if (response.status === 200 || response.status === 201) {
        successCount++;
        log(`  Request ${i + 1}: Success (${response.headers['x-ratelimit-remaining']} remaining)`, 'green');
      } else {
        log(`  Request ${i + 1}: Unexpected status ${response.status}`, 'yellow');
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      log(`  ✗ Request ${i + 1} failed: ${error.message}`, 'red');
    }
  }
  
  if (!rateLimitHit && successCount >= 5) {
    log('  ⚠ Rate limit not hit after 5+ requests (may need more attempts)', 'yellow');
  } else if (!rateLimitHit) {
    log('  ✗ Rate limit not hit and not enough requests', 'red');
  }
  
  // Verify rate limit headers are present
  if (lastResponse && lastResponse.headers['x-ratelimit-limit']) {
    log('  ✓ Rate limit headers present', 'green');
  } else {
    log('  ✗ Rate limit headers missing', 'red');
  }
}

/**
 * Test rate limit reset
 */
async function testRateLimitReset(authToken) {
  log('\n=== Test 3: Rate Limit Reset ===', 'cyan');
  
  if (!authToken) {
    log('⚠ Skipping test - no auth token', 'yellow');
    return;
  }
  
  log('  Note: This test would require waiting for the rate limit window to expire', 'yellow');
  log('  Skipping to avoid long test duration', 'yellow');
  log('  In production, verify that rate limits reset after the configured window', 'yellow');
}

/**
 * Test rate limit headers
 */
async function testRateLimitHeaders(authToken) {
  log('\n=== Test 4: Rate Limit Headers ===', 'cyan');
  
  if (!authToken) {
    log('⚠ Skipping test - no auth token', 'yellow');
    return;
  }
  
  log('  Testing rate limit headers on successful request...', 'blue');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/seedream/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uploadId: '00000000-0000-0000-0000-000000000000',
        styleId: 'corporate-blue'
      })
    });
    
    const requiredHeaders = [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset'
    ];
    
    let allHeadersPresent = true;
    
    for (const header of requiredHeaders) {
      if (response.headers[header]) {
        log(`  ✓ ${header}: ${response.headers[header]}`, 'green');
      } else {
        log(`  ✗ ${header}: missing`, 'red');
        allHeadersPresent = false;
      }
    }
    
    if (allHeadersPresent) {
      log('  ✓ All required rate limit headers present', 'green');
    } else {
      log('  ✗ Some rate limit headers missing', 'red');
    }
    
  } catch (error) {
    log(`  ✗ Test failed: ${error.message}`, 'red');
  }
}

/**
 * Test concurrent requests
 */
async function testConcurrentRequests(authToken) {
  log('\n=== Test 5: Concurrent Requests ===', 'cyan');
  
  if (!authToken) {
    log('⚠ Skipping test - no auth token', 'yellow');
    return;
  }
  
  log('  Testing rate limiting with concurrent requests...', 'blue');
  
  const requestBody = {
    uploadId: '00000000-0000-0000-0000-000000000000',
    styleId: 'corporate-blue'
  };
  
  // Make 3 concurrent requests
  const promises = [];
  for (let i = 0; i < 3; i++) {
    promises.push(
      makeRequest(`${BASE_URL}/api/seedream/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
    );
  }
  
  try {
    const responses = await Promise.all(promises);
    
    let successCount = 0;
    let rateLimitCount = 0;
    
    responses.forEach((response, index) => {
      if (response.status === 429) {
        rateLimitCount++;
        log(`  Request ${index + 1}: Rate limited`, 'yellow');
      } else {
        successCount++;
        log(`  Request ${index + 1}: Status ${response.status}`, 'green');
      }
    });
    
    log(`  ✓ Concurrent requests handled: ${successCount} success, ${rateLimitCount} rate limited`, 'green');
    
  } catch (error) {
    log(`  ✗ Test failed: ${error.message}`, 'red');
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('='.repeat(60), 'cyan');
  log('Seedream Rate Limiting Test Suite', 'bright');
  log('='.repeat(60), 'cyan');
  
  log(`\nBase URL: ${BASE_URL}`, 'blue');
  
  // Sign in
  const authToken = await signIn();
  
  if (!authToken) {
    log('\n⚠ Cannot run tests without authentication', 'yellow');
    log('  Set TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables', 'yellow');
    process.exit(1);
  }
  
  // Run tests
  await testUploadRateLimit(authToken);
  await testGenerateRateLimit(authToken);
  await testRateLimitReset(authToken);
  await testRateLimitHeaders(authToken);
  await testConcurrentRequests(authToken);
  
  log('\n' + '='.repeat(60), 'cyan');
  log('Test Suite Complete', 'bright');
  log('='.repeat(60), 'cyan');
  
  log('\nNote: Some tests may show warnings or errors due to:', 'yellow');
  log('  - Rate limits being hit (expected behavior)', 'yellow');
  log('  - Test data not existing (expected for validation)', 'yellow');
  log('  - Server not running or environment not configured', 'yellow');
}

// Run tests
runTests().catch(error => {
  log(`\n✗ Test suite failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
