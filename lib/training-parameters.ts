/**
 * Optimized FLUX LoRA training parameters based on research and best practices
 * Implements automatic parameter optimization based on image count and quality
 */

export interface OptimizedTrainingParams {
  resolution: number;
  learning_rate: number;
  max_train_steps: number;
  lora_rank: number;
  lora_alpha: number;
  train_batch_size: number;
  gradient_accumulation_steps: number;
  mixed_precision: 'fp16' | 'bf16';
  use_8bit_adam: boolean;
  enable_xformers: boolean;
  save_steps: number;
  warmup_steps: number;
  scheduler_type: 'cosine' | 'linear' | 'polynomial';
  weight_decay: number;
  max_grad_norm: number;
}

export interface TrainingQualityMetrics {
  imageCount: number;
  averageResolution: number;
  faceDetectionScore: number;
  imageVariety: number;
  lightingQuality: number;
}

export interface ParameterSet {
  name: string;
  description: string;
  params: OptimizedTrainingParams;
  recommendedFor: string[];
  estimatedTime: string;
  qualityLevel: 'basic' | 'standard' | 'high' | 'premium';
}

/**
 * Research-based optimal parameter sets for different scenarios
 */
export const PARAMETER_SETS: Record<string, ParameterSet> = {
  // High-quality training for professional headshots (8-15 images)
  premium_quality: {
    name: 'Premium Quality',
    description: 'Maximum quality training for professional headshots with excellent source images',
    params: {
      resolution: 1024,
      learning_rate: 8e-5, // Slightly lower for better convergence
      max_train_steps: 2000, // More steps for better likeness
      lora_rank: 128, // Higher rank for better detail preservation
      lora_alpha: 128,
      train_batch_size: 1,
      gradient_accumulation_steps: 8, // Higher accumulation for stability
      mixed_precision: 'bf16',
      use_8bit_adam: true,
      enable_xformers: true,
      save_steps: 500,
      warmup_steps: 200,
      scheduler_type: 'cosine',
      weight_decay: 0.01,
      max_grad_norm: 1.0
    },
    recommendedFor: ['8-15 high-quality images', 'Professional headshots', 'Actor portfolios'],
    estimatedTime: '25-35 minutes',
    qualityLevel: 'premium'
  },

  // Standard quality for good source images (6-12 images)
  high_quality: {
    name: 'High Quality',
    description: 'Balanced training for good quality source images',
    params: {
      resolution: 1024,
      learning_rate: 1e-4,
      max_train_steps: 1500,
      lora_rank: 64,
      lora_alpha: 64,
      train_batch_size: 1,
      gradient_accumulation_steps: 4,
      mixed_precision: 'bf16',
      use_8bit_adam: true,
      enable_xformers: true,
      save_steps: 500,
      warmup_steps: 150,
      scheduler_type: 'cosine',
      weight_decay: 0.01,
      max_grad_norm: 1.0
    },
    recommendedFor: ['6-12 good quality images', 'Corporate headshots', 'Standard portraits'],
    estimatedTime: '20-25 minutes',
    qualityLevel: 'high'
  },

  // Standard training for average source images (5-10 images)
  standard_quality: {
    name: 'Standard Quality',
    description: 'Reliable training for average quality source images',
    params: {
      resolution: 768,
      learning_rate: 1.2e-4,
      max_train_steps: 1200,
      lora_rank: 32,
      lora_alpha: 32,
      train_batch_size: 1,
      gradient_accumulation_steps: 2,
      mixed_precision: 'fp16',
      use_8bit_adam: true,
      enable_xformers: true,
      save_steps: 400,
      warmup_steps: 100,
      scheduler_type: 'cosine',
      weight_decay: 0.005,
      max_grad_norm: 1.0
    },
    recommendedFor: ['5-10 average quality images', 'Quick training', 'Budget-conscious users'],
    estimatedTime: '15-20 minutes',
    qualityLevel: 'standard'
  },

  // Fast training for testing or low-quality images (4-8 images)
  basic_quality: {
    name: 'Basic Quality',
    description: 'Fast training for testing or lower quality source images',
    params: {
      resolution: 512,
      learning_rate: 1.5e-4,
      max_train_steps: 800,
      lora_rank: 16,
      lora_alpha: 16,
      train_batch_size: 1,
      gradient_accumulation_steps: 1,
      mixed_precision: 'fp16',
      use_8bit_adam: false,
      enable_xformers: true,
      save_steps: 200,
      warmup_steps: 50,
      scheduler_type: 'linear',
      weight_decay: 0.001,
      max_grad_norm: 0.5
    },
    recommendedFor: ['4-8 basic quality images', 'Testing', 'Quick prototypes'],
    estimatedTime: '10-15 minutes',
    qualityLevel: 'basic'
  }
};

/**
 * Automatically select optimal parameters based on training data quality
 */
