#!/usr/bin/env node

/**
 * RunPod Stress Testing for Concurrent Job Handling
 * 
 * Specialized stress tests for validating the system's ability to handle
 * multiple concurrent training requests, queue management, and resource allocation
 * 
 * Requirements covered: 1.1, 1.2, 4.3
 */

const fetch = require('node-fetch');
const fs = require('fs').promises;

// Stress test configuration
const STRESS_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  concurrency: {
    maxConcurrentJobs: 10,
    batchSizes: [2, 5, 8, 10],
    testDuration: 60000, // 1 minute stress test
    requestInterval: 1000, // 1 second between batches
  },
  thresholds: {
    maxResponseTime: 15000, // 15 seconds max response time under load
    minSuccessRate: 0.8, // 80% success rate minimum
    maxErrorRate: 0.2, // 20% error rate maximum
    maxQueueWaitTime: 30000, // 30 seconds max queue wait
  },
  loadPatterns: {
    burst: { requests: 10, interval: 100 }, // 10 requests in 1 second
    sustained: { requests: 20, interval: 2000 }, // 20 requests over 40 seconds
    gradual: { requests: 15, interval: 4000 }, // 15 requests over 60 seconds
  }
};

// Test datasets for concurrent testing
const CONCURRENT_TEST_DATASETS = {
  lightweight: {
    imageUrls: Array.from({ length: 8 }, (_, i) => `https://picsum.photos/512/512?random=${i + 500}&face=1`),
    packSlug: 'corporate-headshots',
    trainingConfig: {
      quality_preset: 'balanced',
      user_preference: 'speed'
    }
  },
  standard: {
    imageUrls: Array.from({ length: 12 }, (_, i) => `https://picsum.photos/1024/1024?random=${i + 600}&face=1`),
    packSlug: 'actor-headshots',
    trainingConfig: {
      quality_preset: 'high',
      user_preference: 'balanced'
    }
  },
  heavy: {
    imageUrls: Array.from({ length: 16 }, (_, i) => `https://picsum.photos/1024/1024?random=${i + 700}&face=1`),
    packSlug: 'creative-headshots',
    trainingConfig: {
      quality_preset: 'premium',
      user_preference: 'quality'
    }
  }
};

// Stress test metrics tracking
const stressMetrics = {
  requestsSent: 0,
  requestsSuccessful: 0,
  requestsFailed: 0,
  responseTimes: [],
  errorTypes: {},
  queueWaitTimes: [],
  concurrentJobsActive: 0,
  maxConcurrentJobsReached: 0,
  systemResourceUsage: [],
  errors: []
};

/**
 * Utility function for authenticated requests with timeout
 */
