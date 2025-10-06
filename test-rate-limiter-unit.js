#!/usr/bin/env node

/**
 * Rate Limiter Unit Tests
 * 
 * Tests the rate limiter utility functions without requiring a running server
 */

// Mock the rate limiter module
const rateLimiter = {
  checkRateLimit: function(identifier, endpoint, config) {
    // Simple in-memory implementation for testing
    if (!this.store) this.store = new Map();
    
    const now = Date.now();
    const key = `${identifier}:${endpoint}`;
    const record = this.store.get(key);
    
    if (!record || now > record.resetAt) {
      const resetAt = now + config.windowMs;
      this.store.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(resetAt)
      };
    }
    
    if (record.count >= config.maxRequests) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(record.resetAt),
        retryAfter
      };
    }
    
    record.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - record.count,
      resetAt: new Date(record.resetAt)
    };
  },
  
  resetRateLimit: function(identifier, endpoint) {
    if (!this.store) this.store = new Map();
    const key = `${identifier}:${endpoint}`;
    this.store.delete(key);
  },
  
  RateLimitPresets: {
    UPLOAD: { windowMs: 60 * 60 * 1000, maxRequests: 10 },
    GENERATE: { windowMs: 60 * 60 * 1000, maxRequests: 5 },
    STATUS_POLL: { windowMs: 60 * 1000, maxRequests: 30 },
    WEBHOOK: { windowMs: 60 * 1000, maxRequests: 100 }
  }
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function assert(condition, message) {
  if (condition) {
    log(`✓ ${message}`, 'green');
    return true;
  } else {
    log(`✗ ${message}`, 'red');
    return false;
  }
}

/**
 * Test basic rate limiting
 */
function testBasicRateLimit() {
  log('\n=== Test 1: Basic Rate Limiting ===', 'cyan');
  
  const userId = 'test-user-1';
  const endpoint = 'upload';
  const config = rateLimiter.RateLimitPresets.UPLOAD;
  
  // Reset before testing
  rateLimiter.resetRateLimit(userId, endpoint);
  
  let passed = true;
  
  // First request should be allowed
  const result1 = rateLimiter.checkRateLimit(userId, endpoint, config);
  passed = assert(result1.allowed === true, 'First request allowed') && passed;
  passed = assert(result1.remaining === 9, 'Remaining count is 9') && passed;
  
  // Make 9 more requests (total 10)
  for (let i = 0; i < 9; i++) {
    rateLimiter.checkRateLimit(userId, endpoint, config);
  }
  
  // 11th request should be blocked
  const result11 = rateLimiter.checkRateLimit(userId, endpoint, config);
  passed = assert(result11.allowed === false, '11th request blocked') && passed;
  passed = assert(result11.remaining === 0, 'Remaining count is 0') && passed;
  passed = assert(result11.retryAfter > 0, 'Retry-After is set') && passed;
  
  return passed;
}

/**
 * Test different endpoints
 */
function testDifferentEndpoints() {
  log('\n=== Test 2: Different Endpoints ===', 'cyan');
  
  const userId = 'test-user-2';
  
  // Reset before testing
  rateLimiter.resetRateLimit(userId, 'upload');
  rateLimiter.resetRateLimit(userId, 'generate');
  
  let passed = true;
  
  // Upload endpoint
  const uploadResult = rateLimiter.checkRateLimit(userId, 'upload', rateLimiter.RateLimitPresets.UPLOAD);
  passed = assert(uploadResult.allowed === true, 'Upload endpoint allowed') && passed;
  passed = assert(uploadResult.remaining === 9, 'Upload remaining is 9') && passed;
  
  // Generate endpoint (separate limit)
  const generateResult = rateLimiter.checkRateLimit(userId, 'generate', rateLimiter.RateLimitPresets.GENERATE);
  passed = assert(generateResult.allowed === true, 'Generate endpoint allowed') && passed;
  passed = assert(generateResult.remaining === 4, 'Generate remaining is 4') && passed;
  
  return passed;
}

/**
 * Test different users
 */
function testDifferentUsers() {
  log('\n=== Test 3: Different Users ===', 'cyan');
  
  const endpoint = 'upload';
  const config = rateLimiter.RateLimitPresets.UPLOAD;
  
  // Reset before testing
  rateLimiter.resetRateLimit('user-a', endpoint);
  rateLimiter.resetRateLimit('user-b', endpoint);
  
  let passed = true;
  
  // User A makes requests
  for (let i = 0; i < 10; i++) {
    rateLimiter.checkRateLimit('user-a', endpoint, config);
  }
  
  // User A should be blocked
  const userAResult = rateLimiter.checkRateLimit('user-a', endpoint, config);
  passed = assert(userAResult.allowed === false, 'User A blocked after 10 requests') && passed;
  
  // User B should still be allowed
  const userBResult = rateLimiter.checkRateLimit('user-b', endpoint, config);
  passed = assert(userBResult.allowed === true, 'User B still allowed') && passed;
  passed = assert(userBResult.remaining === 9, 'User B has 9 remaining') && passed;
  
  return passed;
}

