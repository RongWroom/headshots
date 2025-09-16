/**
 * Training input validation utilities
 * Validates training requests and input formats for different AI models
 */

export interface TrainingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  inputFormat: 'individual_urls' | 'zip_file' | 'unknown';
  imageCount: number;
  estimatedTrainingTime?: string;
  estimatedCost?: string;
}

export interface TrainingInputValidationOptions {
  minImages?: number;
  maxImages?: number;
  allowedFormats?: string[];
  maxFileSize?: number; // in bytes
  requireAccessibilityCheck?: boolean;
}

/**
 * Validates training input format for FLUX models
 */
export async function validateFluxTrainingInput(
  imageUrls: string[],
  modelName: string,
  trainingConfig: any,
  options: TrainingInputValidationOptions = {}
): Promise<TrainingValidationResult> {
  const result: TrainingValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    recommendations: [],
    inputFormat: 'individual_urls',
    imageCount: imageUrls.length
  };

  const {
    minImages = 5,
    maxImages = 100,
    allowedFormats = ['jpg', 'jpeg', 'png', 'webp'],
    maxFileSize = 10 * 1024 * 1024, // 10MB
    requireAccessibilityCheck = true
  } = options;

  // Validate image count
  if (imageUrls.length < minImages) {
    result.errors.push(`Minimum ${minImages} images required, got ${imageUrls.length}`);
    result.isValid = false;
  }

  if (imageUrls.length > maxImages) {
    result.errors.push(`Maximum ${maxImages} images allowed, got ${imageUrls.length}`);
    result.isValid = false;
  }

  // Validate image URLs format
  const invalidUrls = imageUrls.filter(url => {
    try {
      new URL(url);
      return false;
    } catch {
      return true;
    }
  });

  if (invalidUrls.length > 0) {
    result.errors.push(`${invalidUrls.length} invalid URLs found`);
    result.isValid = false;
  }

  // Check image formats
  const unsupportedFormats = imageUrls.filter(url => {
    const extension = url.split('.').pop()?.toLowerCase();
    return extension && !allowedFormats.includes(extension);
  });

  if (unsupportedFormats.length > 0) {
    result.warnings.push(`${unsupportedFormats.length} images may have unsupported formats`);
  }

  // Validate model name
  if (!modelName || modelName.length < 3) {
    result.errors.push('Model name must be at least 3 characters long');
    result.isValid = false;
  }

  if (!/^[a-zA-Z0-9-_]+$/.test(modelName)) {
    result.errors.push('Model name can only contain letters, numbers, hyphens, and underscores');
    result.isValid = false;
  }

  // Validate training config
  if (trainingConfig?.trigger_word && trainingConfig.trigger_word.length < 2) {
    result.errors.push('Trigger word must be at least 2 characters long');
    result.isValid = false;
  }

  // Add recommendations
  if (imageUrls.length < 10) {
    result.recommendations.push('Consider using 10-20 images for better training results');
  }

  if (imageUrls.length > 50) {
    result.recommendations.push('Large datasets may take longer to train and cost more');
  }

  // Estimate training time and cost (rough estimates)
  if (result.isValid) {
    const baseTime = 10; // minutes
    const timePerImage = 0.5; // minutes per image
    const estimatedMinutes = baseTime + (imageUrls.length * timePerImage);
    result.estimatedTrainingTime = `${Math.round(estimatedMinutes)} minutes`;

    const baseCost = 2; // USD
    const costPerImage = 0.05; // USD per image
    const estimatedCost = baseCost + (imageUrls.length * costPerImage);
    result.estimatedCost = `$${estimatedCost.toFixed(2)}`;
  }

  return result;
}

/**
 * Validates that images are accessible via HTTP
 */
export async function validateImageAccessibility(
  imageUrls: string[],
  maxConcurrent: number = 5
): Promise<{
  accessible: string[];
  inaccessible: { url: string; error: string }[];
  totalChecked: number;
}> {
  const results = {
    accessible: [] as string[],
    inaccessible: [] as { url: string; error: string }[],
    totalChecked: 0
  };

  // Check images in batches to avoid overwhelming the server
  for (let i = 0; i < imageUrls.length; i += maxConcurrent) {
    const batch = imageUrls.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(async (url) => {
      try {
        const response = await fetch(url, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        if (response.ok) {
          results.accessible.push(url);
        } else {
          results.inaccessible.push({
            url,
            error: `HTTP ${response.status}: ${response.statusText}`
          });
        }
      } catch (error) {
        results.inaccessible.push({
          url,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      results.totalChecked++;
    });

    await Promise.all(batchPromises);
  }

  return results;
}

/**
 * Validates training model configuration
 */
export function validateTrainingModelConfig(
  modelOwner: string,
  modelName: string,
  modelVersion: string
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  modelType: 'inference' | 'training' | 'unknown';
} {
  const result = {
    isValid: true,
    errors: [] as string[],
    warnings: [] as string[],
    modelType: 'unknown' as 'inference' | 'training' | 'unknown'
  };

  // Check for known inference models that are commonly mistaken for training models
  const knownInferenceModels = [
    'replicate/fast-flux-trainer',
    'black-forest-labs/flux-dev-lora',
    'ostris/flux-dev-lora-trainer'
  ];

  const fullModelName = `${modelOwner}/${modelName}`;
  
  if (knownInferenceModels.includes(fullModelName)) {
    result.modelType = 'inference';
    result.errors.push(`${fullModelName} is an inference model, not a training model`);
    result.isValid = false;
    
    if (fullModelName === 'replicate/fast-flux-trainer') {
      result.warnings.push('fast-flux-trainer expects pre-trained weights and text prompts, not training images');
    }
  }

  // Check model version format
  if (!modelVersion || modelVersion.length < 10) {
    result.errors.push('Model version must be a valid version ID');
    result.isValid = false;
  }

  return result;
}

/**
 * Gets recommended training parameters for different model types
 */
export function getRecommendedTrainingParams(
  modelType: string,
  imageCount: number,
  trainingGoal: 'style' | 'subject' | 'concept'
): {
  training_steps: number;
  learning_rate: number;
  batch_size: number;
  resolution: number;
  lora_rank: number;
  recommendations: string[];
} {
  const baseParams = {
    training_steps: 1000,
    learning_rate: 1e-4,
    batch_size: 1,
    resolution: 1024,
    lora_rank: 16,
    recommendations: [] as string[]
  };

  // Adjust based on image count
  if (imageCount < 10) {
    baseParams.training_steps = 800;
    baseParams.learning_rate = 5e-5;
    baseParams.recommendations.push('Reduced training steps due to small dataset');
  } else if (imageCount > 50) {
    baseParams.training_steps = 1500;
    baseParams.learning_rate = 2e-4;
    baseParams.recommendations.push('Increased training steps for larger dataset');
  }

  // Adjust based on training goal
  if (trainingGoal === 'style') {
    baseParams.lora_rank = 32;
    baseParams.learning_rate *= 0.8;
    baseParams.recommendations.push('Higher LoRA rank for style training');
  } else if (trainingGoal === 'subject') {
    baseParams.lora_rank = 16;
    baseParams.recommendations.push('Standard LoRA rank for subject training');
  }

  return baseParams;
}