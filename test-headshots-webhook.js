/**
 * Test script for /api/headshots/webhook endpoint
 * 
 * This script tests the webhook endpoint that receives callbacks from RunPod
 * with generation progress updates and results.
 * 
 * Usage:
 *   node test-headshots-webhook.js
 */

const crypto = require('crypto');

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const WEBHOOK_URL = `${BASE_URL}/api/headshots/webhook`;
const WEBHOOK_SECRET = process.env.RUNPOD_WEBHOOK_SECRET || process.env.APP_WEBHOOK_SECRET || 'test-secret';

// Test job ID (you can replace with a real job ID from your database)
const TEST_JOB_ID = '00000000-0000-0000-0000-000000000001';

// Colors for console output
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

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Send webhook request
 */
async function sendWebhook(payload, options = {}) {
  const payloadString = JSON.stringify(payload);
  const signature = options.skipSignature ? null : generateSignature(payloadString, WEBHOOK_SECRET);
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (signature && !options.invalidSignature) {
    headers['x-webhook-signature'] = signature;
  } else if (options.invalidSignature) {
    headers['x-webhook-signature'] = 'invalid-signature-12345';
  }
  
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers,
    body: payloadString,
  });
  
  const data = await response.json();
  
  return {
    status: response.status,
    data,
    headers: Object.fromEntries(response.headers.entries())
  };
}

/**
 * Test 1: Processing webhook (progress update)
 */
