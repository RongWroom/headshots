/**
 * Integration utilities for training data validation and preprocessing
 * Connects the training data processor with existing training workflows
 */

import { TrainingDataProcessor, TrainingDataValidationResult, ProcessingOptions } from './training-data-processor';
import { validateImageFiles, checkMultipleImageAccessibility } from './image-validation';

export interface TrainingDataPreparationResult {
  isReady: boolean;
  validationResult: TrainingDataValidationResult;
  processedImageUrls: string[];
  optimizedParameters: {
    recommendedSteps: number;
    recommendedLearningRate: number;
    recommendedBatchSize: number;
    qualityBoost: boolean;
  };
  estimatedTrainingTime: number;
  estimatedCost: number;
  warnings: string[];
  errors: string[];
}

export class TrainingDataIntegration {
  private processor: TrainingDataProcessor;

  constructor(tempDir?: string) {
    this.processor = new TrainingDataProcessor(tempDir);
  }

  /**
   * Prepare training data with comprehensive validation and optimization
   */
  async prepareTrainingData(
    imageUrls: string[],
    options: Partial<ProcessingOptions> = {}
  ): Promise<TrainingDataPreparationResult> {
    const result: TrainingDataPreparationResult = {
      isReady: false,
      validationResult: {
        isValid: false,
        totalImages: imageUrls.length,
        validImages: 0,
        processedImages: [],
        duplicatesRemoved: 0,
        lowQualityRemoved: 0,
        noFaceRemoved: 0,
        overallQualityScore: 0,
        recommendations: [],
        errors: [],
        warnings: []
      },
      processedImageUrls: [],
      optimizedParameters: {
        recommendedSteps: 1000,
        recommendedLearningRate: 1e-4,
        recommendedBatchSize: 1,
        qualityBoost: false
      },
      estimatedTrainingTime: 0,
      estimatedCost: 0,
      warnings: [],
      errors: []
    };

    try {
      // Step 1: Basic URL accessibility check
      console.log('🔍 Checking image accessibility...');
      const accessibilityResult = await checkMultipleImageAccessibility(imageUrls);
      
      if (accessibilityResult.inaccessible.length > 0) {
        result.warnings.push(
          `${accessibilityResult.inaccessible.length} images are not accessible and will be skipped`
        );
      }

      const accessibleUrls = accessibilityResult.accessible;
      if (accessibleUrls.length === 0) {
        result.errors.push('No accessible images found');
        return result;
      }

      // Step 2: Process training data with validation
      console.log('🚀 Processing training data...');
      const validationResult = await this.processor.processTrainingData(accessibleUrls, options);
      result.validationResult = validationResult;

      // Step 3: Check if we have enough valid images
      if (!validationResult.isValid) {
        result.errors.push('Training data validation failed');
        result.errors.push(...validationResult.errors);
        return result;
      }

      // Step 4: Extract processed image URLs
      result.processedImageUrls = validationResult.processedImages
        .filter(img => img.isValid && img.processedImagePath)
        .map(img => img.processedImagePath!);

      // Step 5: Optimize training parameters based on data quality
      result.optimizedParameters = this.optimizeTrainingParameters(validationResult);

      // Step 6: Estimate training time and cost
      const estimates = this.estimateTrainingMetrics(
        result.processedImageUrls.length,
        result.optimizedParameters,
        validationResult.overallQualityScore
      );
      result.estimatedTrainingTime = estimates.time;
      result.estimatedCost = estimates.cost;

      // Step 7: Final validation
      result.isReady = result.processedImageUrls.length >= 8;
      
      if (!result.isReady) {
        result.errors.push(
          `Insufficient valid images: ${result.processedImageUrls.length}/8 minimum required`
        );
      }

      // Step 8: Collect warnings and recommendations
      result.warnings.push(...validationResult.warnings);
      result.warnings.push(...validationResult.recommendations);

    } catch (error) {
      result.errors.push(`Training data preparation failed: ${error}`);
    }

    return result;
  }

  /**
   * Optimize training parameters based on data quality
   */
  private optimizeTrainingParameters(
    validationResult: TrainingDataValidationResult
  ): TrainingDataPreparationResult['optimizedParameters'] {
    const imageCount = validationResult.validImages;
    const qualityScore = validationResult.overallQualityScore;
    const avgFacesDetected = validationResult.processedImages.reduce(
      (sum, img) => sum + img.faceDetection.facesDetected, 0
    ) / validationResult.processedImages.length;

    // Base parameters
    let recommendedSteps = 1000;
    let recommendedLearningRate = 1e-4;
    let recommendedBatchSize = 1;
    let qualityBoost = false;

    // Adjust based on image count
    if (imageCount >= 15) {
      recommendedSteps = 1500;
      recommendedBatchSize = 2;
    } else if (imageCount >= 20) {
      recommendedSteps = 2000;
      recommendedBatchSize = 2;
    }

    // Adjust based on quality score
    if (qualityScore < 0.7) {
      // Lower quality images need more training steps
      recommendedSteps = Math.floor(recommendedSteps * 1.3);
      recommendedLearningRate = 8e-5; // Slightly lower learning rate
      qualityBoost = true;
    } else if (qualityScore > 0.9) {
      // High quality images can train faster
      recommendedSteps = Math.floor(recommendedSteps * 0.8);
      recommendedLearningRate = 1.2e-4; // Slightly higher learning rate
    }

    // Adjust for face detection quality
    if (avgFacesDetected > 1.2) {
      // Multiple faces detected, need more careful training
      recommendedLearningRate *= 0.8;
      recommendedSteps = Math.floor(recommendedSteps * 1.2);
    }

    return {
      recommendedSteps,
      recommendedLearningRate,
      recommendedBatchSize,
      qualityBoost
    };
  }

