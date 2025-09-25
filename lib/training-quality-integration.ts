import { QualityAssessmentService, QualityAssessmentResult } from './quality-assessment';
import { QualityMonitoringService } from './quality-monitoring';

export interface TrainingQualityConfig {
  enableQualityAssessment: boolean;
  enableQualityMonitoring: boolean;
  autoRetrainOnLowQuality: boolean;
  qualityThresholds: {
    clipSimilarityMin: number;
    faceRecognitionMin: number;
    overallQualityMin: number;
  };
}

export const DEFAULT_TRAINING_QUALITY_CONFIG: TrainingQualityConfig = {
  enableQualityAssessment: true,
  enableQualityMonitoring: true,
  autoRetrainOnLowQuality: false, // Manual approval required for retraining
  qualityThresholds: {
    clipSimilarityMin: 0.85,
    faceRecognitionMin: 0.85,
    overallQualityMin: 0.85,
  },
};

export class TrainingQualityIntegration {
  private qualityService: QualityAssessmentService;
  private monitoringService: QualityMonitoringService;

  constructor() {
    this.qualityService = new QualityAssessmentService();
    this.monitoringService = new QualityMonitoringService();
  }

  /**
   * Assess quality after training completion and trigger monitoring
   */
  async assessTrainingCompletion(
    modelId: string,
    generatedImageUrl: string,
    originalImageUrls: string[],
    config: TrainingQualityConfig = DEFAULT_TRAINING_QUALITY_CONFIG
  ): Promise<{
    qualityResult: QualityAssessmentResult | null;
    monitoringAlerts: any[];
    retrainingRecommended: boolean;
    actions: string[];
  }> {
    const actions: string[] = [];
    let qualityResult: QualityAssessmentResult | null = null;
    let monitoringAlerts: any[] = [];
    let retrainingRecommended = false;

    try {
      // Step 1: Assess quality if enabled
      if (config.enableQualityAssessment) {
        qualityResult = await this.qualityService.assessTrainingQuality(
          modelId,
          generatedImageUrl,
          originalImageUrls,
          config.qualityThresholds
        );

        actions.push('Quality assessment completed');

        // Check if quality passes thresholds
        if (!qualityResult.passesThreshold) {
          actions.push('Quality below threshold detected');
          retrainingRecommended = true;
        }

        // Check if retraining is needed
        if (qualityResult.needsRetraining) {
          actions.push('Automatic retraining recommendation generated');
          retrainingRecommended = true;
        }
      }

      // Step 2: Run quality monitoring if enabled
      if (config.enableQualityMonitoring) {
        monitoringAlerts = await this.monitoringService.monitorModelQuality(modelId);
        
        if (monitoringAlerts.length > 0) {
          actions.push(`${monitoringAlerts.length} quality alerts generated`);
        }

        // Check for high-severity alerts that recommend retraining
        const highSeverityAlerts = monitoringAlerts.filter(
          alert => alert.severity === 'high' && alert.alertType === 'retraining_needed'
        );

        if (highSeverityAlerts.length > 0) {
          retrainingRecommended = true;
          actions.push('High-severity retraining alerts detected');
        }
      }

      // Step 3: Handle automatic retraining if enabled
      if (config.autoRetrainOnLowQuality && retrainingRecommended) {
        // In a real implementation, this would trigger the retraining pipeline
        actions.push('Automatic retraining would be triggered (disabled in current config)');
      }

      return {
        qualityResult,
        monitoringAlerts,
        retrainingRecommended,
        actions,
      };
    } catch (error) {
      console.error('Training quality integration failed:', error);
      actions.push(`Error during quality integration: ${error.message}`);
      
      return {
        qualityResult: null,
        monitoringAlerts: [],
        retrainingRecommended: false,
        actions,
      };
    }
  }

