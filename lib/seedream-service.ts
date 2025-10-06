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

// Input interface for Seedream-4 predictions
export interface SeedreamInput {
  image: string | string[]; // Reference image URLs (will be mapped to image_input)
  prompt: string;
  negative_prompt?: string; // Not used by Seedream-4, but kept for compatibility
  num_outputs?: number; // Will be mapped to max_images (max 4)
  seed?: number; // Not used by Seedream-4
  guidance_scale?: number; // Not used by Seedream-4
  num_inference_steps?: number; // Not used by Seedream-4
  size?: string; // Seedream-4 specific: "1K" or "2K"
  aspect_ratio?: string; // Seedream-4 specific: "1:1", "4:3", "16:9", etc.
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
  // NOTE: This is a placeholder model. Seedream by ByteDance may not be publicly available on Replicate.
  // You need to replace this with an actual working model version hash.
  // 
  // Options:
  // 1. Use a different headshot generation model like:
  //    - 'lucataco/flux-dev-lora' (for LoRA-based generation)
  //    - 'stability-ai/sdxl' (for SDXL-based generation)
  //    - Or any other portrait/headshot model on Replicate
  //
  // 2. Get the correct Seedream version hash if you have access
  //
  // To find available models, visit: https://replicate.com/explore
  private readonly modelVersion = process.env.SEEDREAM_MODEL_VERSION || 'bytedance/seedream:latest';

  /**
   * Create a new prediction with Seedream model
   */
  async createPrediction(
    input: SeedreamInput,
    webhookUrl?: string
  ): Promise<Prediction> {
    return withRetry(async () => {
      try {
        // Check if model version is configured
        if (!this.modelVersion || this.modelVersion === 'bytedance/seedream:latest') {
          throw new Error(
            'SEEDREAM_MODEL_VERSION environment variable is not configured. ' +
            'Please set it to a valid Replicate model version hash. ' +
            'Visit https://replicate.com/bytedance/seedream to get the correct version hash.'
          );
        }

        // Seedream-4 uses different parameter names than standard models
        // Map our generic parameters to Seedream-4's specific API
        const imageInput = Array.isArray(input.image) ? input.image : [input.image];
        const maxImages = Math.min(input.num_outputs || 4, 4); // Seedream-4 max is 4

        const options: any = {
          input: {
            image_input: imageInput, // Seedream-4 uses "image_input" not "image"
            prompt: input.prompt,
            max_images: maxImages, // Seedream-4 uses "max_images" not "num_outputs"
            size: input.size || '2K', // Seedream-4 specific: "1K" or "2K"
            aspect_ratio: input.aspect_ratio || '1:1', // Seedream-4 specific
            // Note: Seedream-4 doesn't support negative_prompt, seed, guidance_scale, or num_inference_steps
          },
        };

        // Add webhook if provided
        if (webhookUrl) {
          options.webhook = webhookUrl;
          options.webhook_events_filter = ['completed'];
        }

        // Log what we're sending to Replicate
        console.log('[SEEDREAM_SERVICE] Creating prediction with Seedream-4:', {
          model: this.modelVersion,
          imageCount: imageInput.length,
          imageUrls: imageInput,
          prompt: input.prompt,
          max_images: maxImages,
          size: options.input.size,
          aspect_ratio: options.input.aspect_ratio,
          note: 'Seedream-4 does not support negative_prompt, seed, or guidance parameters',
        });

        const prediction = await replicate.predictions.create({
          version: this.modelVersion,
          ...options,
        });

        console.log('[SEEDREAM_SERVICE] Prediction created:', {
          id: prediction.id,
          status: prediction.status,
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
