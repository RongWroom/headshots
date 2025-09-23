/**
 * Parameter Optimization Service
 * Integrates training parameter selection with A/B testing and quality assessment
 */

import { 
  OptimizedTrainingParams, 
  ParameterSet, 
  TrainingQualityMetrics,
  selectOptimalParameters,
  validateTrainingParameters,
  estimateTrainingCost,
  PARAMETER_SETS
} from './training-parameters';
import { ABTestingManager, ABTestConfig } from './ab-testing-framework';
import { OptimizedTrainingConfig, TrainingQualityAssessment } from '../types/training';

export interface ParameterOptimizationRequest {
  imageUrls: string[];
  packSlug?: string;
  userPreference?: 'speed' | 'quality' | 'balanced';
  userId: string;
  qualityPreset?: 'basic' | 'standard' | 'high' | 'premium';
  enableABTesting?: boolean;
}

export interface ParameterOptimizationResult {
  selectedParameters: OptimizedTrainingParams;
  parameterSet: ParameterSet;
  qualityAssessment: TrainingQualityAssessment;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  costEstimate: {
    estimatedMinutes: number;
    estimatedCost: number;
  };
  abTestInfo?: {
    testId: string;
    variantId: string;
    isTestParticipant: boolean;
  };
  recommendations: string[];
}

export class ParameterOptimizationService {
  private abTestManager: ABTestingManager;

  constructor() {
    this.abTestManager = new ABTestingManager();
    this.initializeDefaultTests();
  }

  /**
   * Optimize training parameters based on image analysis and user preferences
   */
  async optimizeParameters(request: ParameterOptimizationRequest): Promise<ParameterOptimizationResult> {
    // Step 1: Analyze image quality
    const qualityAssessment = await this.assessImageQuality(request.imageUrls);

    // Step 2: Check for A/B test participation
    let abTestInfo: ParameterOptimizationResult['abTestInfo'];
    let selectedParameters: OptimizedTrainingParams;
    let parameterSet: ParameterSet;

    if (request.enableABTesting) {
      const abTestResult = this.checkABTestParticipation(request.userId, qualityAssessment.imageCount);
      if (abTestResult) {
        abTestInfo = abTestResult;
        selectedParameters = abTestResult.parameters;
        parameterSet = {
          name: `A/B Test: ${abTestResult.variantName}`,
          description: `Testing variant: ${abTestResult.variantName}`,
          params: selectedParameters,
          recommendedFor: ['A/B Testing'],
          estimatedTime: this.estimateTime(selectedParameters),
          qualityLevel: this.determineQualityLevel(selectedParameters)
        };
      }
    }

    // Step 3: Select optimal parameters (if not in A/B test)
    if (!selectedParameters!) {
      if (request.qualityPreset) {
        parameterSet = this.getParameterSetByPreset(request.qualityPreset);
      } else {
        parameterSet = selectOptimalParameters(
          qualityAssessment.imageCount,
          {
            averageResolution: qualityAssessment.averageResolution,
            faceDetectionScore: qualityAssessment.faceDetectionScore,
            imageVariety: qualityAssessment.imageVariety,
            lightingQuality: qualityAssessment.lightingQuality
          },
          request.userPreference
        );
      }
      selectedParameters = parameterSet.params;
    }

    // Step 4: Apply pack-specific optimizations
    if (request.packSlug) {
      selectedParameters = this.applyPackOptimizations(selectedParameters, request.packSlug);
    }

    // Step 5: Validate parameters
    const validation = validateTrainingParameters(selectedParameters);

    // Step 6: Calculate cost estimate
    const costEstimate = estimateTrainingCost(selectedParameters);

    // Step 7: Generate recommendations
    const recommendations = this.generateRecommendations(
      qualityAssessment,
      selectedParameters,
      validation,
      request.packSlug
    );

    return {
      selectedParameters,
      parameterSet,
      qualityAssessment,
      validation,
      costEstimate,
      abTestInfo,
      recommendations
    };
  }

