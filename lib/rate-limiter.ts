/**
 * Rate Limiter Utility
 * 
 * Provides rate limiting functionality for API endpoints to prevent abuse.
 * Uses in-memory storage for simplicity. For production with multiple instances,
 * consider using Redis or a database-backed solution.
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests allowed in the window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds to wait before retrying
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limit store
 * Key format: `${identifier}:${endpoint}`
 */
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Cleanup interval for expired rate limit records (5 minutes)
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

/**
 * Clean up expired rate limit records
 */
function cleanupExpiredRecords(): void {
  const now = Date.now();
  
  // Only cleanup every 5 minutes
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }
  
  lastCleanup = now;
  
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check rate limit for a given identifier and endpoint
 * 
 * @param identifier - Unique identifier (e.g., user ID, IP address)
 * @param endpoint - Endpoint name (e.g., 'upload', 'generate')
 * @param config - Rate limit configuration
 * @returns Rate limit result with allowed status and metadata
 */
export function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = `${identifier}:${endpoint}`;
  const record = rateLimitStore.get(key);
  
  // Cleanup expired records periodically
  cleanupExpiredRecords();
  
  // No existing record or expired record - create new one
  if (!record || now > record.resetAt) {
    const resetAt = now + config.windowMs;
    
    rateLimitStore.set(key, {
      count: 1,
      resetAt
    });
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: new Date(resetAt)
    };
  }
  
  // Check if limit exceeded
  if (record.count >= config.maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(record.resetAt),
      retryAfter
    };
  }
  
  // Increment count
  record.count++;
  
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetAt: new Date(record.resetAt)
  };
}

/**
 * Reset rate limit for a given identifier and endpoint
 * Useful for testing or manual overrides
 * 
 * @param identifier - Unique identifier
 * @param endpoint - Endpoint name
 */
export function resetRateLimit(identifier: string, endpoint: string): void {
  const key = `${identifier}:${endpoint}`;
  rateLimitStore.delete(key);
}

/**
 * Get current rate limit status without incrementing
 * 
 * @param identifier - Unique identifier
 * @param endpoint - Endpoint name
 * @param config - Rate limit configuration
 * @returns Current rate limit status
 */
export function getRateLimitStatus(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = `${identifier}:${endpoint}`;
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetAt) {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(now + config.windowMs)
    };
  }
  
  const remaining = Math.max(0, config.maxRequests - record.count);
  const allowed = remaining > 0;
  const retryAfter = allowed ? undefined : Math.ceil((record.resetAt - now) / 1000);
  
  return {
    allowed,
    remaining,
    resetAt: new Date(record.resetAt),
    retryAfter
  };
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitPresets = {
  // Upload: 10 requests per hour per user
  UPLOAD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10
  },
  
  // Generate: 5 requests per hour per user
  GENERATE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5
  },
  
  // Status polling: 30 requests per minute per job
  STATUS_POLL: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30
  },
  
  // Webhook: 100 requests per minute per IP
  WEBHOOK: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100
  }
} as const;

/**
 * Create rate limit headers for HTTP responses
 * 
 * @param result - Rate limit result
 * @param config - Rate limit configuration
 * @returns Headers object
 */
export function createRateLimitHeaders(
  result: RateLimitResult,
  config: RateLimitConfig
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toISOString()
  };
  
  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = result.retryAfter.toString();
  }
  
  return headers;
}
