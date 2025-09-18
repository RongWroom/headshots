/**
 * Enhanced logging utility for API endpoints
 * Provides structured logging with request tracking and error details
 */

export interface LogContext {
  requestId: string;
  userId?: string;
  endpoint: string;
  stage: string;
  timestamp: string;
  data?: any;
  error?: {
    message: string;
    name: string;
    stack?: string;
  };
}

export interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  timestamp: string;
  requestId: string;
  userId?: string;
  details?: any;
  stack?: string;
  suggestions?: string[];
}

export class Logger {
  private endpoint: string;
  private requestId: string;
  private userId?: string;
  private startTime: number;

  constructor(endpoint: string, requestId?: string, userId?: string) {
    this.endpoint = endpoint;
    this.requestId = requestId || this.generateRequestId();
    this.userId = userId;
    this.startTime = Date.now();
  }

  private generateRequestId(): string {
    const prefix = this.endpoint.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createLogContext(stage: string, data?: any, error?: any): LogContext {
    return {
      requestId: this.requestId,
      userId: this.userId,
      endpoint: this.endpoint,
      stage,
      timestamp: new Date().toISOString(),
      data,
      error: error ? {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      } : undefined
    };
  }

  logInfo(stage: string, data?: any) {
    const context = this.createLogContext(stage, data);
    console.log(`[${this.endpoint.toUpperCase()}_INFO] ${stage}:`, JSON.stringify(context, null, 2));
  }

  logSuccess(stage: string, data?: any) {
    const context = this.createLogContext(stage, data);
    console.log(`[${this.endpoint.toUpperCase()}_SUCCESS] ${stage}:`, JSON.stringify(context, null, 2));
  }

  logWarning(stage: string, message: string, data?: any) {
    const context = this.createLogContext(stage, { warning: message, ...data });
    console.warn(`[${this.endpoint.toUpperCase()}_WARNING] ${stage}:`, JSON.stringify(context, null, 2));
  }

  logError(stage: string, error: any, data?: any) {
    const context = this.createLogContext(stage, data, error);
    console.error(`[${this.endpoint.toUpperCase()}_ERROR] ${stage}:`, JSON.stringify(context, null, 2));
  }

  createErrorResponse(
    error: string,
    message: string,
    code: string,
    details?: any,
    suggestions?: string[]
  ): ErrorResponse {
    return {
      error,
      message,
      code,
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      userId: this.userId,
      details,
      suggestions,
      ...(process.env.NODE_ENV === 'development' && details?.stack && { stack: details.stack })
    };
  }

  getRequestId(): string {
    return this.requestId;
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * Record metrics for monitoring (async to avoid blocking)
   */
  async recordMetric(operation: string, success: boolean, error?: string) {
    try {
      const responseTime = Date.now() - this.startTime;
      
      // Record metric asynchronously
      fetch('/api/monitoring/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation: `${this.endpoint}.${operation}`,
          success,
          responseTime,
          error
        })
      }).catch(() => {
        // Silently fail - don't let metrics recording break the main flow
      });
    } catch {
      // Silently fail - metrics are not critical
    }
  }

  /**
   * Log and record success metric
   */
  async logSuccessWithMetric(stage: string, operation: string, data?: any) {
    this.logSuccess(stage, data);
    await this.recordMetric(operation, true);
  }

  /**
   * Log and record error metric
   */
  async logErrorWithMetric(stage: string, operation: string, error: any, data?: any) {
    this.logError(stage, error, data);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await this.recordMetric(operation, false, errorMessage);
  }
}

// Utility function to safely extract error details
export function extractErrorDetails(error: any): any {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack
    };
  }
  
  if (typeof error === 'object' && error !== null) {
    return {
      message: error.message || String(error),
      details: error
    };
  }
  
  return {
    message: String(error)
  };
}

// Utility function to safely log API responses
export function logApiResponse(logger: Logger, stage: string, response: Response, responseData?: any) {
  const logData = {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    url: response.url,
    responseData: responseData ? (typeof responseData === 'string' ? responseData.substring(0, 1000) : responseData) : undefined
  };

  if (response.ok) {
    logger.logSuccess(stage, logData);
  } else {
    logger.logError(stage, `HTTP ${response.status}: ${response.statusText}`, logData);
  }
}