/**
 * Retry utilities for handling transient failures in API calls
 * Implements exponential backoff and configurable retry strategies
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  backoffMultiplier?: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: any;
  attempts: number;
  totalTime: number;
}

/**
 * Default retry condition - retries on network errors and 5xx status codes
 */
export function defaultRetryCondition(error: any): boolean {
  // Retry on network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }
  
  // Retry on timeout errors
  if (error.name === 'AbortError' || error.message.includes('timeout')) {
    return true;
  }
  
  // Retry on 5xx server errors
  if (error.status >= 500 && error.status < 600) {
    return true;
  }
  
  // Retry on 429 (rate limiting)
  if (error.status === 429) {
    return true;
  }
  
  // Don't retry on 4xx client errors (except 429)
  if (error.status >= 400 && error.status < 500) {
    return false;
  }
  
  return true; // Retry on unknown errors
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateDelay(
  attempt: number, 
  baseDelay: number, 
  maxDelay: number, 
  backoffMultiplier: number
): number {
  const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
  const delayWithJitter = exponentialDelay * (0.5 + Math.random() * 0.5); // Add 0-50% jitter
  return Math.min(delayWithJitter, maxDelay);
}

/**
 * Generic retry function with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    retryCondition = defaultRetryCondition,
    onRetry
  } = options;

  const startTime = Date.now();
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await operation();
      return {
        success: true,
        data: result,
        attempts: attempt,
        totalTime: Date.now() - startTime
      };
    } catch (error) {
      lastError = error;
      
      // Don't retry on the last attempt
      if (attempt > maxRetries) {
        break;
      }
      
      // Check if we should retry this error
      if (!retryCondition(error)) {
        break;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, baseDelay, maxDelay, backoffMultiplier);
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: maxRetries + 1,
    totalTime: Date.now() - startTime
  };
}

/**
 * Retry wrapper specifically for fetch requests
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<RetryResult<Response>> {
  return withRetry(async () => {
    const response = await fetch(url, options);
    
    // Throw error for non-ok responses so they can be retried
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      (error as any).status = response.status;
      (error as any).response = response;
      throw error;
    }
    
    return response;
  }, {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    ...retryOptions
  });
}

/**
 * Retry wrapper for Replicate API calls
 */
export async function replicateApiWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<RetryResult<any>> {
  const replicateRetryCondition = (error: any): boolean => {
    // Always retry on network errors
    if (error.name === 'TypeError' || error.name === 'AbortError') {
      return true;
    }
    
    // Retry on 5xx errors
    if (error.status >= 500) {
      return true;
    }
    
    // Retry on 429 (rate limiting)
    if (error.status === 429) {
      return true;
    }
    
    // Retry on 408 (timeout)
    if (error.status === 408) {
      return true;
    }
    
    // Don't retry on 4xx client errors (except 429 and 408)
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
    
    return true;
  };

  return withRetry(async () => {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      const error = new Error(data.detail || `HTTP ${response.status}: ${response.statusText}`);
      (error as any).status = response.status;
      (error as any).response = response;
      (error as any).data = data;
      throw error;
    }
    
    return data;
  }, {
    maxRetries: 3,
    baseDelay: 2000, // Longer delay for external API
    maxDelay: 30000,
    retryCondition: replicateRetryCondition,
    ...retryOptions
  });
}

/**
 * Retry wrapper for Vercel Blob operations
 */
export async function blobOperationWithRetry<T>(
  operation: () => Promise<T>,
  retryOptions: RetryOptions = {}
): Promise<RetryResult<T>> {
  const blobRetryCondition = (error: any): boolean => {
    // Retry on network errors
    if (error.name === 'TypeError' || error.name === 'AbortError') {
      return true;
    }
    
    // Retry on 5xx errors
    if (error.status >= 500) {
      return true;
    }
    
    // Retry on 429 (rate limiting)
    if (error.status === 429) {
      return true;
    }
    
    // Don't retry on 4xx client errors (except 429)
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
    
    return true;
  };

  return withRetry(operation, {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 15000,
    retryCondition: blobRetryCondition,
    ...retryOptions
  });
}

/**
 * Circuit breaker pattern for API health monitoring
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000, // 1 minute
    private monitorWindow: number = 300000 // 5 minutes
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
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
  
  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
  
  private reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }
  
  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * API health monitoring utility
 */
export class ApiHealthMonitor {
  private healthChecks: Map<string, { 
    lastCheck: number; 
    isHealthy: boolean; 
    consecutiveFailures: number;
    totalRequests: number;
    successfulRequests: number;
  }> = new Map();
  
  constructor(private checkInterval: number = 300000) {} // 5 minutes
  
  async checkHealth(serviceName: string, healthCheckFn: () => Promise<boolean>): Promise<boolean> {
    const now = Date.now();
    const existing = this.healthChecks.get(serviceName);
    
    // Skip if recently checked
    if (existing && (now - existing.lastCheck) < this.checkInterval) {
      return existing.isHealthy;
    }
    
    try {
      const isHealthy = await healthCheckFn();
      
      this.healthChecks.set(serviceName, {
        lastCheck: now,
        isHealthy,
        consecutiveFailures: isHealthy ? 0 : (existing?.consecutiveFailures || 0) + 1,
        totalRequests: (existing?.totalRequests || 0) + 1,
        successfulRequests: (existing?.successfulRequests || 0) + (isHealthy ? 1 : 0)
      });
      
      return isHealthy;
    } catch (error) {
      this.healthChecks.set(serviceName, {
        lastCheck: now,
        isHealthy: false,
        consecutiveFailures: (existing?.consecutiveFailures || 0) + 1,
        totalRequests: (existing?.totalRequests || 0) + 1,
        successfulRequests: existing?.successfulRequests || 0
      });
      
      return false;
    }
  }
  
  getHealthStatus(serviceName: string): {
    isHealthy: boolean;
    consecutiveFailures: number;
    successRate: number;
    lastCheck: number;
  } | null {
    const health = this.healthChecks.get(serviceName);
    if (!health) return null;
    
    return {
      isHealthy: health.isHealthy,
      consecutiveFailures: health.consecutiveFailures,
      successRate: health.totalRequests > 0 ? health.successfulRequests / health.totalRequests : 0,
      lastCheck: health.lastCheck
    };
  }
  
  getAllHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [serviceName, health] of this.healthChecks) {
      status[serviceName] = {
        isHealthy: health.isHealthy,
        consecutiveFailures: health.consecutiveFailures,
        successRate: health.totalRequests > 0 ? health.successfulRequests / health.totalRequests : 0,
        lastCheck: health.lastCheck,
        totalRequests: health.totalRequests,
        successfulRequests: health.successfulRequests
      };
    }
    
    return status;
  }
}

// Global instances
export const replicateCircuitBreaker = new CircuitBreaker(5, 60000, 300000);
export const blobCircuitBreaker = new CircuitBreaker(3, 30000, 180000);
export const apiHealthMonitor = new ApiHealthMonitor(300000);