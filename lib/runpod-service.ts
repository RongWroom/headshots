/**
 * RunPod Training Service with comprehensive error handling and retry logic
 * Implements exponential backoff, circuit breaker pattern, and specific RunPod error handling
 */

import { withRetry, RetryOptions, CircuitBreaker, ApiHealthMonitor } from './retry-utils';
import { Logger, extractErrorDetails } from './logger';

export interface RunPodTrainingRequest {
  input: {
    image_urls: string[];
    trigger_word: string;
    model_name: string;
    style_prompt: string;
    training_config: {
      resolution: number;
      max_train_steps: number;
      lora_rank: number;
      lora_alpha: number;
      learning_rate: number;
      train_batch_size: number;
      gradient_accumulation_steps: number;
      mixed_precision: string;
      use_8bit_adam: boolean;
      enable_xformers: boolean;
      save_steps: number;
      warmup_steps: number;
      scheduler_type: string;
      weight_decay: number;
      max_grad_norm: number;
      ab_test_id?: string;
      variant_id?: string;
    };
  };
}

export interface RunPodTrainingResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  output?: any;
  error?: string;
  executionTime?: number;
  delayTime?: number;
}

export interface RunPodStatusResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  output?: any;
  error?: string;
  executionTime?: number;
  delayTime?: number;
  logs?: string;
}

export interface RunPodError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  userMessage: string;
  actionableSteps: string[];
}

/**
 * RunPod-specific error types and handling
 */
export class RunPodErrorHandler {
  private static readonly ERROR_PATTERNS = {
    // GPU/Resource errors
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
    
    // Network/Connection errors
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
    CONNECTION_ERROR: {
      patterns: ['connection refused', 'network error', 'connection reset'],
      retryable: true,
      userMessage: 'Unable to connect to training service',
      actionableSteps: [
        'Check your internet connection',
        'Verify RunPod service status',
        'Try again in a few minutes'
      ]
    },
    
    // Authentication/Authorization errors
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
    },
    
    // Training-specific errors
    INVALID_IMAGES: {
      patterns: ['invalid image', 'image format not supported', 'corrupted image'],
      retryable: false,
      userMessage: 'One or more training images are invalid or corrupted',
      actionableSteps: [
        'Check that all images are valid and accessible',
        'Ensure images are in supported formats (JPEG, PNG)',
        'Verify image URLs are publicly accessible'
      ]
    },
    INSUFFICIENT_IMAGES: {
      patterns: ['insufficient training data', 'not enough images', 'minimum images required'],
      retryable: false,
      userMessage: 'Not enough training images provided',
      actionableSteps: [
        'Upload at least 8-20 high-quality images',
        'Ensure images show clear facial features',
        'Include variety in poses and lighting'
      ]
    },
    TRAINING_FAILED: {
      patterns: ['training failed', 'model training error', 'convergence failed'],
      retryable: true,
      userMessage: 'Model training process failed',
      actionableSteps: [
        'Try training again with different parameters',
        'Check image quality and variety',
        'Contact support if failures persist'
      ]
    },
    
    // Service/Infrastructure errors
    SERVICE_UNAVAILABLE: {
      patterns: ['service unavailable', 'maintenance mode', 'temporarily unavailable'],
      retryable: true,
      userMessage: 'Training service is temporarily unavailable',
      actionableSteps: [
        'Wait and try again later',
        'Check RunPod status page',
        'Consider using alternative training times'
      ]
    },
    INTERNAL_ERROR: {
      patterns: ['internal server error', '500', 'unexpected error'],
      retryable: true,
      userMessage: 'An internal error occurred in the training service',
      actionableSteps: [
        'Try again in a few minutes',
        'Contact support if error persists',
        'Provide training details for troubleshooting'
      ]
    }
  };

  static classifyError(error: any): RunPodError {
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
    if (statusCode) {
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
          userMessage: this.ERROR_PATTERNS.INTERNAL_ERROR.userMessage,
          actionableSteps: this.ERROR_PATTERNS.INTERNAL_ERROR.actionableSteps
        };
      }
    }
    
    // Default classification for unknown errors
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

/**
 * RunPod Training Service with comprehensive error handling
 */