  /**
   * Estimate training time and cost
   */
  private estimateTrainingMetrics(
    imageCount: number,
    parameters: TrainingDataPreparationResult['optimizedParameters'],
    qualityScore: number
  ): { time: number; cost: number } {
    // Base time estimation (in minutes)
    const baseTimePerStep = 0.02; // 20ms per step
    const setupTime = 3; // 3 minutes setup
    const processingTime = imageCount * 0.5; // 30 seconds per image processing
    
    const trainingTime = (parameters.recommendedSteps * baseTimePerStep) / 60; // Convert to minutes
    const totalTime = setupTime + processingTime + trainingTime;

    // Adjust for quality boost
    const adjustedTime = parameters.qualityBoost ? totalTime * 1.2 : totalTime;

    // Cost estimation (assuming $0.50/hour GPU cost)
    const costPerMinute = 0.50 / 60;
    const estimatedCost = adjustedTime * costPerMinute;

    return {
      time: Math.ceil(adjustedTime),
      cost: Math.round(estimatedCost * 100) / 100
    };
  }

  /**
   * Generate training configuration for RunPod/Replicate
   */
  generateTrainingConfig(
    preparationResult: TrainingDataPreparationResult,
    modelName: string,
    triggerWord: string
  ): {
    runpod: any;
    replicate: any;
  } {
    const { optimizedParameters } = preparationResult;

    const runpodConfig = {
      input: {
        image_urls: preparationResult.processedImageUrls,
        model_name: modelName,
        trigger_word: triggerWord,
        training_config: {
          resolution: 1024,
          max_train_steps: optimizedParameters.recommendedSteps,
          learning_rate: optimizedParameters.recommendedLearningRate,
          train_batch_size: optimizedParameters.recommendedBatchSize,
          lora_rank: 64,
          mixed_precision: 'fp16',
          use_xformers: true,
          gradient_accumulation_steps: optimizedParameters.recommendedBatchSize > 1 ? 2 : 1,
          quality_boost: optimizedParameters.qualityBoost
        }
      }
    };

    const replicateConfig = {
      input: {
        input_images: preparationResult.processedImageUrls.join(','),
        trigger_word: triggerWord,
        max_train_steps: optimizedParameters.recommendedSteps,
        learning_rate: optimizedParameters.recommendedLearningRate,
        batch_size: optimizedParameters.recommendedBatchSize,
        resolution: 1024,
        lora_rank: 64
      }
    };

    return {
      runpod: runpodConfig,
      replicate: replicateConfig
    };
  }

  /**
   * Validate training readiness
   */
  async validateTrainingReadiness(imageUrls: string[]): Promise<{
    isReady: boolean;
    issues: string[];
    recommendations: string[];
    estimatedQuality: number;
  }> {
    const result = {
      isReady: false,
      issues: [] as string[],
      recommendations: [] as string[],
      estimatedQuality: 0
    };

    try {
      // Quick validation without full processing
      const accessibilityResult = await checkMultipleImageAccessibility(imageUrls, 3);
      
      if (accessibilityResult.accessible.length < 8) {
        result.issues.push(`Insufficient accessible images: ${accessibilityResult.accessible.length}/8 required`);
      }

      if (accessibilityResult.inaccessible.length > imageUrls.length * 0.3) {
        result.issues.push(`Too many inaccessible images: ${accessibilityResult.inaccessible.length}/${imageUrls.length}`);
      }

      // Estimate quality based on URL patterns and accessibility
      const qualityIndicators = accessibilityResult.accessible.filter(url => {
        // Look for quality indicators in URLs
        return url.includes('high') || url.includes('quality') || url.includes('hd') || 
               url.match(/\d{3,4}x\d{3,4}/) || // Resolution in URL
               url.includes('.jpg') || url.includes('.jpeg'); // Preferred formats
      });

      result.estimatedQuality = qualityIndicators.length / accessibilityResult.accessible.length;
      result.isReady = result.issues.length === 0;

      // Generate recommendations
      if (result.estimatedQuality < 0.7) {
        result.recommendations.push('Consider using higher resolution images for better results');
      }

      if (accessibilityResult.accessible.length < 12) {
        result.recommendations.push('Upload more images (12-20) for optimal training results');
      }

    } catch (error) {
      result.issues.push(`Validation failed: ${error}`);
    }

    return result;
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats() {
    return await this.processor.getProcessingStats();
  }
}

// Export singleton instance
export const trainingDataIntegration = new TrainingDataIntegration();