  /**
   * Get comprehensive quality report for a model
   */
  async getQualityReport(modelId: string): Promise<{
    currentQuality: any;
    qualityHistory: any[];
    activeAlerts: any[];
    retrainingStatus: any;
    recommendations: string[];
  }> {
    try {
      // Get quality history
      const qualityHistory = await this.qualityService.getQualityHistory(modelId);
      
      // Get active alerts
      const activeAlerts = await this.monitoringService.getActiveAlerts(modelId);
      
      // Check retraining status
      const retrainingStatus = await this.qualityService.checkRetrainingNeeded(modelId);
      
      // Generate comprehensive recommendations
      const recommendations = this.generateComprehensiveRecommendations(
        qualityHistory,
        activeAlerts,
        retrainingStatus
      );

      return {
        currentQuality: qualityHistory[0] || null,
        qualityHistory,
        activeAlerts,
        retrainingStatus,
        recommendations,
      };
    } catch (error) {
      console.error('Failed to generate quality report:', error);
      throw new Error(`Failed to generate quality report: ${error.message}`);
    }
  }

  /**
   * Generate comprehensive recommendations based on quality data
   */
  private generateComprehensiveRecommendations(
    qualityHistory: any[],
    activeAlerts: any[],
    retrainingStatus: any
  ): string[] {
    const recommendations: string[] = [];

    // No quality data
    if (qualityHistory.length === 0) {
      recommendations.push('No quality assessments available. Consider running quality assessment on generated images.');
      return recommendations;
    }

    const latestQuality = qualityHistory[0];
    const averageQuality = qualityHistory.reduce((sum, q) => sum + q.overallQuality, 0) / qualityHistory.length;

    // Quality-based recommendations
    if (latestQuality.overallQuality < 0.7) {
      recommendations.push('Current quality is significantly below acceptable levels. Immediate retraining recommended.');
    } else if (latestQuality.overallQuality < 0.85) {
      recommendations.push('Current quality is below optimal levels. Consider parameter optimization or retraining.');
    }

    // CLIP similarity specific recommendations
    if (latestQuality.clipSimilarity < 0.8) {
      recommendations.push('CLIP similarity is low. Consider improving training image diversity or adjusting style parameters.');
    }

    // Face recognition specific recommendations
    if (latestQuality.faceRecognitionScore < 0.8) {
      recommendations.push('Face recognition score is low. Ensure training images have clear, well-lit faces and consider face preprocessing.');
    }

    // Trend analysis
    if (qualityHistory.length >= 3) {
      const recentTrend = qualityHistory.slice(0, 3);
      const isDecreasing = recentTrend.every((q, i) => 
        i === 0 || q.overallQuality < recentTrend[i - 1].overallQuality
      );
      
      if (isDecreasing) {
        recommendations.push('Quality trend is decreasing. Monitor closely and consider investigating recent changes.');
      }
    }

    // Alert-based recommendations
    const highSeverityAlerts = activeAlerts.filter(alert => alert.severity === 'high');
    if (highSeverityAlerts.length > 0) {
      recommendations.push(`${highSeverityAlerts.length} high-severity alerts require immediate attention.`);
    }

    // Retraining recommendations
    if (retrainingStatus.needsRetraining) {
      recommendations.push(`Retraining recommended: ${retrainingStatus.reason}`);
    }

    // Performance optimization recommendations
    if (averageQuality > 0.9) {
      recommendations.push('Excellent quality maintained. Consider this model as a template for future training configurations.');
    } else if (averageQuality > 0.85) {
      recommendations.push('Good quality overall. Minor optimizations may improve consistency.');
    }

    // Default recommendation if no issues found
    if (recommendations.length === 0) {
      recommendations.push('Quality metrics are within acceptable ranges. Continue monitoring.');
    }

    return recommendations;
  }

  /**
   * Validate training images before starting training
   */
  async validateTrainingImages(imageUrls: string[]): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Basic validation
    if (imageUrls.length < 5) {
      issues.push('Insufficient training images (minimum 5 recommended)');
      recommendations.push('Add more diverse training images for better quality');
    }

    if (imageUrls.length > 50) {
      issues.push('Too many training images may increase costs without significant quality improvement');
      recommendations.push('Consider selecting the best 20-30 images for optimal cost-quality balance');
    }

    // TODO: Add actual image validation (face detection, quality checks, etc.)
    // This would require image processing capabilities

    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    };
  }
}