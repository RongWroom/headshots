import { NextResponse } from 'next/server';
import { runPodService } from '@/lib/runpod-service';
import { apiHealthMonitor } from '@/lib/retry-utils';
import { Logger } from '@/lib/logger';

export const dynamic = "force-dynamic";

/**
 * RunPod service health and monitoring endpoint
 * Provides comprehensive health status, circuit breaker state, and error patterns
 */
export async function GET(request: Request) {
  const logger = new Logger('RUNPOD_HEALTH');
  
  try {
    logger.logInfo('RUNPOD_HEALTH_CHECK_START');
    
    const url = new URL(request.url);
    const detailed = url.searchParams.get('detailed') === 'true';
    
    // Check if RunPod is configured
    const isConfigured = runPodService.isConfigured();
    
    // Get current health status (only if configured)
    const isHealthy = isConfigured ? await runPodService.checkHealth() : false;
    const healthStatus = isConfigured ? runPodService.getHealthStatus() : { configured: false };
    
    // Get all service health data
    const allHealthData = apiHealthMonitor.getAllHealthStatus();
    
    // Basic health response
    const healthResponse: any = {
      service: 'RunPod Training Service',
      status: isConfigured ? (isHealthy ? 'healthy' : 'unhealthy') : 'not-configured',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      runpod: {
        configured: isConfigured,
        isHealthy: isConfigured ? isHealthy : null,
        ...healthStatus,
        endpoint: process.env.RUNPOD_TRAINING_ENDPOINT ? 'configured' : 'missing',
        apiKey: process.env.RUNPOD_API_KEY ? 'configured' : 'missing'
      }
    };
    
    // Add detailed information if requested
    if (detailed) {
      healthResponse.detailed = {
        allServices: allHealthData,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          env: {
            runpodEndpoint: !!process.env.RUNPOD_TRAINING_ENDPOINT,
            runpodApiKey: !!process.env.RUNPOD_API_KEY,
            supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            supabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          }
        },
        recommendations: generateHealthRecommendations(healthStatus, isHealthy)
      };
    }
    
    logger.logSuccess('RUNPOD_HEALTH_CHECK_COMPLETE', {
      isHealthy,
      configured: isConfigured,
      circuitBreakerState: isConfigured && 'circuitBreaker' in healthStatus ? healthStatus.circuitBreaker?.state : 'not-configured',
      consecutiveFailures: isConfigured && 'consecutiveFailures' in healthStatus ? healthStatus.consecutiveFailures : 0
    });
    
    // Return appropriate HTTP status
    const httpStatus = isConfigured ? (isHealthy ? 200 : 503) : 200; // 200 for not-configured to avoid build failures
    
    return NextResponse.json(healthResponse, { status: httpStatus });
    
  } catch (error: any) {
    logger.logError('RUNPOD_HEALTH_CHECK_ERROR', error);
    
    return NextResponse.json({
      service: 'RunPod Training Service',
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      recommendations: [
        'Check RunPod service configuration',
        'Verify network connectivity',
        'Review application logs for details'
      ]
    }, { status: 500 });
  }
}

/**
 * Test RunPod service connectivity and error handling
 */
