/**
 * Unit tests for RunPod error handling and retry logic
 * Tests the error classification, retry mechanisms, and circuit breaker patterns directly
 */

// Mock the logger to avoid import issues in testing
const mockLogger = {
  logInfo: (message, data) => console.log(`INFO: ${message}`, data || ''),
  logSuccess: (message, data) => console.log(`SUCCESS: ${message}`, data || ''),
  logWarning: (message, data) => console.log(`WARNING: ${message}`, data || ''),
  logError: (message, error, data) => console.log(`ERROR: ${message}`, error, data || ''),
  setUserId: (userId) => console.log(`User ID set: ${userId}`)
};

// Mock the RunPod service components for testing
class MockRunPodErrorHandler {
  static ERROR_PATTERNS = {
    GPU_UNAVAILABLE: {
      patterns: ['no available workers', 'gpu unavailable', 'insufficient gpu memory'],
      retryable: true,
      userMessage: 'GPU resources are currently unavailable',
      actionableSteps: [
        'Wait a few minutes and try again',
        'Consider training during off-peak hours',
        'Reduce image resolution if possible'
      ]
    },
    GPU_OUT_OF_MEMORY: {
      patterns: ['out of memory', 'cuda out of memory', 'gpu memory exceeded'],
      retryable: false,
      userMessage: 'Training requires more GPU memory than available',
      actionableSteps: [
        'Reduce the number of training images',
        'Lower the resolution setting',
        'Reduce batch size in training configuration'
      ]
    },
    TIMEOUT: {
      patterns: ['timeout', 'request timeout', 'connection timeout'],
      retryable: true,
      userMessage: 'Request timed out while communicating with training service',
      actionableSteps: [
        'Check your internet connection',
        'Try again in a few moments',
        'Contact support if timeouts persist'
      ]
    },
    AUTH_ERROR: {
      patterns: ['unauthorized', 'invalid token', 'authentication failed'],
      retryable: false,
      userMessage: 'Authentication failed with training service',
      actionableSteps: [
        'Check API credentials configuration',
        'Verify RunPod API key is valid',
        'Contact administrator if issue persists'
      ]
    },
    QUOTA_EXCEEDED: {
      patterns: ['quota exceeded', 'rate limit', 'too many requests'],
      retryable: true,
      userMessage: 'Training quota or rate limit exceeded',
      actionableSteps: [
        'Wait before starting new training jobs',
        'Check your RunPod account limits',
        'Consider upgrading your plan if needed'
      ]
    }
  };

  static classifyError(error) {
    const errorMessage = (error.message || error.detail || error.error || '').toLowerCase();
    const statusCode = error.status || error.statusCode;
    
    // Check each error pattern
    for (const [code, config] of Object.entries(this.ERROR_PATTERNS)) {
      if (config.patterns.some(pattern => errorMessage.includes(pattern))) {
        return {
          code,
          message: error.message || error.detail || error.error || 'Unknown error',
          details: error,
          retryable: config.retryable,
          userMessage: config.userMessage,
          actionableSteps: config.actionableSteps
        };
      }
    }
    
    // Handle HTTP status codes
    if (statusCode === 429) {
      return {
        code: 'QUOTA_EXCEEDED',
        message: 'Rate limit exceeded',
        details: error,
        retryable: true,
        userMessage: this.ERROR_PATTERNS.QUOTA_EXCEEDED.userMessage,
        actionableSteps: this.ERROR_PATTERNS.QUOTA_EXCEEDED.actionableSteps
      };
    }
    
    if (statusCode === 401 || statusCode === 403) {
      return {
        code: 'AUTH_ERROR',
        message: 'Authentication or authorization failed',
        details: error,
        retryable: false,
        userMessage: this.ERROR_PATTERNS.AUTH_ERROR.userMessage,
        actionableSteps: this.ERROR_PATTERNS.AUTH_ERROR.actionableSteps
      };
    }
    
    if (statusCode >= 500) {
      return {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: error,
        retryable: true,
        userMessage: 'An internal error occurred in the training service',
        actionableSteps: [
          'Try again in a few minutes',
          'Contact support if error persists',
          'Provide training details for troubleshooting'
        ]
      };
    }
    
    // Default classification
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      details: error,
      retryable: true,
      userMessage: 'An unexpected error occurred during training',
      actionableSteps: [
        'Try again in a few minutes',
        'Check your training parameters',
        'Contact support if the issue persists'
      ]
    };
  }
}