export class RunPodTrainingService {
  private logger: Logger;
  private circuitBreaker: CircuitBreaker;
  private healthMonitor: ApiHealthMonitor;
  private endpoint: string;
  private apiKey: string;

  constructor() {
    this.logger = new Logger('RUNPOD_SERVICE');
    this.circuitBreaker = new CircuitBreaker(5, 60000, 300000); // 5 failures, 1min recovery, 5min window
    this.healthMonitor = new ApiHealthMonitor(300000); // 5 minute check interval
    
    this.endpoint = process.env.RUNPOD_TRAINING_ENDPOINT!;
    this.apiKey = process.env.RUNPOD_API_KEY!;
    
    if (!this.endpoint || !this.apiKey) {
      throw new Error('RunPod configuration missing: RUNPOD_TRAINING_ENDPOINT and RUNPOD_API_KEY required');
    }
  }

  /**
   * Start training with comprehensive error handling and retry logic
   */
  async startTraining(request: RunPodTrainingRequest): Promise<RunPodTrainingResponse> {
    this.logger.logInfo('RUNPOD_TRAINING_START', {
      modelName: request.input.model_name,
      imageCount: request.input.image_urls.length,
      trainingSteps: request.input.training_config.max_train_steps
    });

    const retryOptions: RetryOptions = {
      maxRetries: 3,
      baseDelay: 2000, // Start with 2 seconds
      maxDelay: 30000, // Max 30 seconds
      backoffMultiplier: 2,
      retryCondition: (error: any) => {
        const classifiedError = RunPodErrorHandler.classifyError(error);
        this.logger.logInfo('RUNPOD_ERROR_CLASSIFIED', {
          errorCode: classifiedError.code,
          retryable: classifiedError.retryable,
          userMessage: classifiedError.userMessage
        });
        return classifiedError.retryable;
      },
      onRetry: (attempt: number, error: any) => {
        const classifiedError = RunPodErrorHandler.classifyError(error);
        this.logger.logWarning('RUNPOD_RETRY_ATTEMPT', {
          attempt,
          errorCode: classifiedError.code,
          errorMessage: classifiedError.message,
          nextRetryIn: `${Math.min(2000 * Math.pow(2, attempt), 30000)}ms`
        });
      }
    };

    try {
      const result = await this.circuitBreaker.execute(async () => {
        const retryResult = await withRetry(async () => {
          return await this.makeTrainingRequest(request);
        }, retryOptions);

        if (!retryResult.success) {
          const classifiedError = RunPodErrorHandler.classifyError(retryResult.error);
          
          this.logger.logError('RUNPOD_TRAINING_FAILED_AFTER_RETRIES', {
            errorCode: classifiedError.code,
            attempts: retryResult.attempts,
            totalTime: retryResult.totalTime,
            finalError: classifiedError.message
          });

          // Throw a user-friendly error
          const error = new Error(classifiedError.userMessage);
          (error as any).code = classifiedError.code;
          (error as any).retryable = classifiedError.retryable;
          (error as any).actionableSteps = classifiedError.actionableSteps;
          (error as any).details = classifiedError.details;
          throw error;
        }

        this.logger.logSuccess('RUNPOD_TRAINING_STARTED', {
          trainingId: retryResult.data.id,
          attempts: retryResult.attempts,
          totalTime: retryResult.totalTime
        });

        return retryResult.data;
      });

      return result;

    } catch (error) {
      // Handle circuit breaker errors
      if (error.message.includes('Circuit breaker is OPEN')) {
        this.logger.logError('RUNPOD_CIRCUIT_BREAKER_OPEN', {
          circuitState: this.circuitBreaker.getState()
        });

        const circuitError = new Error('RunPod training service is temporarily unavailable due to repeated failures');
        (circuitError as any).code = 'SERVICE_UNAVAILABLE';
        (circuitError as any).retryable = true;
        (circuitError as any).actionableSteps = [
          'Wait a few minutes for the service to recover',
          'Check RunPod service status',
          'Try again later or contact support'
        ];
        throw circuitError;
      }

      throw error;
    }
  }