async function makeStressTestRequest(endpoint, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  const url = `${STRESS_CONFIG.baseUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Mode': 'stress-test',
        ...options.headers
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    let data;
    try {
      data = await response.json();
    } catch (error) {
      data = { error: 'Failed to parse JSON response' };
    }
    
    return { response, data, timeout: false };
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      return { response: null, data: { error: 'Request timeout' }, timeout: true };
    }
    
    return { response: null, data: { error: error.message }, timeout: false };
  }
}

/**
 * Stress Test 1: Burst Load Testing
 * Tests system response to sudden high load
 */
async function stressBurstLoad() {
  console.log('\n💥 Stress Testing: Burst Load...');
  
  const { requests: requestCount, interval } = STRESS_CONFIG.loadPatterns.burst;
  console.log(`  Sending ${requestCount} requests with ${interval}ms intervals`);
  
  const startTime = Date.now();
  const promises = [];
  const requestTimes = [];
  
  // Send burst of requests
  for (let i = 0; i < requestCount; i++) {
    const requestStartTime = Date.now();
    
    const dataset = {
      ...CONCURRENT_TEST_DATASETS.lightweight,
      modelName: `burst-test-${i}-${Date.now()}`
    };
    
    const promise = makeStressTestRequest('/api/runpod/train', {
      method: 'POST',
      body: JSON.stringify(dataset)
    }).then(result => {
      const requestTime = Date.now() - requestStartTime;
      requestTimes.push(requestTime);
      
      stressMetrics.requestsSent++;
      
      if (result.timeout) {
        stressMetrics.requestsFailed++;
        stressMetrics.errorTypes['timeout'] = (stressMetrics.errorTypes['timeout'] || 0) + 1;
      } else if (result.response && (result.response.ok || result.response.status === 401)) {
        stressMetrics.requestsSuccessful++;
      } else {
        stressMetrics.requestsFailed++;
        const errorType = result.data.error || 'unknown_error';
        stressMetrics.errorTypes[errorType] = (stressMetrics.errorTypes[errorType] || 0) + 1;
      }
      
      stressMetrics.responseTimes.push(requestTime);
      
      return {
        requestIndex: i,
        requestTime,
        success: result.response && (result.response.ok || result.response.status === 401),
        statusCode: result.response ? result.response.status : null,
        error: result.data.error,
        timeout: result.timeout
      };
    });
    
    promises.push(promise);
    
    // Small interval between requests
    if (i < requestCount - 1) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  console.log('  ⏳ Waiting for all requests to complete...');
  const results = await Promise.all(promises);
  
  const totalTime = Date.now() - startTime;
  const successfulRequests = results.filter(r => r.success).length;
  const timedOutRequests = results.filter(r => r.timeout).length;
  const avgResponseTime = requestTimes.length > 0 ? requestTimes.reduce((a, b) => a + b, 0) / requestTimes.length : 0;
  const maxResponseTime = requestTimes.length > 0 ? Math.max(...requestTimes) : 0;
  
  const successRate = successfulRequests / requestCount;
  const timeoutRate = timedOutRequests / requestCount;
  
  console.log(`\n  📊 Burst Load Results:`);
  console.log(`    Total requests: ${requestCount}`);
  console.log(`    Successful: ${successfulRequests} (${Math.round(successRate * 100)}%)`);
  console.log(`    Timed out: ${timedOutRequests} (${Math.round(timeoutRate * 100)}%)`);
  console.log(`    Average response time: ${Math.round(avgResponseTime)}ms`);
  console.log(`    Max response time: ${Math.round(maxResponseTime)}ms`);
  console.log(`    Total test time: ${Math.round(totalTime)}ms`);
  
  const burstTestPassed = successRate >= STRESS_CONFIG.thresholds.minSuccessRate &&
                         avgResponseTime <= STRESS_CONFIG.thresholds.maxResponseTime;
  
  console.log(`  ${burstTestPassed ? '✅' : '❌'} Burst Load Test: ${burstTestPassed ? 'PASSED' : 'FAILED'}`);
  
  return {
    testName: 'Burst Load',
    requestCount,
    successfulRequests,
    successRate,
    avgResponseTime: Math.round(avgResponseTime),
    maxResponseTime: Math.round(maxResponseTime),
    totalTime: Math.round(totalTime),
    passed: burstTestPassed,
    results
  };
}

/**
 * Stress Test 2: Sustained Load Testing
 * Tests system performance under sustained concurrent load
 */
async function stressSustainedLoad() {
  console.log('\n🔄 Stress Testing: Sustained Load...');
  
  const { requests: requestCount, interval } = STRESS_CONFIG.loadPatterns.sustained;
  console.log(`  Sending ${requestCount} requests over ${interval * requestCount / 1000}s`);
  
  const startTime = Date.now();
  const activeRequests = new Map();
  const completedRequests = [];
  let requestIndex = 0;
  
  // Function to send a single request
  const sendRequest = async (index) => {
    const requestStartTime = Date.now();
    
    const dataset = {
      ...CONCURRENT_TEST_DATASETS.standard,
      modelName: `sustained-test-${index}-${Date.now()}`
    };
    
    stressMetrics.concurrentJobsActive++;
    stressMetrics.maxConcurrentJobsReached = Math.max(
      stressMetrics.maxConcurrentJobsReached,
      stressMetrics.concurrentJobsActive
    );
    
    activeRequests.set(index, requestStartTime);
    
    try {
      const result = await makeStressTestRequest('/api/runpod/train', {
        method: 'POST',
        body: JSON.stringify(dataset)
      });
      
      const requestTime = Date.now() - requestStartTime;
      
      stressMetrics.requestsSent++;
      stressMetrics.concurrentJobsActive--;
      activeRequests.delete(index);
      
      const requestResult = {
        requestIndex: index,
        requestTime,
        success: result.response && (result.response.ok || result.response.status === 401),
        statusCode: result.response ? result.response.status : null,
        error: result.data.error,
        timeout: result.timeout
      };
      
      if (requestResult.success) {
        stressMetrics.requestsSuccessful++;
      } else {
        stressMetrics.requestsFailed++;
        const errorType = result.data.error || 'unknown_error';
        stressMetrics.errorTypes[errorType] = (stressMetrics.errorTypes[errorType] || 0) + 1;
      }
      
      stressMetrics.responseTimes.push(requestTime);
      completedRequests.push(requestResult);
      
      console.log(`    Request ${index}: ${requestResult.success ? '✅' : '❌'} ${requestTime}ms (active: ${stressMetrics.concurrentJobsActive})`);
      
    } catch (error) {
      stressMetrics.concurrentJobsActive--;
      activeRequests.delete(index);
      stressMetrics.requestsFailed++;
      stressMetrics.errors.push(`Sustained load request ${index}: ${error.message}`);
      
      console.log(`    Request ${index}: ❌ Error - ${error.message}`);
    }
  };
  
  // Send requests at intervals
  const requestInterval = setInterval(() => {
    if (requestIndex < requestCount) {
      sendRequest(requestIndex);
      requestIndex++;
    } else {
      clearInterval(requestInterval);
    }
  }, interval);
  
  // Wait for all requests to complete
  const maxWaitTime = (requestCount * interval) + 30000; // Extra 30 seconds
  const waitStartTime = Date.now();
  
  while (activeRequests.size > 0 && (Date.now() - waitStartTime) < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`    ⏳ Waiting for ${activeRequests.size} active requests...`);
  }
  
  const totalTime = Date.now() - startTime;
  const successfulRequests = completedRequests.filter(r => r.success).length;
  const avgResponseTime = completedRequests.length > 0 
    ? completedRequests.reduce((sum, r) => sum + r.requestTime, 0) / completedRequests.length 
    : 0;
  const maxResponseTime = completedRequests.length > 0 
    ? Math.max(...completedRequests.map(r => r.requestTime)) 
    : 0;
  
  const successRate = successfulRequests / requestCount;
  
  console.log(`\n  📊 Sustained Load Results:`);
  console.log(`    Total requests: ${requestCount}`);
  console.log(`    Completed: ${completedRequests.length}`);
  console.log(`    Successful: ${successfulRequests} (${Math.round(successRate * 100)}%)`);
  console.log(`    Max concurrent: ${stressMetrics.maxConcurrentJobsReached}`);
  console.log(`    Average response time: ${Math.round(avgResponseTime)}ms`);
  console.log(`    Max response time: ${Math.round(maxResponseTime)}ms`);
  console.log(`    Total test time: ${Math.round(totalTime / 1000)}s`);
  
  const sustainedTestPassed = successRate >= STRESS_CONFIG.thresholds.minSuccessRate &&
                             avgResponseTime <= STRESS_CONFIG.thresholds.maxResponseTime;
  
  console.log(`  ${sustainedTestPassed ? '✅' : '❌'} Sustained Load Test: ${sustainedTestPassed ? 'PASSED' : 'FAILED'}`);
  
  return {
    testName: 'Sustained Load',
    requestCount,
    completedRequests: completedRequests.length,
    successfulRequests,
    successRate,
    maxConcurrent: stressMetrics.maxConcurrentJobsReached,
    avgResponseTime: Math.round(avgResponseTime),
    maxResponseTime: Math.round(maxResponseTime),
    totalTime: Math.round(totalTime / 1000),
    passed: sustainedTestPassed,
    results: completedRequests
  };
}

/**
 * Stress Test 3: Queue Management Under Load
 * Tests the training queue system under high load
 */
async function stressQueueManagement() {
  console.log('\n📋 Stress Testing: Queue Management...');
  
  const queueOperations = [
    { operation: 'add', count: 10 },
    { operation: 'status', count: 20 },
    { operation: 'priority_update', count: 5 },
    { operation: 'metrics', count: 10 }
  ];
  
  const results = [];
  
  for (const op of queueOperations) {
    console.log(`\n  🔄 Testing ${op.operation} operations (${op.count} requests):`);
    
    const operationStartTime = Date.now();
    const promises = [];
    
    for (let i = 0; i < op.count; i++) {
      let endpoint = '/api/training/queue';
      let options = {};
      
      switch (op.operation) {
        case 'add':
          options = {
            method: 'POST',
            body: JSON.stringify({
              trainingId: `stress-queue-${i}-${Date.now()}`,
              priority: Math.floor(Math.random() * 5) + 1,
              provider: 'runpod',
              estimatedDuration: 900000 // 15 minutes
            })
          };
          break;
          
        case 'status':
          endpoint = '/api/training/queue';
          break;
          
        case 'priority_update':
          endpoint = `/api/training/queue/stress-queue-${i}`;
          options = {
            method: 'PATCH',
            body: JSON.stringify({
              priority: Math.floor(Math.random() * 5) + 1
            })
          };
          break;
          
        case 'metrics':
          endpoint = '/api/training/queue/metrics';
          break;
      }
      
      const promise = makeStressTestRequest(endpoint, options).then(result => {
        const requestTime = Date.now() - operationStartTime;
        
        return {
          operation: op.operation,
          requestIndex: i,
          requestTime,
          success: result.response && (result.response.ok || result.response.status === 401),
          statusCode: result.response ? result.response.status : null,
          error: result.data.error,
          timeout: result.timeout
        };
      });
      
      promises.push(promise);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const operationResults = await Promise.all(promises);
    const operationTime = Date.now() - operationStartTime;
    
    const successfulOps = operationResults.filter(r => r.success).length;
    const avgOpTime = operationResults.reduce((sum, r) => sum + r.requestTime, 0) / operationResults.length;
    const successRate = successfulOps / op.count;
    
    console.log(`    📊 ${op.operation} results:`);
    console.log(`      Successful: ${successfulOps}/${op.count} (${Math.round(successRate * 100)}%)`);
    console.log(`      Average time: ${Math.round(avgOpTime)}ms`);
    console.log(`      Total time: ${Math.round(operationTime)}ms`);
    
    const operationPassed = successRate >= STRESS_CONFIG.thresholds.minSuccessRate;
    console.log(`      ${operationPassed ? '✅' : '❌'} ${op.operation} test: ${operationPassed ? 'PASSED' : 'FAILED'}`);
    
    results.push({
      operation: op.operation,
      requestCount: op.count,
      successfulRequests: successfulOps,
      successRate,
      avgResponseTime: Math.round(avgOpTime),
      totalTime: Math.round(operationTime),
      passed: operationPassed,
      results: operationResults
    });
  }
  
  const overallPassed = results.every(r => r.passed);
  console.log(`\n  ${overallPassed ? '✅' : '❌'} Queue Management Stress Test: ${overallPassed ? 'PASSED' : 'FAILED'}`);
  
  return {
    testName: 'Queue Management',
    operations: results,
    overallPassed
  };
}

/**
 * Stress Test 4: Resource Exhaustion Testing
 * Tests system behavior when approaching resource limits
 */
async function stressResourceExhaustion() {
  console.log('\n🔥 Stress Testing: Resource Exhaustion...');
  
  const resourceTests = [
    {
      name: 'Memory Intensive Requests',
      test: async () => {
        // Test with large datasets
        const largeDataset = {
          ...CONCURRENT_TEST_DATASETS.heavy,
          imageUrls: Array.from({ length: 25 }, (_, i) => 
            `https://picsum.photos/2048/2048?random=${i + 800}&face=1`
          ),
          modelName: `memory-stress-${Date.now()}`
        };
        
        const promises = [];
        for (let i = 0; i < 3; i++) {
          promises.push(
            makeStressTestRequest('/api/runpod/train', {
              method: 'POST',
              body: JSON.stringify({
                ...largeDataset,
                modelName: `memory-stress-${i}-${Date.now()}`
              })
            })
          );
        }
        
        const results = await Promise.all(promises);
        const successful = results.filter(r => r.response && (r.response.ok || r.response.status === 401)).length;
        
        return {
          name: 'Memory Intensive',
          requests: 3,
          successful,
          successRate: successful / 3,
          passed: successful >= 2 // At least 2 should succeed
        };
      }
    },
    {
      name: 'High Frequency Requests',
      test: async () => {
        // Test rapid-fire requests
        const promises = [];
        const requestCount = 15;
        
        for (let i = 0; i < requestCount; i++) {
          promises.push(
            makeStressTestRequest('/api/runpod/status', {
              method: 'GET'
            })
          );
        }
        
        const startTime = Date.now();
        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;
        
        const successful = results.filter(r => r.response && r.response.status !== 500).length;
        
        return {
          name: 'High Frequency',
          requests: requestCount,
          successful,
          successRate: successful / requestCount,
          totalTime,
          passed: successful >= requestCount * 0.8 // 80% success rate
        };
      }
    },
    {
      name: 'Concurrent Status Checks',
      test: async () => {
        // Test many concurrent status checks
        const promises = [];
        const requestCount = 20;
        
        for (let i = 0; i < requestCount; i++) {
          promises.push(
            makeStressTestRequest(`/api/runpod/status?training_id=stress-test-${i}`)
          );
        }
        
        const results = await Promise.all(promises);
        const successful = results.filter(r => !r.timeout).length;
        
        return {
          name: 'Concurrent Status Checks',
          requests: requestCount,
          successful,
          successRate: successful / requestCount,
          passed: successful >= requestCount * 0.9 // 90% should not timeout
        };
      }
    }
  ];
  
  const results = [];
  
  for (const resourceTest of resourceTests) {
    console.log(`\n  🔥 ${resourceTest.name}:`);
    
    try {
      const result = await resourceTest.test();
      
      console.log(`    📊 Requests: ${result.requests}`);
      console.log(`    📊 Successful: ${result.successful} (${Math.round(result.successRate * 100)}%)`);
      if (result.totalTime) {
        console.log(`    📊 Total time: ${result.totalTime}ms`);
      }
      console.log(`    ${result.passed ? '✅' : '❌'} ${result.name}: ${result.passed ? 'PASSED' : 'FAILED'}`);
      
      results.push(result);
      
    } catch (error) {
      console.log(`    ❌ ${resourceTest.name} failed: ${error.message}`);
      results.push({
        name: resourceTest.name,
        error: error.message,
        passed: false
      });
    }
  }
  
  const overallPassed = results.every(r => r.passed);
  console.log(`\n  ${overallPassed ? '✅' : '❌'} Resource Exhaustion Test: ${overallPassed ? 'PASSED' : 'FAILED'}`);
  
  return {
    testName: 'Resource Exhaustion',
    tests: results,
    overallPassed
  };
}