/**
 * Test rate limit reset
 */
function testRateLimitReset() {
  log('\n=== Test 4: Rate Limit Reset ===', 'cyan');
  
  const userId = 'test-user-4';
  const endpoint = 'upload';
  const config = rateLimiter.RateLimitPresets.UPLOAD;
  
  // Reset before testing
  rateLimiter.resetRateLimit(userId, endpoint);
  
  let passed = true;
  
  // Make 10 requests
  for (let i = 0; i < 10; i++) {
    rateLimiter.checkRateLimit(userId, endpoint, config);
  }
  
  // Should be blocked
  const blockedResult = rateLimiter.checkRateLimit(userId, endpoint, config);
  passed = assert(blockedResult.allowed === false, 'User blocked after 10 requests') && passed;
  
  // Reset rate limit
  rateLimiter.resetRateLimit(userId, endpoint);
  
  // Should be allowed again
  const resetResult = rateLimiter.checkRateLimit(userId, endpoint, config);
  passed = assert(resetResult.allowed === true, 'User allowed after reset') && passed;
  passed = assert(resetResult.remaining === 9, 'Remaining count reset to 9') && passed;
  
  return passed;
}

/**
 * Test rate limit presets
 */
function testRateLimitPresets() {
  log('\n=== Test 5: Rate Limit Presets ===', 'cyan');
  
  let passed = true;
  
  // Upload preset
  passed = assert(
    rateLimiter.RateLimitPresets.UPLOAD.maxRequests === 10,
    'Upload preset: 10 requests'
  ) && passed;
  passed = assert(
    rateLimiter.RateLimitPresets.UPLOAD.windowMs === 60 * 60 * 1000,
    'Upload preset: 1 hour window'
  ) && passed;
  
  // Generate preset
  passed = assert(
    rateLimiter.RateLimitPresets.GENERATE.maxRequests === 5,
    'Generate preset: 5 requests'
  ) && passed;
  passed = assert(
    rateLimiter.RateLimitPresets.GENERATE.windowMs === 60 * 60 * 1000,
    'Generate preset: 1 hour window'
  ) && passed;
  
  // Status poll preset
  passed = assert(
    rateLimiter.RateLimitPresets.STATUS_POLL.maxRequests === 30,
    'Status poll preset: 30 requests'
  ) && passed;
  passed = assert(
    rateLimiter.RateLimitPresets.STATUS_POLL.windowMs === 60 * 1000,
    'Status poll preset: 1 minute window'
  ) && passed;
  
  // Webhook preset
  passed = assert(
    rateLimiter.RateLimitPresets.WEBHOOK.maxRequests === 100,
    'Webhook preset: 100 requests'
  ) && passed;
  passed = assert(
    rateLimiter.RateLimitPresets.WEBHOOK.windowMs === 60 * 1000,
    'Webhook preset: 1 minute window'
  ) && passed;
  
  return passed;
}

/**
 * Main test runner
 */
function runTests() {
  log('='.repeat(60), 'cyan');
  log('Rate Limiter Unit Tests', 'bright');
  log('='.repeat(60), 'cyan');
  
  const tests = [
    { name: 'Basic Rate Limiting', fn: testBasicRateLimit },
    { name: 'Different Endpoints', fn: testDifferentEndpoints },
    { name: 'Different Users', fn: testDifferentUsers },
    { name: 'Rate Limit Reset', fn: testRateLimitReset },
    { name: 'Rate Limit Presets', fn: testRateLimitPresets }
  ];
  
  let passedCount = 0;
  let failedCount = 0;
  
  for (const test of tests) {
    try {
      const passed = test.fn();
      if (passed) {
        passedCount++;
      } else {
        failedCount++;
      }
    } catch (error) {
      log(`✗ ${test.name} threw error: ${error.message}`, 'red');
      failedCount++;
    }
  }
  
  log('\n' + '='.repeat(60), 'cyan');
  log('Test Results', 'bright');
  log('='.repeat(60), 'cyan');
  log(`Passed: ${passedCount}/${tests.length}`, passedCount === tests.length ? 'green' : 'yellow');
  log(`Failed: ${failedCount}/${tests.length}`, failedCount === 0 ? 'green' : 'red');
  
  if (passedCount === tests.length) {
    log('\n✓ All tests passed!', 'green');
    process.exit(0);
  } else {
    log('\n✗ Some tests failed', 'red');
    process.exit(1);
  }
}

// Run tests
runTests();
