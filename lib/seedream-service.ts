import Replicate from 'replicate';

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

// Sleep utility for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry wrapper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  config = RETRY_CONFIG
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  let delay = config.initialDelay;

  for (let i = 0; i < config.maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      const isRetryable = isRetryableError(error);
      
      if (!isRetryable || i >= config.maxRetries - 1) {
        throw lastError;
      }

      // Wait before retrying
      await sleep(delay);
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }

  throw lastError;
}

// Check if error is retryable
function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as any;
  
  // Retry on rate limits (429)
  if (err.response?.status === 429) {
    return true;
  }

  // Retry on server errors (500, 502, 503, 504)
  if (err.response?.status >= 500 && err.response?.status < 600) {
    return true;
  }

  // Retry on network errors
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
    return true;
  }

  return false;
}

// Input interface for Seedream predictions
export interface SeedreamInput {
  image: string | string[]; // Reference image URLs
  prompt: string;
  negative_prompt?: string;
  num_outputs?: number;
  seed?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
}

// Prediction interface
export interface Prediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: string[] | null;
  error: string | null;
  metrics?: {
    predict_time?: number;
  };
}

// Seedream service class
export class SeedreamService {
  private readonly modelVersion = 'bytedance/seedream';

  /**
   * Create a new prediction with Seedream model
   */
  async createPrediction(
    input: SeedreamInput,
    webhookUrl?: string
  ): Promise<Prediction> {
    return withRetry(async () => {
      try {
        const options: any = {
          input: {
            image: input.image,
            prompt: input.prompt,
            negative_prompt: input.negative_prompt || '',
            num_outputs: input.num_outputs || 10,
            seed: input.seed,
            guidance_scale: input.guidance_scale || 7.5,
            num_inference_steps: input.num_inference_steps || 50,
          },
        };

        // Add webhook if provided
        if (webhookUrl) {
          options.webhook = webhookUrl;
          options.webhook_events_filter = ['completed'];
        }

        const prediction = await replicate.predictions.create({
          version: this.modelVersion,
          ...options,
        });

        return this.normalizePrediction(prediction);
      } catch (error) {
        throw this.handleError(error, 'createPrediction');
      }
    });
  }

  /**
   * Get prediction status by ID
   */
  async getPrediction(predictionId: string): Promise<Prediction> {
    return withRetry(async () => {
      try {
        const prediction = await replicate.predictions.get(predictionId);
        return this.normalizePrediction(prediction);
      } catch (error) {
        throw this.handleError(error, 'getPrediction');
      }
    });
  }

  /**
   * Cancel a running prediction
   */
  async cancelPrediction(predictionId: string): Promise<void> {
    return withRetry(async () => {
      try {
        await replicate.predictions.cancel(predictionId);
      } catch (error) {
        throw this.handleError(error, 'cancelPrediction');
      }
    });
  }

  /**
   * Normalize prediction response to our interface
   */
  private normalizePrediction(prediction: any): Prediction {
    return {
      id: prediction.id,
      status: prediction.status,
      output: prediction.output || null,
      error: prediction.error || null,
      metrics: prediction.metrics
        ? {
            predict_time: prediction.metrics.predict_time,
          }
        : undefined,
    };
  }

  /**
   * Handle and format errors
   */
  private handleError(error: unknown, method: string): Error {
    if (!error || typeof error !== 'object') {
      return new Error(`${method} failed: Unknown error`);
    }

    const err = error as any;

    // Handle rate limit errors
    if (err.response?.status === 429) {
      return new Error(
        `Rate limit exceeded. Please try again later. (${method})`
      );
    }

    // Handle server errors
    if (err.response?.status >= 500) {
      return new Error(
        `Replicate server error (${err.response.status}). Please try again. (${method})`
      );
    }

    // Handle authentication errors
    if (err.response?.status === 401) {
      return new Error(
        `Authentication failed. Please check REPLICATE_API_TOKEN. (${method})`
      );
    }

    // Handle not found errors
    if (err.response?.status === 404) {
      return new Error(`Resource not found. (${method})`);
    }

    // Return original error message if available
    if (err.message) {
      return new Error(`${method} failed: ${err.message}`);
    }

    return new Error(`${method} failed: Unknown error`);
  }
}

// Export singleton instance
export const seedreamService = new SeedreamService();
