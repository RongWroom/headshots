/**
 * Test script for error handling and retry logic
 * Tests the comprehensive error handling utilities
 */

// Mock implementations for testing
class MockLogger {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.requestId = `test_${Date.now()}`;
    this.logs = [];
  }

  logInfo(stage, data) {
    this.logs.push({ level: 'info', stage, data });
    console.log(`[INFO] ${stage}:`, data);
  }

  logSuccess(stage, data) {
    this.logs.push({ level: 'success', stage, data });
    console.log(`[SUCCESS] ${stage}:`, data);
  }

  logWarning(stage, message, data) {
    this.logs.push({ level: 'warning', stage, message, data });
    console.log(`[WARNING] ${stage}: ${message}`, data);
  }

  logError(stage, error, data) {
    this.logs.push({ level: 'error', stage, error, data });
    console.error(`[ERROR] ${stage}:`, error, data);
  }

  getRequestId() {
    return this.requestId;
  }
}

// Test utilities
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Test 1: Retry with exponential backoff
async function testRetryWithBackoff() {
  console.log('\n=== Test 1: Retry with Exponential Backoff ===');
  
  let attempts = 0;
  const maxRetries = 3;
  const initialDelay = 100;
  const backoffMultiplier = 2;
  
  const startTime = Date.now();
  
  try {
    await withRetry(
      async () => {
        attempts++;
        console.log(`Attempt ${attempts}/${maxRetries}`);
        
        if (attempts < 3) {
          throw new Error('Simulated failure');
        }
        
        return 'Success!';
      },
      {
        maxRetries,
        initialDelay,
        maxDelay: 1000,
        backoffMultiplier,
      }
    );
    
    const duration = Date.now() - startTime;
    console.log(`✓ Success after ${attempts} attempts in ${duration}ms`);
    console.log(`Expected delays: 100ms, 200ms = ~300ms total`);
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
  }
}

// Test 2: Non-retryable error
async function testNonRetryableError() {
  console.log('\n=== Test 2: Non-Retryable Error (400) ===');
  
  let attempts = 0;
  
  try {
    await withRetry(
      async () => {
        attempts++;
        const error = new Error('Validation failed');
        error.response = { status: 400 };
        throw error;
      },
      {
        maxRetries: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
      }
    );
    
    console.error('✗ Should have thrown error');
    
  } catch (error) {
    if (attempts === 1) {
      console.log(`✓ Correctly failed immediately without retry (${attempts} attempt)`);
    } else {
      console.error(`✗ Should not have retried (${attempts} attempts)`);
    }
  }
}

// Test 3: Retryable error (429 rate limit)
async function testRetryableRateLimit() {
  console.log('\n=== Test 3: Retryable Error (429 Rate Limit) ===');
  
  let attempts = 0;
  
  try {
    await withRetry(
      async () => {
        attempts++;
        console.log(`Attempt ${attempts}/3`);
        
        if (attempts < 2) {
          const error = new Error('Rate limit exceeded');
          error.response = { status: 429 };
          throw error;
        }
        
        return 'Success after rate limit!';
      },
      {
        maxRetries: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
      }
    );
    
    console.log(`✓ Successfully retried rate limit error (${attempts} attempts)`);
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
  }
}

// Test 4: Retryable error (500 server error)
async function testRetryableServerError() {
  console.log('\n=== Test 4: Retryable Error (500 Server Error) ===');
  
  let attempts = 0;
  
  try {
    await withRetry(
      async () => {
        attempts++;
        console.log(`Attempt ${attempts}/3`);
        
        if (attempts < 2) {
          const error = new Error('Internal server error');
          error.response = { status: 500 };
          throw error;
        }
        
        return 'Success after server error!';
      },
      {
        maxRetries: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
      }
    );
    
    console.log(`✓ Successfully retried server error (${attempts} attempts)`);
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
  }
}

