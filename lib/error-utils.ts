/**
 * Centralized error handling utilities for Seedream integration
 * Provides retry logic, error classification, and user-friendly error messages
 */

import { Logger } from './logger';

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

// Error types
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  REPLICATE_ERROR = 'REPLICATE_ERROR',
  WEBHOOK_ERROR = 'WEBHOOK_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

// Error classification
export interface ClassifiedError {
  type: ErrorType;
  statusCode: number;
  message: string;
  userMessage: string;
  isRetryable: boolean;
  suggestions: string[];
  originalError?: any;
}

/**
 * Sleep utility for retry delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  logger?: Logger
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  let delay = config.initialDelay;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      const isRetryable = isRetryableError(error);
      
      if (logger) {
        logger.logWarning(
          'retry_attempt',
          `Attempt ${attempt + 1}/${config.maxRetries} failed`,
          {
            error: extractErrorMessage(error),
            isRetryable,
            nextDelay: isRetryable && attempt < config.maxRetries - 1 ? delay : null,
          }
        );
      }
      
      // Don't retry if error is not retryable or we've exhausted retries
      if (!isRetryable || attempt >= config.maxRetries - 1) {
        throw lastError;
      }

      // Wait before retrying
      await sleep(delay);
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }

  throw lastError;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as any;
  
  // Retry on rate limits (429)
  if (err.response?.status === 429 || err.status === 429) {
    return true;
  }

  // Retry on server errors (500, 502, 503, 504)
  if (
    (err.response?.status >= 500 && err.response?.status < 600) ||
    (err.status >= 500 && err.status < 600)
  ) {
    return true;
  }

  // Retry on network errors
  if (
    err.code === 'ECONNRESET' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNREFUSED'
  ) {
    return true;
  }

  // Retry on fetch network errors
  if (err.name === 'FetchError' || err.type === 'system') {
    return true;
  }

  return false;
}

/**
 * Classify error and provide user-friendly information
 */
export function classifyError(error: unknown, context?: string): ClassifiedError {
  if (!error || typeof error !== 'object') {
    return {
      type: ErrorType.UNKNOWN,
      statusCode: 500,
      message: String(error),
      userMessage: 'An unexpected error occurred. Please try again.',
      isRetryable: false,
      suggestions: ['Try again later', 'Contact support if the issue persists'],
    };
  }

  const err = error as any;
  const status = err.response?.status || err.status || 500;

  // Validation errors (400)
  if (status === 400) {
    return {
      type: ErrorType.VALIDATION,
      statusCode: 400,
      message: err.message || 'Validation failed',
      userMessage: 'Invalid input. Please check your data and try again.',
      isRetryable: false,
      suggestions: [
        'Verify all required fields are provided',
        'Check file formats and sizes',
        'Ensure style ID is valid',
      ],
      originalError: err,
    };
  }

  // Authentication errors (401)
  if (status === 401) {
    return {
      type: ErrorType.AUTHENTICATION,
      statusCode: 401,
      message: err.message || 'Authentication failed',
      userMessage: 'You must be logged in to perform this action.',
      isRetryable: false,
      suggestions: ['Log in to your account', 'Refresh your session'],
      originalError: err,
    };
  }

  // Authorization errors (403)
  if (status === 403) {
    return {
      type: ErrorType.AUTHORIZATION,
      statusCode: 403,
      message: err.message || 'Authorization failed',
      userMessage: 'You do not have permission to access this resource.',
      isRetryable: false,
      suggestions: ['Verify you own this resource', 'Contact support if you believe this is an error'],
      originalError: err,
    };
  }

  // Not found errors (404)
  if (status === 404) {
    return {
      type: ErrorType.NOT_FOUND,
      statusCode: 404,
      message: err.message || 'Resource not found',
      userMessage: 'The requested resource was not found.',
      isRetryable: false,
      suggestions: ['Check the resource ID', 'Verify the resource exists'],
      originalError: err,
    };
  }

  // Rate limit errors (429)
  if (status === 429) {
    return {
      type: ErrorType.RATE_LIMIT,
      statusCode: 429,
      message: err.message || 'Rate limit exceeded',
      userMessage: 'Too many requests. Please wait a moment and try again.',
      isRetryable: true,
      suggestions: [
        'Wait 30-60 seconds before retrying',
        'Reduce the frequency of requests',
      ],
      originalError: err,
    };
  }

  // Server errors (500+)
  if (status >= 500) {
    return {
      type: ErrorType.SERVER_ERROR,
      statusCode: status,
      message: err.message || 'Server error',
      userMessage: 'A server error occurred. Please try again in a moment.',
      isRetryable: true,
      suggestions: [
        'Wait a few minutes and try again',
        'Contact support if the issue persists',
      ],
      originalError: err,
    };
  }

  // Network errors
  if (
    err.code === 'ECONNRESET' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNREFUSED' ||
    err.name === 'FetchError'
  ) {
    return {
      type: ErrorType.NETWORK_ERROR,
      statusCode: 503,
      message: err.message || 'Network error',
      userMessage: 'Network connection failed. Please check your connection and try again.',
      isRetryable: true,
      suggestions: [
        'Check your internet connection',
        'Try again in a moment',
      ],
      originalError: err,
    };
  }

  // Replicate-specific errors
  if (err.message?.includes('Replicate') || context?.includes('replicate')) {
    return {
      type: ErrorType.REPLICATE_ERROR,
      statusCode: 500,
      message: err.message || 'Replicate API error',
      userMessage: 'Image generation service is temporarily unavailable. Please try again.',
      isRetryable: true,
      suggestions: [
        'Wait a few minutes and try again',
        'Contact support if the issue persists',
      ],
      originalError: err,
    };
  }

  // Webhook errors
  if (context?.includes('webhook')) {
    return {
      type: ErrorType.WEBHOOK_ERROR,
      statusCode: 500,
      message: err.message || 'Webhook processing failed',
      userMessage: 'Failed to process generation results. Your job may still complete.',
      isRetryable: true,
      suggestions: [
        'Check job status in a few minutes',
        'The system will retry automatically',
      ],
      originalError: err,
    };
  }

  // Storage errors
  if (err.message?.includes('blob') || err.message?.includes('storage') || context?.includes('storage')) {
    return {
      type: ErrorType.STORAGE_ERROR,
      statusCode: 500,
      message: err.message || 'Storage error',
      userMessage: 'Failed to store images. Please try again.',
      isRetryable: true,
      suggestions: [
        'Try uploading again',
        'Check file sizes and formats',
        'Contact support if the issue persists',
      ],
      originalError: err,
    };
  }

  // Unknown errors
  return {
    type: ErrorType.UNKNOWN,
    statusCode: 500,
    message: err.message || 'Unknown error',
    userMessage: 'An unexpected error occurred. Please try again.',
    isRetryable: false,
    suggestions: [
      'Try again later',
      'Contact support if the issue persists',
    ],
    originalError: err,
  };
}

