import { QualityAssessmentService, QualityThresholds, DEFAULT_QUALITY_THRESHOLDS } from './quality-assessment';
import { createClient } from '@supabase/supabase-js';

export interface QualityAlert {
  id: string;
  modelId: string;
  alertType: 'low_quality' | 'retraining_needed' | 'quality_degradation';
  severity: 'low' | 'medium' | 'high';
  message: string;
  recommendations: string[];
  createdAt: Date;
  resolved: boolean;
}

export interface QualityMonitoringConfig {
  thresholds: QualityThresholds;
  alertOnConsecutiveFailures: number;
  qualityDegradationThreshold: number;
  monitoringEnabled: boolean;
}

export const DEFAULT_MONITORING_CONFIG: QualityMonitoringConfig = {
  thresholds: DEFAULT_QUALITY_THRESHOLDS,
  alertOnConsecutiveFailures: 3,
  qualityDegradationThreshold: 0.1, // 10% degradation
  monitoringEnabled: true,
};

export class QualityMonitoringService {
  private qualityService: QualityAssessmentService;
  private supabase;

  constructor() {
    this.qualityService = new QualityAssessmentService();
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Monitor quality for a specific model and create alerts if needed
   */
  async monitorModelQuality(
    modelId: string,
    config: QualityMonitoringConfig = DEFAULT_MONITORING_CONFIG
  ): Promise<QualityAlert[]> {
    if (!config.monitoringEnabled) {
      return [];
    }

    const alerts: QualityAlert[] = [];

    try {
      // Get recent quality history
      const qualityHistory = await this.qualityService.getQualityHistory(modelId);
      
      if (qualityHistory.length === 0) {
        return alerts;
      }

      // Check for consecutive failures
      const consecutiveFailures = this.checkConsecutiveFailures(
        qualityHistory,
        config.thresholds,
        config.alertOnConsecutiveFailures
      );

      if (consecutiveFailures.hasFailures) {
        alerts.push(await this.createQualityAlert(
          modelId,
          'low_quality',
          'high',
          `Model has ${consecutiveFailures.count} consecutive quality failures`,
          [
            'Review training parameters and consider retraining',
            'Check training image quality and diversity',
            'Consider adjusting quality thresholds if appropriate'
          ]
        ));
      }

      // Check for quality degradation over time
      const qualityDegradation = this.checkQualityDegradation(
        qualityHistory,
        config.qualityDegradationThreshold
      );

      if (qualityDegradation.hasDegradation) {
        alerts.push(await this.createQualityAlert(
          modelId,
          'quality_degradation',
          'medium',
          `Model quality has degraded by ${(qualityDegradation.degradationAmount * 100).toFixed(1)}%`,
          [
            'Monitor model performance closely',
            'Consider retraining if degradation continues',
            'Review recent changes to training pipeline'
          ]
        ));
      }

      // Check if retraining is needed
      const retrainingCheck = await this.qualityService.checkRetrainingNeeded(
        modelId,
        config.thresholds
      );

      if (retrainingCheck.needsRetraining) {
        alerts.push(await this.createQualityAlert(
          modelId,
          'retraining_needed',
          'high',
          `Model requires retraining: ${retrainingCheck.reason}`,
          [
            'Schedule model retraining with optimized parameters',
            'Review and update training dataset if needed',
            'Consider A/B testing different training configurations'
          ]
        ));
      }

      return alerts;
    } catch (error) {
      console.error('Quality monitoring failed:', error);
      throw new Error(`Quality monitoring failed: ${error.message}`);
    }
  }

  /**
   * Check for consecutive quality failures
   */
  private checkConsecutiveFailures(
    qualityHistory: any[],
    thresholds: QualityThresholds,
    alertThreshold: number
  ): { hasFailures: boolean; count: number } {
    let consecutiveCount = 0;
    
    for (const assessment of qualityHistory) {
      if (assessment.overallQuality < thresholds.overallQualityMin) {
        consecutiveCount++;
      } else {
        break; // Reset count on first success
      }
    }

    return {
      hasFailures: consecutiveCount >= alertThreshold,
      count: consecutiveCount,
    };
  }

  /**
   * Check for quality degradation over time
   */
  private checkQualityDegradation(
    qualityHistory: any[],
    degradationThreshold: number
  ): { hasDegradation: boolean; degradationAmount: number } {
    if (qualityHistory.length < 10) {
      return { hasDegradation: false, degradationAmount: 0 };
    }

    // Compare recent average to historical average
    const recentAssessments = qualityHistory.slice(0, 5);
    const historicalAssessments = qualityHistory.slice(5, 15);

    const recentAverage = recentAssessments.reduce(
      (sum, assessment) => sum + assessment.overallQuality,
      0
    ) / recentAssessments.length;

    const historicalAverage = historicalAssessments.reduce(
      (sum, assessment) => sum + assessment.overallQuality,
      0
    ) / historicalAssessments.length;

    const degradationAmount = historicalAverage - recentAverage;

    return {
      hasDegradation: degradationAmount > degradationThreshold,
      degradationAmount,
    };
  }

  /**
   * Create a quality alert
   */
  private async createQualityAlert(
    modelId: string,
    alertType: QualityAlert['alertType'],
    severity: QualityAlert['severity'],
    message: string,
    recommendations: string[]
  ): Promise<QualityAlert> {
    const alert: QualityAlert = {
      id: crypto.randomUUID(),
      modelId,
      alertType,
      severity,
      message,
      recommendations,
      createdAt: new Date(),
      resolved: false,
    };

    // Store alert in database
    await this.storeQualityAlert(alert);

    return alert;
  }

  /**
   * Store quality alert in database
   */
  private async storeQualityAlert(alert: QualityAlert): Promise<void> {
    const { error } = await this.supabase
      .from('quality_alerts')
      .insert({
        id: alert.id,
        model_id: alert.modelId,
        alert_type: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        recommendations: alert.recommendations,
        created_at: alert.createdAt.toISOString(),
        resolved: alert.resolved,
      });

    if (error) {
      console.error('Failed to store quality alert:', error);
      throw new Error(`Failed to store quality alert: ${error.message}`);
    }
  }

  /**
   * Get active quality alerts for a model
   */
  async getActiveAlerts(modelId: string): Promise<QualityAlert[]> {
    const { data, error } = await this.supabase
      .from('quality_alerts')
      .select('*')
      .eq('model_id', modelId)
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch quality alerts: ${error.message}`);
    }

    return data.map(row => ({
      id: row.id,
      modelId: row.model_id,
      alertType: row.alert_type,
      severity: row.severity,
      message: row.message,
      recommendations: row.recommendations,
      createdAt: new Date(row.created_at),
      resolved: row.resolved,
    }));
  }

  /**
   * Resolve a quality alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const { error } = await this.supabase
      .from('quality_alerts')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', alertId);

    if (error) {
      throw new Error(`Failed to resolve quality alert: ${error.message}`);
    }
  }

  /**
   * Get quality monitoring dashboard data
   */
  async getMonitoringDashboard(): Promise<{
    totalModels: number;
    modelsWithAlerts: number;
    averageQuality: number;
    recentAlerts: QualityAlert[];
  }> {
    // Get summary statistics
    const { data: summaryData, error: summaryError } = await this.supabase
      .from('quality_assessment_summary')
      .select('*');

    if (summaryError) {
      throw new Error(`Failed to fetch quality summary: ${summaryError.message}`);
    }

    // Get recent alerts
    const { data: alertsData, error: alertsError } = await this.supabase
      .from('quality_alerts')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (alertsError) {
      throw new Error(`Failed to fetch recent alerts: ${alertsError.message}`);
    }

    const totalModels = summaryData.length;
    const modelsWithAlerts = new Set(alertsData.map(alert => alert.model_id)).size;
    const averageQuality = summaryData.reduce(
      (sum, model) => sum + (model.avg_overall_quality || 0),
      0
    ) / Math.max(totalModels, 1);

    const recentAlerts = alertsData.map(row => ({
      id: row.id,
      modelId: row.model_id,
      alertType: row.alert_type,
      severity: row.severity,
      message: row.message,
      recommendations: row.recommendations,
      createdAt: new Date(row.created_at),
      resolved: row.resolved,
    }));

    return {
      totalModels,
      modelsWithAlerts,
      averageQuality,
      recentAlerts,
    };
  }
}