export function selectOptimalParameters(
  imageCount: number,
  qualityMetrics?: Partial<TrainingQualityMetrics>,
  userPreference?: 'speed' | 'quality' | 'balanced'
): ParameterSet {
  // Calculate quality score with more balanced weighting
  const baseScore = Math.min(imageCount / 12, 1.0); // Normalize to 12 images for premium
  const resolutionScore = qualityMetrics?.averageResolution ? 
    Math.min(qualityMetrics.averageResolution / 1024, 1.0) : 0.7;
  const faceScore = qualityMetrics?.faceDetectionScore || 0.8;
  const varietyScore = qualityMetrics?.imageVariety || 0.7;
  const lightingScore = qualityMetrics?.lightingQuality || 0.7;
  
  // Weight image count more heavily for quality assessment
  const overallQuality = (baseScore * 0.4 + resolutionScore * 0.2 + faceScore * 0.2 + varietyScore * 0.1 + lightingScore * 0.1);

  // Apply user preference modifier
  let qualityThreshold = overallQuality;
  if (userPreference === 'speed') {
    qualityThreshold -= 0.15;
  } else if (userPreference === 'quality') {
    qualityThreshold += 0.05;
  }

  // Select parameter set based on quality and image count with stricter thresholds
  if (qualityThreshold >= 0.75 && imageCount >= 8) {
    return PARAMETER_SETS.premium_quality;
  } else if (qualityThreshold >= 0.55 && imageCount >= 6) {
    return PARAMETER_SETS.high_quality;
  } else if (qualityThreshold >= 0.35 && imageCount >= 5) {
    return PARAMETER_SETS.standard_quality;
  } else {
    return PARAMETER_SETS.basic_quality;
  }
}

/**
 * Validate training parameters against known constraints
 */
export function validateTrainingParameters(params: Partial<OptimizedTrainingParams>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Resolution validation
  if (params.resolution && ![512, 768, 1024].includes(params.resolution)) {
    errors.push('Resolution must be 512, 768, or 1024');
  }

  // Learning rate validation
  if (params.learning_rate) {
    if (params.learning_rate < 1e-6 || params.learning_rate > 1e-3) {
      errors.push('Learning rate must be between 1e-6 and 1e-3');
    }
    if (params.learning_rate > 2e-4) {
      warnings.push('High learning rate may cause training instability');
    }
  }

  // Training steps validation
  if (params.max_train_steps) {
    if (params.max_train_steps < 100 || params.max_train_steps > 5000) {
      errors.push('Training steps must be between 100 and 5000');
    }
    if (params.max_train_steps > 3000) {
      warnings.push('Very high step count may lead to overfitting');
    }
  }

  // LoRA rank validation
  if (params.lora_rank) {
    if (![8, 16, 32, 64, 128, 256].includes(params.lora_rank)) {
      errors.push('LoRA rank must be one of: 8, 16, 32, 64, 128, 256');
    }
    if (params.lora_rank > 128) {
      warnings.push('Very high LoRA rank increases training time and memory usage');
    }
  }

  // Batch size and accumulation validation
  if (params.train_batch_size && params.gradient_accumulation_steps) {
    const effectiveBatchSize = params.train_batch_size * params.gradient_accumulation_steps;
    if (effectiveBatchSize > 16) {
      warnings.push('Large effective batch size may reduce training quality for small datasets');
    }
  }

  // Mixed precision validation
  if (params.mixed_precision && !['fp16', 'bf16'].includes(params.mixed_precision)) {
    errors.push('Mixed precision must be "fp16" or "bf16"');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Calculate estimated training cost based on parameters
 */
export function estimateTrainingCost(params: OptimizedTrainingParams, gpuHourlyRate: number = 0.50): {
  estimatedMinutes: number;
  estimatedCost: number;
  breakdown: {
    baseTime: number;
    resolutionMultiplier: number;
    stepsMultiplier: number;
    rankMultiplier: number;
  };
} {
  // Base time calculation (minutes) - more realistic
  const baseTime = 12;
  
  // Resolution multiplier - less aggressive scaling
  const resolutionMultiplier = params.resolution === 1024 ? 1.3 : 
                              params.resolution === 768 ? 1.1 : 1.0;
  
  // Steps multiplier - normalized to 1500 steps as baseline
  const stepsMultiplier = params.max_train_steps / 1500;
  
  // LoRA rank multiplier - use square root for more realistic scaling
  const rankMultiplier = Math.sqrt(params.lora_rank / 64);
  
  const estimatedMinutes = baseTime * resolutionMultiplier * stepsMultiplier * rankMultiplier;
  const estimatedCost = (estimatedMinutes / 60) * gpuHourlyRate;

  return {
    estimatedMinutes: Math.round(estimatedMinutes),
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    breakdown: {
      baseTime,
      resolutionMultiplier,
      stepsMultiplier,
      rankMultiplier
    }
  };
}

/**
 * Generate parameter recommendations based on use case
 */
export function getParameterRecommendations(useCase: string): ParameterSet[] {
  const recommendations: ParameterSet[] = [];
  
  switch (useCase.toLowerCase()) {
    case 'actor-headshots':
    case 'professional':
      recommendations.push(PARAMETER_SETS.premium_quality, PARAMETER_SETS.high_quality);
      break;
    case 'corporate-headshots':
    case 'business':
      recommendations.push(PARAMETER_SETS.high_quality, PARAMETER_SETS.standard_quality);
      break;
    case 'personal':
    case 'casual':
      recommendations.push(PARAMETER_SETS.standard_quality, PARAMETER_SETS.basic_quality);
      break;
    case 'testing':
    case 'prototype':
      recommendations.push(PARAMETER_SETS.basic_quality);
      break;
    default:
      recommendations.push(PARAMETER_SETS.high_quality, PARAMETER_SETS.standard_quality);
  }
  
  return recommendations;
}