/**
 * Extract error message from various error types
 */
export function extractErrorMessage(error: unknown): string {
  if (!error) {
    return 'Unknown error';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object') {
    const err = error as any;
    return err.message || err.error || err.statusText || JSON.stringify(error);
  }

  return String(error);
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  logger?: Logger,
  context?: string
): {
  error: string;
  message: string;
  code: string;
  statusCode: number;
  suggestions?: string[];
  requestId?: string;
} {
  const classified = classifyError(error, context);

  if (logger) {
    logger.logError(context || 'error', error, {
      type: classified.type,
      statusCode: classified.statusCode,
      isRetryable: classified.isRetryable,
    });
  }

  return {
    error: classified.type,
    message: classified.userMessage,
    code: classified.type,
    statusCode: classified.statusCode,
    suggestions: classified.suggestions,
    requestId: logger?.getRequestId(),
  };
}

/**
 * Webhook delivery fallback - poll Replicate if webhook fails
 */
export async function webhookFallbackPoll(
  predictionId: string,
  getPredictionFn: (id: string) => Promise<any>,
  maxAttempts: number = 10,
  intervalMs: number = 5000,
  logger?: Logger
): Promise<any> {
  if (logger) {
    logger.logInfo('webhook_fallback', {
      predictionId,
      maxAttempts,
      intervalMs,
    });
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const prediction = await getPredictionFn(predictionId);

      if (logger) {
        logger.logInfo('webhook_fallback_poll', {
          attempt: attempt + 1,
          status: prediction.status,
        });
      }

      // If prediction is complete or failed, return it
      if (prediction.status === 'succeeded' || prediction.status === 'failed') {
        if (logger) {
          logger.logSuccess('webhook_fallback_complete', {
            status: prediction.status,
            attempts: attempt + 1,
          });
        }
        return prediction;
      }

      // Wait before next poll
      if (attempt < maxAttempts - 1) {
        await sleep(intervalMs);
      }
    } catch (error) {
      if (logger) {
        logger.logWarning('webhook_fallback_error', `Poll attempt ${attempt + 1} failed`, {
          error: extractErrorMessage(error),
        });
      }

      // If this is the last attempt, throw the error
      if (attempt >= maxAttempts - 1) {
        throw error;
      }

      // Wait before retrying
      await sleep(intervalMs);
    }
  }

  throw new Error(`Webhook fallback polling timed out after ${maxAttempts} attempts`);
}

/**
 * Retry image download with exponential backoff
 */
export async function retryImageDownload(
  url: string,
  maxRetries: number = 3,
  logger?: Logger
): Promise<ArrayBuffer> {
  return withRetry(
    async () => {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }

      return await response.arrayBuffer();
    },
    {
      maxRetries,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffMultiplier: 2,
    },
    logger
  );
}

/**
 * Retry blob upload with different names on conflict
 */
export async function retryBlobUpload(
  uploadFn: (path: string) => Promise<any>,
  basePath: string,
  maxRetries: number = 3,
  logger?: Logger
): Promise<any> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add attempt number to path if retrying
      const path = attempt === 0 ? basePath : `${basePath}_retry${attempt}`;
      
      if (logger && attempt > 0) {
        logger.logInfo('blob_upload_retry', {
          attempt: attempt + 1,
          path,
        });
      }

      return await uploadFn(path);
    } catch (error) {
      lastError = error as Error;

      if (logger) {
        logger.logWarning('blob_upload_failed', `Upload attempt ${attempt + 1} failed`, {
          error: extractErrorMessage(error),
        });
      }

      // If this is the last attempt, throw the error
      if (attempt >= maxRetries - 1) {
        throw lastError;
      }

      // Wait before retrying
      await sleep(1000 * (attempt + 1));
    }
  }

  throw lastError;
}