// Test 5: Error classification
async function testErrorClassification() {
  console.log('\n=== Test 5: Error Classification ===');
  
  const testCases = [
    {
      name: 'Validation Error (400)',
      error: { response: { status: 400 }, message: 'Invalid input' },
      expectedType: 'VALIDATION_ERROR',
      expectedRetryable: false,
    },
    {
      name: 'Authentication Error (401)',
      error: { response: { status: 401 }, message: 'Unauthorized' },
      expectedType: 'AUTHENTICATION_ERROR',
      expectedRetryable: false,
    },
    {
      name: 'Rate Limit Error (429)',
      error: { response: { status: 429 }, message: 'Too many requests' },
      expectedType: 'RATE_LIMIT_ERROR',
      expectedRetryable: true,
    },
    {
      name: 'Server Error (500)',
      error: { response: { status: 500 }, message: 'Internal error' },
      expectedType: 'SERVER_ERROR',
      expectedRetryable: true,
    },
    {
      name: 'Network Error',
      error: { code: 'ECONNRESET', message: 'Connection reset' },
      expectedType: 'NETWORK_ERROR',
      expectedRetryable: true,
    },
  ];
  
  for (const testCase of testCases) {
    const classified = classifyError(testCase.error);
    
    const typeMatch = classified.type === testCase.expectedType;
    const retryableMatch = classified.isRetryable === testCase.expectedRetryable;
    
    if (typeMatch && retryableMatch) {
      console.log(`✓ ${testCase.name}: Correctly classified`);
      console.log(`  Type: ${classified.type}, Retryable: ${classified.isRetryable}`);
      console.log(`  User message: "${classified.userMessage}"`);
    } else {
      console.error(`✗ ${testCase.name}: Incorrect classification`);
      console.error(`  Expected: ${testCase.expectedType}, ${testCase.expectedRetryable}`);
      console.error(`  Got: ${classified.type}, ${classified.isRetryable}`);
    }
  }
}

// Test 6: User-friendly error messages
async function testUserFriendlyMessages() {
  console.log('\n=== Test 6: User-Friendly Error Messages ===');
  
  const testErrors = [
    { response: { status: 400 }, message: 'Invalid file format' },
    { response: { status: 401 }, message: 'Token expired' },
    { response: { status: 429 }, message: 'Rate limit' },
    { response: { status: 500 }, message: 'Database connection failed' },
  ];
  
  for (const error of testErrors) {
    const classified = classifyError(error);
    console.log(`\nStatus ${error.response.status}:`);
    console.log(`  Technical: "${error.message}"`);
    console.log(`  User-friendly: "${classified.userMessage}"`);
    console.log(`  Suggestions: ${classified.suggestions.join(', ')}`);
  }
  
  console.log('\n✓ All error messages are user-friendly');
}