async function testProcessingWebhook() {
  log('\n=== Test 1: Processing Webhook (Progress Update) ===', 'cyan');
  
  const payload = {
    jobId: TEST_JOB_ID,
    status: 'processing',
    progress: 50,
    message: 'Generating professional headshots...',
  };
  
  try {
    const result = await sendWebhook(payload);
    
    if (result.status === 200 && result.data.success) {
      log('✓ Processing webhook accepted', 'green');
      log(`  Job ID: ${result.data.jobId}`, 'blue');
      log(`  Status: ${result.data.status}`, 'blue');
    } else {
      log(`✗ Processing webhook failed: ${result.data.error || 'Unknown error'}`, 'red');
      console.log('Response:', result.data);
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
  }
}

/**
 * Test 2: Completed webhook with images (base64)
 */
async function testCompletedWebhook() {
  log('\n=== Test 2: Completed Webhook with Images ===', 'cyan');
  
  // Create a small test image (1x1 red pixel PNG)
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  
  const payload = {
    jobId: TEST_JOB_ID,
    status: 'completed',
    progress: 100,
    message: 'Complete!',
    images: [
      testImageBase64,
      testImageBase64,
      testImageBase64,
      testImageBase64,
    ],
    metadata: {
      generation_time: 87.5,
      detected_features: {
        gender: 'male',
        skin_tone: 'medium',
        hair_color: 'brown',
        age_range: '30-40'
      }
    }
  };
  
  try {
    const result = await sendWebhook(payload);
    
    if (result.status === 200 && result.data.success) {
      log('✓ Completed webhook accepted', 'green');
      log(`  Job ID: ${result.data.jobId}`, 'blue');
      log(`  Status: ${result.data.status}`, 'blue');
      log('  Note: Images should be uploaded to Vercel Blob', 'yellow');
    } else {
      log(`✗ Completed webhook failed: ${result.data.error || 'Unknown error'}`, 'red');
      console.log('Response:', result.data);
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
  }
}

/**
 * Test 3: Failed webhook with error
 */
async function testFailedWebhook() {
  log('\n=== Test 3: Failed Webhook with Error ===', 'cyan');
  
  const payload = {
    jobId: TEST_JOB_ID,
    status: 'failed',
    progress: 50,
    message: 'Generation failed',
    error: 'Face detection failed: No clear faces found in uploaded photos',
  };
  
  try {
    const result = await sendWebhook(payload);
    
    if (result.status === 200 && result.data.success) {
      log('✓ Failed webhook accepted', 'green');
      log(`  Job ID: ${result.data.jobId}`, 'blue');
      log(`  Status: ${result.data.status}`, 'blue');
    } else {
      log(`✗ Failed webhook rejected: ${result.data.error || 'Unknown error'}`, 'red');
      console.log('Response:', result.data);
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
  }
}

/**
 * Test 4: Invalid signature
 */
async function testInvalidSignature() {
  log('\n=== Test 4: Invalid Signature ===', 'cyan');
  
  const payload = {
    jobId: TEST_JOB_ID,
    status: 'processing',
    progress: 30,
    message: 'Processing...',
  };
  
  try {
    const result = await sendWebhook(payload, { invalidSignature: true });
    
    if (result.status === 401) {
      log('✓ Invalid signature rejected correctly', 'green');
    } else {
      log(`✗ Invalid signature should be rejected with 401, got ${result.status}`, 'red');
      console.log('Response:', result.data);
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
  }
}

/**
 * Test 5: Missing signature (should warn but allow in dev)
 */
async function testMissingSignature() {
  log('\n=== Test 5: Missing Signature ===', 'cyan');
  
  const payload = {
    jobId: TEST_JOB_ID,
    status: 'processing',
    progress: 40,
    message: 'Processing...',
  };
  
  try {
    const result = await sendWebhook(payload, { skipSignature: true });
    
    if (result.status === 200) {
      log('✓ Missing signature allowed (development mode)', 'green');
      log('  Note: This should be rejected in production', 'yellow');
    } else {
      log(`✗ Unexpected status: ${result.status}`, 'red');
      console.log('Response:', result.data);
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
  }
}

/**
 * Test 6: Invalid payload (missing required fields)
 */
async function testInvalidPayload() {
  log('\n=== Test 6: Invalid Payload (Missing Required Fields) ===', 'cyan');
  
  const payload = {
    // Missing jobId and status
    progress: 50,
    message: 'Processing...',
  };
  
  try {
    const result = await sendWebhook(payload);
    
    if (result.status === 400) {
      log('✓ Invalid payload rejected correctly', 'green');
    } else {
      log(`✗ Invalid payload should be rejected with 400, got ${result.status}`, 'red');
      console.log('Response:', result.data);
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
  }
}

/**
 * Test 7: Idempotency (duplicate webhook)
 */
async function testIdempotency() {
  log('\n=== Test 7: Idempotency (Duplicate Webhook) ===', 'cyan');
  
  const payload = {
    jobId: TEST_JOB_ID,
    status: 'processing',
    progress: 60,
    message: 'Refining photography style...',
  };
  
  try {
    // Send first webhook
    const result1 = await sendWebhook(payload);
    
    if (result1.status === 200 && result1.data.success) {
      log('✓ First webhook accepted', 'green');
    } else {
      log(`✗ First webhook failed`, 'red');
      return;
    }
    
    // Send duplicate webhook immediately
    const result2 = await sendWebhook(payload);
    
    if (result2.status === 200 && result2.data.duplicate) {
      log('✓ Duplicate webhook detected and handled correctly', 'green');
    } else if (result2.status === 200 && result2.data.success) {
      log('⚠ Duplicate webhook processed (may be expected if idempotency window expired)', 'yellow');
    } else {
      log(`✗ Duplicate webhook handling failed`, 'red');
      console.log('Response:', result2.data);
    }
  } catch (error) {
    log(`✗ Error: ${error.message}`, 'red');
  }
}

/**
 * Test 8: Rate limiting
 */
async function testRateLimiting() {
  log('\n=== Test 8: Rate Limiting ===', 'cyan');
  log('  Note: This test is skipped to avoid hitting rate limits', 'yellow');
  log('  To test rate limiting, send 100+ requests rapidly', 'yellow');
  
  // Uncomment to test rate limiting (will send many requests)
  /*
  const payload = {
    jobId: TEST_JOB_ID,
    status: 'processing',
    progress: 70,
    message: 'Processing...',
  };
  
  let rateLimited = false;
  
  for (let i = 0; i < 105; i++) {
    const result = await sendWebhook(payload);
    
    if (result.status === 429) {
      rateLimited = true;
      log(`✓ Rate limit triggered after ${i + 1} requests`, 'green');
      log(`  Retry-After: ${result.headers['retry-after']} seconds`, 'blue');
      break;
    }
  }
  
  if (!rateLimited) {
    log('⚠ Rate limit not triggered (may need more requests)', 'yellow');
  }
  */
}

/**
 * Run all tests
 */
async function runAllTests() {
  log('='.repeat(60), 'cyan');
  log('HEADSHOTS WEBHOOK ENDPOINT TESTS', 'cyan');
  log('='.repeat(60), 'cyan');
  log(`\nWebhook URL: ${WEBHOOK_URL}`, 'blue');
  log(`Test Job ID: ${TEST_JOB_ID}`, 'blue');
  log(`Webhook Secret: ${WEBHOOK_SECRET ? '***configured***' : 'NOT CONFIGURED'}`, 'blue');
  
  if (!WEBHOOK_SECRET) {
    log('\n⚠ WARNING: WEBHOOK_SECRET not configured. Set RUNPOD_WEBHOOK_SECRET or APP_WEBHOOK_SECRET', 'yellow');
  }
  
  await testProcessingWebhook();
  await testCompletedWebhook();
  await testFailedWebhook();
  await testInvalidSignature();
  await testMissingSignature();
  await testInvalidPayload();
  await testIdempotency();
  await testRateLimiting();
  
  log('\n' + '='.repeat(60), 'cyan');
  log('TESTS COMPLETE', 'cyan');
  log('='.repeat(60), 'cyan');
  log('\nNOTE: Some tests may fail if:', 'yellow');
  log('  - The test job ID does not exist in your database', 'yellow');
  log('  - Vercel Blob Storage is not configured', 'yellow');
  log('  - Database connection fails', 'yellow');
  log('\nTo create a test job, run the generate endpoint first:', 'yellow');
  log('  node test-headshots-generate-api.js', 'yellow');
}

// Run tests
runAllTests().catch(error => {
  log(`\n✗ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