  /**
   * Assess image quality to inform parameter selection
   */
  private async assessImageQuality(imageUrls: string[]): Promise<TrainingQualityAssessment> {
    // In a real implementation, this would analyze actual images
    // For now, we'll simulate quality assessment
    
    const imageCount = imageUrls.length;
    
    // Simulate quality metrics based on image count and URL patterns
    const averageResolution = this.estimateResolutionFromUrls(imageUrls);
    const faceDetectionScore = Math.min(0.9, 0.6 + (imageCount * 0.05));
    const imageVariety = Math.min(1.0, imageCount / 10);
    const lightingQuality = 0.7 + Math.random() * 0.2; // Simulated
    
    const overallQuality = (
      (imageCount >= 8 ? 1.0 : imageCount / 8) * 0.3 +
      (averageResolution / 1024) * 0.25 +
      faceDetectionScore * 0.25 +
      imageVariety * 0.1 +
      lightingQuality * 0.1
    );

    // Determine recommended preset
    let recommendedPreset: string;
    if (overallQuality >= 0.8 && imageCount >= 8) {
      recommendedPreset = 'premium';
    } else if (overallQuality >= 0.6 && imageCount >= 6) {
      recommendedPreset = 'high';
    } else if (overallQuality >= 0.4 && imageCount >= 5) {
      recommendedPreset = 'standard';
    } else {
      recommendedPreset = 'basic';
    }

    // Estimate time and cost
    const baseTime = recommendedPreset === 'premium' ? 30 : 
                    recommendedPreset === 'high' ? 22 : 
                    recommendedPreset === 'standard' ? 18 : 12;
    const estimatedTime = `${baseTime-5}-${baseTime+5} minutes`;
    const estimatedCost = baseTime * 0.5 / 60; // $0.50/hour GPU cost

    return {
      imageCount,
      averageResolution,
      faceDetectionScore,
      imageVariety,
      lightingQuality,
      overallQuality,
      recommendedPreset,
      estimatedTime,
      estimatedCost: Math.round(estimatedCost * 100) / 100
    };
  }

  /**
   * Check if user should participate in A/B testing
   */
  private checkABTestParticipation(userId: string, imageCount: number): {
    testId: string;
    variantId: string;
    variantName: string;
    parameters: OptimizedTrainingParams;
    isTestParticipant: boolean;
  } | null {
    // Check active A/B tests
    const activeTests = ['lora-rank-comparison', 'learning-rate-optimization'];
    
    for (const testId of activeTests) {
      const variant = this.abTestManager.getVariantForUser(testId, userId, imageCount);
      if (variant) {
        return {
          testId,
          variantId: variant.id,
          variantName: variant.name,
          parameters: variant.parameters,
          isTestParticipant: true
        };
      }
    }

    return null;
  }

  /**
   * Get parameter set by quality preset
   */
  private getParameterSetByPreset(preset: string): ParameterSet {
    switch (preset) {
      case 'premium':
        return PARAMETER_SETS.premium_quality;
      case 'high':
        return PARAMETER_SETS.high_quality;
      case 'standard':
        return PARAMETER_SETS.standard_quality;
      case 'basic':
        return PARAMETER_SETS.basic_quality;
      default:
        return PARAMETER_SETS.high_quality;
    }
  }

  /**
   * Apply pack-specific parameter optimizations
   */
  private applyPackOptimizations(params: OptimizedTrainingParams, packSlug: string): OptimizedTrainingParams {
    const optimized = { ...params };

    switch (packSlug) {
      case 'actor-headshots':
        // Actor headshots need higher quality and detail preservation
        optimized.lora_rank = Math.max(optimized.lora_rank, 64);
        optimized.max_train_steps = Math.max(optimized.max_train_steps, 1500);
        optimized.learning_rate = Math.min(optimized.learning_rate, 8e-5); // More conservative
        break;

      case 'corporate-headshots':
        // Corporate headshots prioritize consistency and professional look
        optimized.resolution = 1024;
        optimized.scheduler_type = 'cosine'; // Better for consistent results
        break;

      case 'creative-headshots':
        // Creative headshots can use more aggressive parameters for artistic effects
        optimized.learning_rate = Math.max(optimized.learning_rate, 1e-4);
        optimized.lora_rank = Math.min(optimized.lora_rank, 64); // Prevent over-fitting to style
        break;
    }

    return optimized;
  }