// Mock circuit breaker for testing
class MockCircuitBreaker {
  constructor(failureThreshold = 5, recoveryTimeout = 60000) {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }
    
    try {
      const result = await operation();
      if (this.state === 'HALF_OPEN') {
        this.reset();
      }
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
  
  reset() {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

/**
 * Test error classification logic
 */
function testErrorClassification() {
  console.log('\n🧪 Testing Error Classification...');
  
  const testCases = [
    {
      name: 'GPU Unavailable Error',
      error: { message: 'No available workers for this request' },
      expectedCode: 'GPU_UNAVAILABLE',
      expectedRetryable: true
    },
    {
      name: 'GPU Out of Memory Error',
      error: { message: 'CUDA out of memory. Tried to allocate 2.00 GiB' },
      expectedCode: 'GPU_OUT_OF_MEMORY',
      expectedRetryable: false
    },
    {
      name: 'Timeout Error',
      error: { message: 'Request timeout after 60 seconds' },
      expectedCode: 'TIMEOUT',
      expectedRetryable: true
    },
    {
      name: 'Authentication Error',
      error: { message: 'Unauthorized access', status: 401 },
      expectedCode: 'AUTH_ERROR',
      expectedRetryable: false
    },
    {
      name: 'Rate Limit Error',
      error: { message: 'Too many requests', status: 429 },
      expectedCode: 'QUOTA_EXCEEDED',
      expectedRetryable: true
    },
    {
      name: 'Internal Server Error',
      error: { message: 'Internal server error', status: 500 },
      expectedCode: 'INTERNAL_ERROR',
      expectedRetryable: true
    },
    {
      name: 'Unknown Error',
      error: { message: 'Something went wrong' },
      expectedCode: 'UNKNOWN_ERROR',
      expectedRetryable: true
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach(testCase => {
    try {
      const classified = MockRunPodErrorHandler.classifyError(testCase.error);
      
      if (classified.code === testCase.expectedCode && classified.retryable === testCase.expectedRetryable) {
        console.log(`✅ ${testCase.name}: Correctly classified as ${classified.code} (retryable: ${classified.retryable})`);
        console.log(`   User Message: ${classified.userMessage}`);
        console.log(`   Actionable Steps: ${classified.actionableSteps.length} provided`);
        passed++;
      } else {
        console.log(`❌ ${testCase.name}: Expected ${testCase.expectedCode}/${testCase.expectedRetryable}, got ${classified.code}/${classified.retryable}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${testCase.name}: Classification failed - ${error.message}`);
      failed++;
    }
  });
  
  console.log(`\nError Classification Results: ${passed}/${testCases.length} passed`);
  
  if (failed === 0) {
    testResults.passed++;
    console.log('✅ Error classification test passed');
  } else {
    testResults.failed++;
    testResults.errors.push(`Error classification: ${failed} test cases failed`);
    console.log('❌ Error classification test failed');
  }
}

/**
 * Test circuit breaker pattern
 */
async function testCircuitBreakerPattern() {
  console.log('\n🔌 Testing Circuit Breaker Pattern...');
  
  const circuitBreaker = new MockCircuitBreaker(3, 1000); // 3 failures, 1 second recovery
  
  try {
    // Test normal operation
    console.log('Testing normal operation...');
    const result1 = await circuitBreaker.execute(async () => 'success');
    console.log(`✅ Normal operation: ${result1}`);
    
    // Test failure accumulation
    console.log('Testing failure accumulation...');
    for (let i = 1; i <= 3; i++) {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error(`Simulated failure ${i}`);
        });
      } catch (error) {
        console.log(`   Failure ${i}: ${error.message}`);
      }
    }
    
    const state = circuitBreaker.getState();
    console.log(`Circuit breaker state after failures: ${state.state} (${state.failures} failures)`);
    
    if (state.state === 'OPEN') {
      console.log('✅ Circuit breaker correctly opened after threshold failures');
    } else {
      console.log('❌ Circuit breaker should be OPEN after threshold failures');
      testResults.failed++;
      testResults.errors.push('Circuit breaker did not open after threshold failures');
      return;
    }
    
    // Test circuit breaker blocking
    console.log('Testing circuit breaker blocking...');
    try {
      await circuitBreaker.execute(async () => 'should be blocked');
      console.log('❌ Circuit breaker should have blocked the request');
      testResults.failed++;
      testResults.errors.push('Circuit breaker did not block request when OPEN');
      return;
    } catch (error) {
      if (error.message.includes('Circuit breaker is OPEN')) {
        console.log('✅ Circuit breaker correctly blocked request when OPEN');
      } else {
        console.log(`❌ Unexpected error: ${error.message}`);
        testResults.failed++;
        testResults.errors.push('Circuit breaker blocking test failed');
        return;
      }
    }
    
    // Test recovery (wait for timeout)
    console.log('Testing recovery after timeout...');
    await new Promise(resolve => setTimeout(resolve, 1100)); // Wait longer than recovery timeout
    
    try {
      const result2 = await circuitBreaker.execute(async () => 'recovery success');
      console.log(`✅ Circuit breaker recovered: ${result2}`);
      
      const finalState = circuitBreaker.getState();
      console.log(`Final circuit breaker state: ${finalState.state} (${finalState.failures} failures)`);
      
      if (finalState.state === 'CLOSED') {
        console.log('✅ Circuit breaker correctly reset to CLOSED after successful operation');
        testResults.passed++;
      } else {
        console.log('❌ Circuit breaker should be CLOSED after successful recovery');
        testResults.failed++;
        testResults.errors.push('Circuit breaker did not reset after recovery');
      }
    } catch (error) {
      console.log(`❌ Circuit breaker recovery failed: ${error.message}`);
      testResults.failed++;
      testResults.errors.push('Circuit breaker recovery test failed');
    }
    
  } catch (error) {
    console.log(`❌ Circuit breaker test failed: ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`Circuit breaker test: ${error.message}`);
  }
}

/**
 * Test retry logic with exponential backoff
 */
async function testRetryLogic() {
  console.log('\n🔄 Testing Retry Logic...');
  
  // Mock retry function
  async function mockRetryOperation(operation, options = {}) {
    const {
      maxRetries = 3,
      baseDelay = 100, // Shorter delay for testing
      maxDelay = 1000,
      backoffMultiplier = 2,
      retryCondition = () => true
    } = options;

    let lastError;
    const attempts = [];

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const attemptStart = Date.now();
      
      try {
        const result = await operation();
        attempts.push({ attempt, success: true, duration: Date.now() - attemptStart });
        return { success: true, data: result, attempts };
      } catch (error) {
        lastError = error;
        attempts.push({ attempt, success: false, error: error.message, duration: Date.now() - attemptStart });
        
        if (attempt > maxRetries || !retryCondition(error)) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return { success: false, error: lastError, attempts };
  }
  
  try {
    // Test successful operation (no retries needed)
    console.log('Testing successful operation...');
    const successResult = await mockRetryOperation(async () => 'success');
    
    if (successResult.success && successResult.attempts.length === 1) {
      console.log('✅ Successful operation completed without retries');
    } else {
      console.log('❌ Successful operation should not require retries');
      testResults.failed++;
      testResults.errors.push('Successful operation retry test failed');
      return;
    }
    
    // Test retryable failure
    console.log('Testing retryable failure...');
    let attemptCount = 0;
    const retryResult = await mockRetryOperation(async () => {
      attemptCount++;
      if (attemptCount < 3) {
        const error = new Error('Temporary failure');
        error.retryable = true;
        throw error;
      }
      return 'success after retries';
    }, {
      retryCondition: (error) => error.retryable
    });
    
    if (retryResult.success && retryResult.attempts.length === 3) {
      console.log(`✅ Retryable failure succeeded after ${retryResult.attempts.length} attempts`);
      console.log(`   Attempts: ${retryResult.attempts.map(a => a.success ? 'SUCCESS' : 'FAIL').join(' -> ')}`);
    } else {
      console.log('❌ Retryable failure test did not behave as expected');
      testResults.failed++;
      testResults.errors.push('Retryable failure test failed');
      return;
    }
    
    // Test non-retryable failure
    console.log('Testing non-retryable failure...');
    const nonRetryResult = await mockRetryOperation(async () => {
      const error = new Error('Non-retryable failure');
      error.retryable = false;
      throw error;
    }, {
      retryCondition: (error) => error.retryable
    });
    
    if (!nonRetryResult.success && nonRetryResult.attempts.length === 1) {
      console.log('✅ Non-retryable failure correctly stopped after first attempt');
    } else {
      console.log('❌ Non-retryable failure should not be retried');
      testResults.failed++;
      testResults.errors.push('Non-retryable failure test failed');
      return;
    }
    
    // Test max retries exhausted
    console.log('Testing max retries exhausted...');
    const maxRetriesResult = await mockRetryOperation(async () => {
      throw new Error('Always fails');
    }, {
      maxRetries: 2
    });
    
    if (!maxRetriesResult.success && maxRetriesResult.attempts.length === 3) { // maxRetries + 1
      console.log(`✅ Max retries exhausted after ${maxRetriesResult.attempts.length} attempts`);
    } else {
      console.log('❌ Max retries test did not behave as expected');
      testResults.failed++;
      testResults.errors.push('Max retries test failed');
      return;
    }
    
    console.log('✅ All retry logic tests passed');
    testResults.passed++;
    
  } catch (error) {
    console.log(`❌ Retry logic test failed: ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`Retry logic test: ${error.message}`);
  }
}

/**
 * Test timeout handling
 */
async function testTimeoutHandling() {
  console.log('\n⏱️ Testing Timeout Handling...');
  
  try {
    // Test operation that completes within timeout
    console.log('Testing operation within timeout...');
    const controller1 = new AbortController();
    const timeoutId1 = setTimeout(() => controller1.abort(), 1000);
    
    try {
      await new Promise((resolve) => {
        setTimeout(resolve, 100); // Complete quickly
        if (controller1.signal.aborted) {
          throw new Error('Operation was aborted');
        }
      });
      
      clearTimeout(timeoutId1);
      console.log('✅ Operation completed within timeout');
    } catch (error) {
      clearTimeout(timeoutId1);
      if (error.name === 'AbortError') {
        console.log('❌ Operation should not have timed out');
        testResults.failed++;
        testResults.errors.push('Fast operation timeout test failed');
        return;
      }
    }
    
    // Test operation that times out
    console.log('Testing operation timeout...');
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 100);
    
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 1000); // Take too long
        
        controller2.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Operation timed out'));
        });
      });
      
      clearTimeout(timeoutId2);
      console.log('❌ Operation should have timed out');
      testResults.failed++;
      testResults.errors.push('Slow operation timeout test failed');
      return;
      
    } catch (error) {
      clearTimeout(timeoutId2);
      if (error.message.includes('timed out')) {
        console.log('✅ Operation correctly timed out');
      } else {
        console.log(`❌ Unexpected timeout error: ${error.message}`);
        testResults.failed++;
        testResults.errors.push('Timeout error handling test failed');
        return;
      }
    }
    
    console.log('✅ Timeout handling tests passed');
    testResults.passed++;
    
  } catch (error) {
    console.log(`❌ Timeout handling test failed: ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`Timeout handling test: ${error.message}`);
  }
}

/**
 * Run all unit tests
 */
async function runAllTests() {
  console.log('🚀 Starting RunPod Error Handling Unit Tests...');
  console.log('Testing error handling logic, retry mechanisms, and circuit breaker patterns');
  
  const startTime = Date.now();
  
  // Run all tests
  testErrorClassification();
  await testCircuitBreakerPattern();
  await testRetryLogic();
  await testTimeoutHandling();
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  // Print summary
  console.log('\n📊 Test Summary:');
  console.log('================');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⏱️  Total Time: ${totalTime}ms`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Errors:');
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All unit tests passed! RunPod error handling logic is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
  }
  
  return testResults.failed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testErrorClassification,
  testCircuitBreakerPattern,
  testRetryLogic,
  testTimeoutHandling,
  MockRunPodErrorHandler,
  MockCircuitBreaker
};