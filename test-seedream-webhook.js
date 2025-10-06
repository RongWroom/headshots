/**
 * Test script for Seedream webhook endpoint
 * Tests webhook signature verification, payload processing, and image handling
 */

const crypto = require('crypto');

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.REPLICATE_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  console.error('❌ REPLICATE_WEBHOOK_SECRET environment variable is required');
  process.exit(1);
}

/**
 * Generate webhook signature
 */
function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Test webhook with valid signature
 */
async function testValidWebhook() {
  console.log('\n🧪 Test 1: Valid webhook with signature');
  console.log('='.repeat(50));

  const payload = {
    id: 'test-prediction-123',
    status: 'processing',
    output: null,
    error: null,
    metrics: null
  };

  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, WEBHOOK_SECRET);

  try {
    const response = await fetch(`${BASE_URL}/api/seedream/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'replicate-signature': signature
      },
      body: payloadString
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 404) {
      console.log('✅ Expected: Job not found (no job with this prediction ID)');
    } else if (response.ok) {
      console.log('✅ Webhook accepted');
    } else {
      console.log('❌ Unexpected response');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Test webhook with invalid signature
 */
async function testInvalidSignature() {
  console.log('\n🧪 Test 2: Invalid webhook signature');
  console.log('='.repeat(50));

  const payload = {
    id: 'test-prediction-456',
    status: 'processing',
    output: null,
    error: null
  };

  const payloadString = JSON.stringify(payload);
  const invalidSignature = 'sha256=invalid_signature_here';

  try {
    const response = await fetch(`${BASE_URL}/api/seedream/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'replicate-signature': invalidSignature
      },
      body: payloadString
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 401) {
      console.log('✅ Correctly rejected invalid signature');
    } else {
      console.log('❌ Should have rejected invalid signature');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Test webhook without signature
 */
async function testMissingSignature() {
  console.log('\n🧪 Test 3: Webhook without signature');
  console.log('='.repeat(50));

  const payload = {
    id: 'test-prediction-789',
    status: 'processing',
    output: null,
    error: null
  };

  try {
    const response = await fetch(`${BASE_URL}/api/seedream/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 401) {
      console.log('✅ Correctly rejected missing signature');
    } else {
      console.log('❌ Should have rejected missing signature');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Test webhook with invalid JSON
 */
async function testInvalidJSON() {
  console.log('\n🧪 Test 4: Invalid JSON payload');
  console.log('='.repeat(50));

  const invalidPayload = 'not valid json {';
  const signature = generateSignature(invalidPayload, WEBHOOK_SECRET);

  try {
    const response = await fetch(`${BASE_URL}/api/seedream/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'replicate-signature': signature
      },
      body: invalidPayload
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 400) {
      console.log('✅ Correctly rejected invalid JSON');
    } else {
      console.log('❌ Should have rejected invalid JSON');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Test webhook with missing required fields
 */
async function testMissingFields() {
  console.log('\n🧪 Test 5: Missing required fields');
  console.log('='.repeat(50));

  const payload = {
    // Missing 'id' and 'status'
    output: null,
    error: null
  };

  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, WEBHOOK_SECRET);

  try {
    const response = await fetch(`${BASE_URL}/api/seedream/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'replicate-signature': signature
      },
      body: payloadString
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 400) {
      console.log('✅ Correctly rejected missing fields');
    } else {
      console.log('❌ Should have rejected missing fields');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Test idempotency - duplicate webhook
 */
async function testIdempotency() {
  console.log('\n🧪 Test 6: Idempotency (duplicate webhook)');
  console.log('='.repeat(50));

  const payload = {
    id: 'test-prediction-idempotent',
    status: 'processing',
    output: null,
    error: null
  };

  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, WEBHOOK_SECRET);

  try {
    // Send first webhook
    console.log('Sending first webhook...');
    const response1 = await fetch(`${BASE_URL}/api/seedream/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'replicate-signature': signature
      },
      body: payloadString
    });

    const data1 = await response1.json();
    console.log('First response:', response1.status, data1.message || data1.error);

    // Send duplicate webhook immediately
    console.log('Sending duplicate webhook...');
    const response2 = await fetch(`${BASE_URL}/api/seedream/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'replicate-signature': signature
      },
      body: payloadString
    });

    const data2 = await response2.json();
    console.log('Second response:', response2.status, data2.message || data2.error);

    if (data2.duplicate === true) {
      console.log('✅ Correctly detected duplicate webhook');
    } else {
      console.log('⚠️  Duplicate detection may not be working (or job not found)');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Test successful completion webhook
 */
async function testSuccessfulCompletion() {
  console.log('\n🧪 Test 7: Successful completion webhook');
  console.log('='.repeat(50));

  const payload = {
    id: 'test-prediction-success',
    status: 'succeeded',
    output: [
      'https://replicate.delivery/pbxt/example1.jpg',
      'https://replicate.delivery/pbxt/example2.jpg'
    ],
    error: null,
    metrics: {
      predict_time: 65.5
    }
  };

  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, WEBHOOK_SECRET);

  try {
    const response = await fetch(`${BASE_URL}/api/seedream/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'replicate-signature': signature
      },
      body: payloadString
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 404) {
      console.log('✅ Expected: Job not found (test prediction ID)');
    } else if (response.ok) {
      console.log('✅ Webhook processed successfully');
    } else {
      console.log('❌ Unexpected response');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Test failed generation webhook
 */
async function testFailedGeneration() {
  console.log('\n🧪 Test 8: Failed generation webhook');
  console.log('='.repeat(50));

  const payload = {
    id: 'test-prediction-failed',
    status: 'failed',
    output: null,
    error: 'Out of memory during generation'
  };

  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, WEBHOOK_SECRET);

  try {
    const response = await fetch(`${BASE_URL}/api/seedream/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'replicate-signature': signature
      },
      body: payloadString
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 404) {
      console.log('✅ Expected: Job not found (test prediction ID)');
    } else if (response.ok) {
      console.log('✅ Webhook processed successfully');
    } else {
      console.log('❌ Unexpected response');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Seedream Webhook Tests');
  console.log('Base URL:', BASE_URL);
  console.log('Webhook Secret:', WEBHOOK_SECRET ? '✓ Configured' : '✗ Missing');

  await testValidWebhook();
  await testInvalidSignature();
  await testMissingSignature();
  await testInvalidJSON();
  await testMissingFields();
  await testIdempotency();
  await testSuccessfulCompletion();
  await testFailedGeneration();

  console.log('\n' + '='.repeat(50));
  console.log('✅ All tests completed');
  console.log('='.repeat(50));
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