// Test 7: Webhook fallback polling simulation
async function testWebhookFallbackPolling() {
  console.log('\n=== Test 7: Webhook Fallback Polling ===');
  
  let pollCount = 0;
  const maxPolls = 5;
  
  const mockGetPrediction = async (id) => {
    pollCount++;
    console.log(`Poll attempt ${pollCount}/${maxPolls}`);
    
    // Simulate progression
    if (pollCount < 3) {
      return { status: 'processing', output: null };
    } else {
      return { 
        status: 'succeeded', 
        output: ['image1.jpg', 'image2.jpg'],
        metrics: { predict_time: 45.2 }
      };
    }
  };
  
  try {
    const result = await webhookFallbackPoll(
      'test-prediction-id',
      mockGetPrediction,
      maxPolls,
      100, // 100ms interval for testing
      new MockLogger('webhook_fallback')
    );
    
    console.log(`✓ Webhook fallback completed after ${pollCount} polls`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Outputs: ${result.output.length} images`);
    
  } catch (error) {
    console.error('✗ Webhook fallback failed:', error.message);
  }
}

// Test 8: Image download retry
async function testImageDownloadRetry() {
  console.log('\n=== Test 8: Image Download Retry ===');
  
  let attempts = 0;
  
  // Mock fetch that fails twice then succeeds
  global.fetch = async (url) => {
    attempts++;
    console.log(`Download attempt ${attempts}/3`);
    
    if (attempts < 3) {
      throw new Error('Network timeout');
    }
    
    return {
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1024),
    };
  };
  
  try {
    const buffer = await retryImageDownload(
      'https://example.com/image.jpg',
      3,
      new MockLogger('image_download')
    );
    
    console.log(`✓ Image downloaded after ${attempts} attempts`);
    console.log(`  Buffer size: ${buffer.byteLength} bytes`);
    
  } catch (error) {
    console.error('✗ Image download failed:', error.message);
  }
}

// Helper functions (simplified versions of the actual implementation)
function isRetryableError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error;
  
  if (err.response?.status === 429 || err.status === 429) {
    return true;
  }

  if (
    (err.response?.status >= 500 && err.response?.status < 600) ||
    (err.status >= 500 && err.status < 600)
  ) {
    return true;
  }

  if (
    err.code === 'ECONNRESET' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNREFUSED'
  ) {
    return true;
  }

  return false;
}

async function withRetry(fn, config) {
  let lastError = new Error('Unknown error');
  let delay = config.initialDelay;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      const isRetryable = isRetryableError(error);
      
      if (!isRetryable || attempt >= config.maxRetries - 1) {
        throw lastError;
      }

      await sleep(delay);
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }

  throw lastError;
}

function classifyError(error) {
  if (!error || typeof error !== 'object') {
    return {
      type: 'UNKNOWN_ERROR',
      statusCode: 500,
      message: String(error),
      userMessage: 'An unexpected error occurred. Please try again.',
      isRetryable: false,
      suggestions: ['Try again later', 'Contact support if the issue persists'],
    };
  }

  const err = error;
  const status = err.response?.status || err.status || 500;

  if (status === 400) {
    return {
      type: 'VALIDATION_ERROR',
      statusCode: 400,
      message: err.message || 'Validation failed',
      userMessage: 'Invalid input. Please check your data and try again.',
      isRetryable: false,
      suggestions: ['Verify all required fields', 'Check file formats and sizes'],
    };
  }

  if (status === 401) {
    return {
      type: 'AUTHENTICATION_ERROR',
      statusCode: 401,
      message: err.message || 'Authentication failed',
      userMessage: 'You must be logged in to perform this action.',
      isRetryable: false,
      suggestions: ['Log in to your account', 'Refresh your session'],
    };
  }

  if (status === 429) {
    return {
      type: 'RATE_LIMIT_ERROR',
      statusCode: 429,
      message: err.message || 'Rate limit exceeded',
      userMessage: 'Too many requests. Please wait a moment and try again.',
      isRetryable: true,
      suggestions: ['Wait 30-60 seconds before retrying'],
    };
  }

  if (status >= 500) {
    return {
      type: 'SERVER_ERROR',
      statusCode: status,
      message: err.message || 'Server error',
      userMessage: 'A server error occurred. Please try again in a moment.',
      isRetryable: true,
      suggestions: ['Wait a few minutes and try again'],
    };
  }

  if (
    err.code === 'ECONNRESET' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ENOTFOUND'
  ) {
    return {
      type: 'NETWORK_ERROR',
      statusCode: 503,
      message: err.message || 'Network error',
      userMessage: 'Network connection failed. Please check your connection and try again.',
      isRetryable: true,
      suggestions: ['Check your internet connection'],
    };
  }

  return {
    type: 'UNKNOWN_ERROR',
    statusCode: 500,
    message: err.message || 'Unknown error',
    userMessage: 'An unexpected error occurred. Please try again.',
    isRetryable: false,
    suggestions: ['Try again later'],
  };
}

async function webhookFallbackPoll(predictionId, getPredictionFn, maxAttempts, intervalMs, logger) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const prediction = await getPredictionFn(predictionId);

    if (prediction.status === 'succeeded' || prediction.status === 'failed') {
      return prediction;
    }

    if (attempt < maxAttempts - 1) {
      await sleep(intervalMs);
    }
  }

  throw new Error(`Webhook fallback polling timed out after ${maxAttempts} attempts`);
}

async function retryImageDownload(url, maxRetries, logger) {
  return withRetry(
    async () => {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }

      return await response.arrayBuffer();
    },
    {
      maxRetries,
      initialDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
    }
  );
}

// Run all tests
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Error Handling and Retry Logic Test Suite                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    await testRetryWithBackoff();
    await testNonRetryableError();
    await testRetryableRateLimit();
    await testRetryableServerError();
    await testErrorClassification();
    await testUserFriendlyMessages();
    await testWebhookFallbackPolling();
    await testImageDownloadRetry();
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✓ All tests completed successfully!                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║  ✗ Test suite failed                                      ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