  /**
   * Generate parameter recommendations based on analysis
   */
  private generateRecommendations(
    quality: TrainingQualityAssessment,
    parameters: OptimizedTrainingParams,
    validation: { errors: string[]; warnings: string[] },
    packSlug?: string
  ): string[] {
    const recommendations: string[] = [];

    // Image quality recommendations
    if (quality.imageCount < 8) {
      recommendations.push(`Consider uploading ${8 - quality.imageCount} more images for better results`);
    }

    if (quality.averageResolution < 512) {
      recommendations.push('Higher resolution images (1024x1024 or larger) will improve training quality');
    }

    if (quality.faceDetectionScore < 0.7) {
      recommendations.push('Ensure all images clearly show your face for better likeness preservation');
    }

    if (quality.imageVariety < 0.5) {
      recommendations.push('Include more variety in poses, expressions, and lighting for better results');
    }

    // Parameter recommendations
    if (parameters.lora_rank < 32 && quality.overallQuality > 0.7) {
      recommendations.push('Consider using a higher LoRA rank for better detail preservation with your high-quality images');
    }

    if (parameters.max_train_steps < 1000 && quality.imageCount >= 8) {
      recommendations.push('More training steps could improve results with your image set');
    }

    // Pack-specific recommendations
    if (packSlug === 'actor-headshots' && parameters.lora_rank < 64) {
      recommendations.push('Actor headshots benefit from higher LoRA rank for better facial detail preservation');
    }

    // Validation warnings as recommendations
    validation.warnings.forEach(warning => {
      recommendations.push(`Parameter warning: ${warning}`);
    });

    // Cost optimization recommendations
    if (quality.estimatedCost > 0.50) {
      recommendations.push('Consider using a lower quality preset to reduce training costs');
    }

    return recommendations;
  }

  /**
   * Initialize default A/B tests
   */
  private initializeDefaultTests(): void {
    const defaultTests = ABTestingManager.getPredefinedTests();
    defaultTests.forEach(test => {
      try {
        this.abTestManager.createTest(test);
      } catch (error) {
        console.warn(`Failed to initialize A/B test ${test.testId}:`, error);
      }
    });
  }

  /**
   * Estimate resolution from image URLs (simplified)
   */
  private estimateResolutionFromUrls(urls: string[]): number {
    // In a real implementation, this would analyze actual images
    // For now, assume good quality based on URL patterns
    return 1024; // Default assumption
  }

  /**
   * Estimate training time based on parameters
   */
  private estimateTime(params: OptimizedTrainingParams): string {
    const baseTime = 12; // More realistic base time
    const resolutionMultiplier = params.resolution === 1024 ? 1.3 : 
                                params.resolution === 768 ? 1.1 : 1.0;
    const stepsMultiplier = params.max_train_steps / 1500;
    const rankMultiplier = Math.sqrt(params.lora_rank / 64); // Use square root for more realistic scaling
    
    const estimatedMinutes = Math.round(baseTime * resolutionMultiplier * stepsMultiplier * rankMultiplier);
    return `${estimatedMinutes - 2}-${estimatedMinutes + 3} minutes`;
  }

  /**
   * Determine quality level from parameters
   */
  private determineQualityLevel(params: OptimizedTrainingParams): 'basic' | 'standard' | 'high' | 'premium' {
    if (params.lora_rank >= 128 && params.max_train_steps >= 2000) {
      return 'premium';
    } else if (params.lora_rank >= 64 && params.max_train_steps >= 1500) {
      return 'high';
    } else if (params.lora_rank >= 32 && params.max_train_steps >= 1000) {
      return 'standard';
    } else {
      return 'basic';
    }
  }
}