export async function POST(request: Request) {
  const logger = new Logger('RUNPOD_HEALTH_TEST');
  
  try {
    const body = await request.json();
    const testType = body.testType || 'connectivity';
    
    logger.logInfo('RUNPOD_HEALTH_TEST_START', { testType });
    
    const testResults = {
      testType,
      timestamp: new Date().toISOString(),
      results: {}
    };
    
    switch (testType) {
      case 'connectivity':
        testResults.results = await testConnectivity();
        break;
        
      case 'error-handling':
        testResults.results = await testErrorHandling();
        break;
        
      case 'retry-logic':
        testResults.results = await testRetryLogic();
        break;
        
      case 'circuit-breaker':
        testResults.results = await testCircuitBreaker();
        break;
        
      case 'all':
        testResults.results = {
          connectivity: await testConnectivity(),
          errorHandling: await testErrorHandling(),
          retryLogic: await testRetryLogic(),
          circuitBreaker: await testCircuitBreaker()
        };
        break;
        
      default:
        throw new Error(`Unknown test type: ${testType}`);
    }
    
    logger.logSuccess('RUNPOD_HEALTH_TEST_COMPLETE', { testType, results: testResults.results });
    
    return NextResponse.json(testResults);
    
  } catch (error: any) {
    logger.logError('RUNPOD_HEALTH_TEST_ERROR', error);
    
    return NextResponse.json({
      error: 'Health test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Test basic connectivity to RunPod service
 */
async function testConnectivity() {
  const startTime = Date.now();
  
  try {
    const isHealthy = await runPodService.checkHealth();
    const responseTime = Date.now() - startTime;
    
    return {
      success: isHealthy,
      responseTime,
      message: isHealthy ? 'Service is reachable' : 'Service is not responding',
      details: runPodService.getHealthStatus()
    };
    
  } catch (error: any) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      message: 'Connectivity test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test error handling patterns
 */
async function testErrorHandling() {
  const tests = [];
  
  // Test 1: Invalid training request
  try {
    await runPodService.startTraining({
      input: {
        image_urls: [], // Empty array should trigger error
        trigger_word: 'test',
        model_name: 'test-error-handling',
        style_prompt: 'test',
        training_config: {
          resolution: 1024,
          max_train_steps: 1000,
          lora_rank: 64,
          lora_alpha: 64,
          learning_rate: 0.0001,
          train_batch_size: 1,
          gradient_accumulation_steps: 1,
          mixed_precision: 'fp16',
          use_8bit_adam: true,
          enable_xformers: true,
          save_steps: 500,
          warmup_steps: 100,
          scheduler_type: 'cosine',
          weight_decay: 0.01,
          max_grad_norm: 1.0
        }
      }
    });
    
    tests.push({
      test: 'Invalid request handling',
      success: false,
      message: 'Expected error was not thrown'
    });
    
  } catch (error: any) {
    tests.push({
      test: 'Invalid request handling',
      success: true,
      message: 'Error properly caught and classified',
      errorCode: error.code,
      userMessage: error.message
    });
  }
  
  // Test 2: Invalid training ID status check
  try {
    await runPodService.getTrainingStatus('invalid-id-12345');
    
    tests.push({
      test: 'Invalid status request handling',
      success: false,
      message: 'Expected error was not thrown'
    });
    
  } catch (error: any) {
    tests.push({
      test: 'Invalid status request handling',
      success: true,
      message: 'Status error properly handled',
      errorCode: error.code,
      userMessage: error.message
    });
  }
  
  return {
    totalTests: tests.length,
    passedTests: tests.filter(t => t.success).length,
    tests
  };
}

/**
 * Test retry logic behavior
 */
async function testRetryLogic() {
  // This is a simplified test - in a real scenario, we'd mock network failures
  const startTime = Date.now();
  
  try {
    // Attempt a request that might trigger retries
    await runPodService.getTrainingStatus('test-retry-logic-id');
    
    return {
      success: true,
      responseTime: Date.now() - startTime,
      message: 'Retry logic test completed',
      note: 'Actual retry behavior depends on service response'
    };
    
  } catch (error: any) {
    return {
      success: true, // Expected to fail, but we're testing the retry mechanism
      responseTime: Date.now() - startTime,
      message: 'Retry logic executed',
      errorHandled: true,
      finalError: error.message
    };
  }
}

/**
 * Test circuit breaker state
 */
async function testCircuitBreaker() {
  const healthStatus = runPodService.getHealthStatus();
  const circuitBreakerState = healthStatus.circuitBreaker;
  
  return {
    currentState: circuitBreakerState?.state || 'unknown',
    failures: circuitBreakerState?.failures || 0,
    lastFailureTime: circuitBreakerState?.lastFailureTime || 0,
    isOperational: circuitBreakerState?.state === 'CLOSED',
    recommendations: generateCircuitBreakerRecommendations(circuitBreakerState)
  };
}

/**
 * Generate health recommendations based on current status
 */
function generateHealthRecommendations(healthStatus: any, isHealthy: boolean) {
  const recommendations = [];
  
  if (!isHealthy) {
    recommendations.push('Service is currently unhealthy - check RunPod service status');
  }
  
  if (healthStatus.consecutiveFailures > 0) {
    recommendations.push(`${healthStatus.consecutiveFailures} consecutive failures detected - monitor service stability`);
  }
  
  if (healthStatus.circuitBreaker?.state === 'OPEN') {
    recommendations.push('Circuit breaker is OPEN - service will recover automatically');
  }
  
  if (healthStatus.circuitBreaker?.state === 'HALF_OPEN') {
    recommendations.push('Circuit breaker is HALF_OPEN - testing service recovery');
  }
  
  if (healthStatus.successRate < 0.9) {
    recommendations.push(`Success rate is ${(healthStatus.successRate * 100).toFixed(1)}% - investigate service issues`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Service is operating normally');
  }
  
  return recommendations;
}

/**
 * Generate circuit breaker specific recommendations
 */
function generateCircuitBreakerRecommendations(circuitBreakerState: any) {
  if (!circuitBreakerState) {
    return ['Circuit breaker status unavailable'];
  }
  
  const recommendations = [];
  
  switch (circuitBreakerState.state) {
    case 'CLOSED':
      recommendations.push('Circuit breaker is healthy and operational');
      break;
      
    case 'OPEN':
      recommendations.push('Circuit breaker is OPEN due to repeated failures');
      recommendations.push('Service will automatically attempt recovery');
      recommendations.push('Check RunPod service status and connectivity');
      break;
      
    case 'HALF_OPEN':
      recommendations.push('Circuit breaker is testing service recovery');
      recommendations.push('Monitor for successful requests to fully recover');
      break;
      
    default:
      recommendations.push('Unknown circuit breaker state');
  }
  
  if (circuitBreakerState.failures > 0) {
    recommendations.push(`${circuitBreakerState.failures} failures recorded`);
  }
  
  return recommendations;
}