/**
 * Generate stress test report
 */
async function generateStressTestReport(results) {
  console.log('\n📊 Stress Test Report');
  console.log('=' .repeat(50));
  
  const { burstResult, sustainedResult, queueResult, resourceResult } = results;
  
  // Overall metrics
  console.log('\n📈 Overall Stress Test Metrics:');
  console.log(`  Total requests sent: ${stressMetrics.requestsSent}`);
  console.log(`  Successful requests: ${stressMetrics.requestsSuccessful}`);
  console.log(`  Failed requests: ${stressMetrics.requestsFailed}`);
  console.log(`  Overall success rate: ${stressMetrics.requestsSent > 0 ? Math.round((stressMetrics.requestsSuccessful / stressMetrics.requestsSent) * 100) : 0}%`);
  console.log(`  Max concurrent jobs: ${stressMetrics.maxConcurrentJobsReached}`);
  
  // Response time statistics
  if (stressMetrics.responseTimes.length > 0) {
    const avgResponseTime = stressMetrics.responseTimes.reduce((a, b) => a + b, 0) / stressMetrics.responseTimes.length;
    const maxResponseTime = Math.max(...stressMetrics.responseTimes);
    const minResponseTime = Math.min(...stressMetrics.responseTimes);
    
    console.log('\n⏱️  Response Time Statistics:');
    console.log(`  Average: ${Math.round(avgResponseTime)}ms`);
    console.log(`  Maximum: ${Math.round(maxResponseTime)}ms`);
    console.log(`  Minimum: ${Math.round(minResponseTime)}ms`);
  }
  
  // Error analysis
  if (Object.keys(stressMetrics.errorTypes).length > 0) {
    console.log('\n❌ Error Analysis:');
    Object.entries(stressMetrics.errorTypes).forEach(([errorType, count]) => {
      console.log(`  ${errorType}: ${count} occurrences`);
    });
  }
  
  // Test results summary
  console.log('\n🧪 Test Results Summary:');
  const testResults = [burstResult, sustainedResult, queueResult, resourceResult];
  const passedTests = testResults.filter(r => r.passed || r.overallPassed).length;
  
  testResults.forEach(result => {
    const passed = result.passed || result.overallPassed;
    console.log(`  ${passed ? '✅' : '❌'} ${result.testName}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log(`\n📊 Overall Stress Test Score: ${passedTests}/${testResults.length} (${Math.round((passedTests / testResults.length) * 100)}%)`);
  
  // Performance grade
  const stressScore = (passedTests / testResults.length) * 100;
  let grade = 'F';
  if (stressScore >= 90) grade = 'A';
  else if (stressScore >= 80) grade = 'B';
  else if (stressScore >= 70) grade = 'C';
  else if (stressScore >= 60) grade = 'D';
  
  console.log(`🏆 Stress Test Grade: ${grade}`);
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (stressScore < 80) {
    console.log('  - Consider implementing additional rate limiting');
    console.log('  - Optimize database connection pooling');
    console.log('  - Add more robust error handling for high load scenarios');
    console.log('  - Implement circuit breakers for external service calls');
  } else {
    console.log('  - System handles concurrent load well');
    console.log('  - Monitor production metrics to validate stress test results');
    console.log('  - Consider gradual load increase in production deployment');
  }
  
  // Save detailed report
  const reportData = {
    timestamp: new Date().toISOString(),
    stressConfig: STRESS_CONFIG,
    metrics: stressMetrics,
    results: {
      burstLoad: burstResult,
      sustainedLoad: sustainedResult,
      queueManagement: queueResult,
      resourceExhaustion: resourceResult
    },
    summary: {
      totalTests: testResults.length,
      passedTests,
      stressScore: Math.round(stressScore),
      grade
    }
  };
  
  try {
    await fs.writeFile(
      'test-runpod-stress-test-report.json',
      JSON.stringify(reportData, null, 2)
    );
    console.log('\n💾 Detailed report saved to: test-runpod-stress-test-report.json');
  } catch (error) {
    console.log('\n⚠️  Could not save detailed report:', error.message);
  }
  
  return stressScore >= 70; // Pass if 70% or higher
}

/**
 * Run all stress tests
 */
async function runStressTests() {
  console.log('🚀 Starting RunPod Stress Tests for Concurrent Job Handling');
  console.log('=' .repeat(60));
  console.log(`Base URL: ${STRESS_CONFIG.baseUrl}`);
  console.log(`Stress Configuration: ${JSON.stringify(STRESS_CONFIG.concurrency, null, 2)}`);
  
  const startTime = Date.now();
  
  try {
    // Run all stress test categories
    const burstResult = await stressBurstLoad();
    const sustainedResult = await stressSustainedLoad();
    const queueResult = await stressQueueManagement();
    const resourceResult = await stressResourceExhaustion();
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    console.log(`\n⏱️  Total stress test execution time: ${Math.round(totalTime / 1000)}s`);
    
    // Generate comprehensive report
    const stressTestsPassed = await generateStressTestReport({
      burstResult,
      sustainedResult,
      queueResult,
      resourceResult
    });
    
    if (stressTestsPassed) {
      console.log('\n🎉 Stress tests passed!');
      console.log('✅ RunPod pipeline can handle concurrent load effectively.');
    } else {
      console.log('\n⚠️  Some stress tests failed.');
      console.log('🔧 Optimize concurrent handling before production deployment.');
    }
    
    return stressTestsPassed;
    
  } catch (error) {
    console.error('\n💥 Stress test execution failed:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Export for use in other test files
module.exports = {
  runStressTests,
  stressBurstLoad,
  stressSustainedLoad,
  stressQueueManagement,
  stressResourceExhaustion,
  STRESS_CONFIG,
  CONCURRENT_TEST_DATASETS
};

// Run stress tests if this file is executed directly
if (require.main === module) {
  runStressTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Stress test execution failed:', error);
      process.exit(1);
    });
}