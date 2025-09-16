/**
 * Error handling utilities for API endpoints
 * Provides consistent error formatting and development-mode debugging
 */

export interface ApiError {
  error: string;
  message: string;
  code: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  details?: any;
  stack?: string;
  suggestions?: string[];
}

export interface ApiSuccess {
  success: boolean;
  data?: any;
  message?: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string,
  message: string,
  code: string,
  requestId?: string,
  userId?: string,
  details?: any,
  suggestions?: string[]
): ApiError {
  return {
    error,
    message,
    code,
    timestamp: new Date().toISOString(),
    requestId,
    userId,
    details: process.env.NODE_ENV === 'development' ? details : undefined,
    suggestions
  };
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse(
  data?: any,
  message?: string,
  requestId?: string,
  userId?: string
): ApiSuccess {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId,
    userId
  };
}

/**
 * Extract safe error details for logging
 */
export function extractSafeErrorDetails(error: any): any {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }
  
  if (typeof error === 'object' && error !== null) {
    // Remove sensitive information
    const safeError = { ...error };
    delete safeError.password;
    delete safeError.token;
    delete safeError.secret;
    delete safeError.key;
    
    return safeError;
  }
  
  return { message: String(error) };
}

/**
 * Common error codes and their suggested actions
 */
export const ERROR_SUGGESTIONS = {
  UNAUTHORIZED: [
    'Sign in to your account',
    'Check if your session has expired',
    'Refresh the page and try again'
  ],
  VALIDATION_ERROR: [
    'Check that all required fields are present',
    'Verify data formats match requirements',
    'Review the API documentation for correct format'
  ],
  RATE_LIMITED: [
    'Wait a moment before trying again',
    'Reduce the frequency of requests',
    'Contact support if you need higher limits'
  ],
  NETWORK_ERROR: [
    'Check your internet connection',
    'Try again in a few moments',
    'Contact support if the issue persists'
  ],
  CONFIGURATION_ERROR: [
    'Check environment variables are set correctly',
    'Verify API credentials are valid',
    'Contact system administrator'
  ]
};

/**
 * Log structured error information
 */
export function logStructuredError(
  endpoint: string,
  stage: string,
  error: any,
  context?: any,
  requestId?: string,
  userId?: string
) {
  const logData = {
    endpoint,
    stage,
    requestId,
    userId,
    timestamp: new Date().toISOString(),
    error: extractSafeErrorDetails(error),
    context
  };
  
  console.error(`[API_ERROR] ${endpoint}:${stage}`, JSON.stringify(logData, null, 2));
}

/**
 * Log structured success information
 */
export function logStructuredSuccess(
  endpoint: string,
  stage: string,
  data?: any,
  requestId?: string,
  userId?: string
) {
  const logData = {
    endpoint,
    stage,
    requestId,
    userId,
    timestamp: new Date().toISOString(),
    data
  };
  
  console.log(`[API_SUCCESS] ${endpoint}:${stage}`, JSON.stringify(logData, null, 2));
}