  /**
   * Get training status with retry logic
   */
  async getTrainingStatus(trainingId: string): Promise<RunPodStatusResponse> {
    this.logger.logInfo('RUNPOD_STATUS_CHECK', { trainingId });

    const retryOptions: RetryOptions = {
      maxRetries: 2, // Fewer retries for status checks
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryCondition: (error: any) => {
        const classifiedError = RunPodErrorHandler.classifyError(error);
        // Only retry on network/service errors for status checks
        return classifiedError.code === 'TIMEOUT' || 
               classifiedError.code === 'CONNECTION_ERROR' || 
               classifiedError.code === 'SERVICE_UNAVAILABLE' ||
               classifiedError.code === 'INTERNAL_ERROR';
      }
    };

    const retryResult = await withRetry(async () => {
      return await this.makeStatusRequest(trainingId);
    }, retryOptions);

    if (!retryResult.success) {
      const classifiedError = RunPodErrorHandler.classifyError(retryResult.error);
      
      this.logger.logError('RUNPOD_STATUS_CHECK_FAILED', {
        trainingId,
        errorCode: classifiedError.code,
        attempts: retryResult.attempts
      });

      const error = new Error(classifiedError.userMessage);
      (error as any).code = classifiedError.code;
      (error as any).actionableSteps = classifiedError.actionableSteps;
      throw error;
    }

    this.logger.logSuccess('RUNPOD_STATUS_RETRIEVED', {
      trainingId,
      status: retryResult.data.status,
      attempts: retryResult.attempts
    });

    return retryResult.data;
  }

  /**
   * Cancel training with retry logic
   */
  async cancelTraining(trainingId: string): Promise<void> {
    this.logger.logInfo('RUNPOD_CANCEL_TRAINING', { trainingId });

    const retryOptions: RetryOptions = {
      maxRetries: 2,
      baseDelay: 1000,
      maxDelay: 5000,
      retryCondition: (error: any) => {
        const classifiedError = RunPodErrorHandler.classifyError(error);
        return classifiedError.retryable && classifiedError.code !== 'AUTH_ERROR';
      }
    };

    const retryResult = await withRetry(async () => {
      return await this.makeCancelRequest(trainingId);
    }, retryOptions);

    if (!retryResult.success) {
      const classifiedError = RunPodErrorHandler.classifyError(retryResult.error);
      
      this.logger.logError('RUNPOD_CANCEL_FAILED', {
        trainingId,
        errorCode: classifiedError.code
      });

      const error = new Error(classifiedError.userMessage);
      (error as any).code = classifiedError.code;
      throw error;
    }

    this.logger.logSuccess('RUNPOD_TRAINING_CANCELLED', { trainingId });
  }

  /**
   * Check service health
   */
  async checkHealth(): Promise<boolean> {
    return await this.healthMonitor.checkHealth('runpod', async () => {
      try {
        const response = await fetch(`${this.endpoint}/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        return response.ok;
      } catch (error) {
        this.logger.logWarning('RUNPOD_HEALTH_CHECK_FAILED', { error: extractErrorDetails(error) });
        return false;
      }
    });
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      ...this.healthMonitor.getHealthStatus('runpod'),
      circuitBreaker: this.circuitBreaker.getState()
    };
  }

  /**
   * Make the actual training request
   */
  private async makeTrainingRequest(request: RunPodTrainingRequest): Promise<RunPodTrainingResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || data.detail || `HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).response = response;
        (error as any).data = data;
        throw error;
      }

      return data;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        const timeoutError = new Error('Request timeout - training service did not respond within 60 seconds');
        (timeoutError as any).code = 'TIMEOUT';
        throw timeoutError;
      }
      
      throw error;
    }
  }

  /**
   * Make status request
   */
  private async makeStatusRequest(trainingId: string): Promise<RunPodStatusResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(`${this.endpoint}/${trainingId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || data.detail || `HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).data = data;
        throw error;
      }

      return data;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        const timeoutError = new Error('Status check timeout');
        (timeoutError as any).code = 'TIMEOUT';
        throw timeoutError;
      }
      
      throw error;
    }
  }

  /**
   * Make cancel request
   */
  private async makeCancelRequest(trainingId: string): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch(`${this.endpoint}/${trainingId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.error || data.detail || `HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).data = data;
        throw error;
      }

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        const timeoutError = new Error('Cancel request timeout');
        (timeoutError as any).code = 'TIMEOUT';
        throw timeoutError;
      }
      
      throw error;
    }
  }
}

// Export singleton instance
export const runPodService = new RunPodTrainingService();