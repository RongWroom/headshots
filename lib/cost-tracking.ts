/**
 * Cost Tracking Service for Training Jobs
 * Handles cost calculation, estimation, and budget monitoring
 */

import { createClient } from '@supabase/supabase-js';
import { Logger } from './logger';

export interface CostEstimateRequest {
  serviceProvider: 'runpod' | 'fal' | 'replicate';
  imageCount: number;
  trainingParameters: {
    resolution: number;
    maxTrainSteps: number;
    loraRank: number;
    trainBatchSize: number;
    gpuType?: string;
  };
  userId: string;
}

export interface CostEstimate {
  id?: number;
  serviceProvider: string;
  estimatedCost: number;
  currency: string;
  estimatedTrainingTimeMinutes: number;
  costBreakdown: {
    gpuCost: number;
    storageCost: number;
    networkCost: number;
    serviceFee: number;
  };
  trainingParameters: any;
  confidence: 'high' | 'medium' | 'low';
}

export interface TrainingCost {
  id?: number;
  modelId: number;
  userId: string;
  trainingId: string;
  serviceProvider: string;
  gpuType?: string;
  trainingStartTime: Date;
  trainingEndTime: Date;
  trainingDurationMinutes: number;
  gpuCostPerHour: number;
  totalCost: number;
  currency: string;
  costBreakdown: {
    gpuCost: number;
    storageCost: number;
    networkCost: number;
    serviceFee: number;
  };
  trainingParameters: any;
  status: 'completed' | 'failed' | 'cancelled';
}

export interface BudgetAlert {
  id?: number;
  userId: string;
  alertType: 'daily' | 'weekly' | 'monthly' | 'per_training';
  thresholdAmount: number;
  currency: string;
  isActive: boolean;
  notificationEmail?: string;
  notificationWebhook?: string;
}

export interface BudgetStatus {
  currentSpending: number;
  budgetLimit: number;
  percentageUsed: number;
  alertsTriggered: number;
  timeRemaining: string;
}

/**
 * Cost calculation configurations for different providers
 */
const PROVIDER_CONFIGS = {
  runpod: {
    gpuTypes: {
      'RTX 4090': { costPerHour: 0.79, memoryGB: 24 },
      'RTX 3090': { costPerHour: 0.59, memoryGB: 24 },
      'A100 40GB': { costPerHour: 1.89, memoryGB: 40 },
      'A100 80GB': { costPerHour: 2.49, memoryGB: 80 },
    },
    defaultGpuType: 'RTX 4090',
    storageCostPerGB: 0.10, // per month, prorated
    networkCostPerGB: 0.02,
    serviceFeePercentage: 0.05, // 5% service fee
    baseTrainingTimeMinutes: 15, // base time for minimal training
    timePerImageMinutes: 0.8, // additional time per image
    timePerStepSeconds: 0.6, // time per training step
  },
  fal: {
    baseCostPerTraining: 1.20,
    costPerImage: 0.08,
    maxImages: 50,
    serviceFeePercentage: 0.10,
    baseTrainingTimeMinutes: 12,
    timePerImageMinutes: 0.5,
  },
  replicate: {
    baseCostPerTraining: 2.00,
    costPerSecond: 0.0023,
    serviceFeePercentage: 0.15,
    baseTrainingTimeMinutes: 20,
    timePerImageMinutes: 1.2,
  }
};

export class CostTrackingService {
  private supabase;
  private logger: Logger;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.logger = new Logger('COST_TRACKING');
  }

  /**
   * Generate cost estimate before training starts
   */
  async generateCostEstimate(request: CostEstimateRequest): Promise<CostEstimate> {
    this.logger.logInfo('GENERATING_COST_ESTIMATE', {
      provider: request.serviceProvider,
      imageCount: request.imageCount,
      userId: request.userId
    });

    let estimate: CostEstimate;

    switch (request.serviceProvider) {
      case 'runpod':
        estimate = this.calculateRunPodCost(request);
        break;
      case 'fal':
        estimate = this.calculateFalCost(request);
        break;
      case 'replicate':
        estimate = this.calculateReplicateCost(request);
        break;
      default:
        throw new Error(`Unsupported service provider: ${request.serviceProvider}`);
    }

    // Store estimate in database
    const { data, error } = await this.supabase
      .from('cost_estimates')
      .insert({
        user_id: request.userId,
        service_provider: request.serviceProvider,
        image_count: request.imageCount,
        estimated_training_time_minutes: estimate.estimatedTrainingTimeMinutes,
        estimated_cost: estimate.estimatedCost,
        currency: estimate.currency,
        cost_breakdown: estimate.costBreakdown,
        training_parameters: request.trainingParameters
      })
      .select()
      .single();

    if (error) {
      this.logger.logError('COST_ESTIMATE_STORAGE_FAILED', { error: error.message });
      throw new Error(`Failed to store cost estimate: ${error.message}`);
    }

    estimate.id = data.id;

    this.logger.logSuccess('COST_ESTIMATE_GENERATED', {
      estimateId: estimate.id,
      estimatedCost: estimate.estimatedCost,
      provider: request.serviceProvider
    });

    return estimate;
  }

  /**
   * Record actual training cost after completion
   */
  async recordTrainingCost(cost: Omit<TrainingCost, 'id'>): Promise<TrainingCost> {
    this.logger.logInfo('RECORDING_TRAINING_COST', {
      trainingId: cost.trainingId,
      totalCost: cost.totalCost,
      provider: cost.serviceProvider
    });

    const { data, error } = await this.supabase
      .from('training_costs')
      .insert({
        model_id: cost.modelId,
        user_id: cost.userId,
        training_id: cost.trainingId,
        service_provider: cost.serviceProvider,
        gpu_type: cost.gpuType,
        training_start_time: cost.trainingStartTime.toISOString(),
        training_end_time: cost.trainingEndTime.toISOString(),
        training_duration_minutes: cost.trainingDurationMinutes,
        gpu_cost_per_hour: cost.gpuCostPerHour,
        total_cost: cost.totalCost,
        currency: cost.currency,
        cost_breakdown: cost.costBreakdown,
        training_parameters: cost.trainingParameters,
        status: cost.status
      })
      .select()
      .single();

    if (error) {
      this.logger.logError('TRAINING_COST_STORAGE_FAILED', { error: error.message });
      throw new Error(`Failed to record training cost: ${error.message}`);
    }

    const recordedCost: TrainingCost = {
      id: data.id,
      modelId: data.model_id,
      userId: data.user_id,
      trainingId: data.training_id,
      serviceProvider: data.service_provider,
      gpuType: data.gpu_type,
      trainingStartTime: new Date(data.training_start_time),
      trainingEndTime: new Date(data.training_end_time),
      trainingDurationMinutes: data.training_duration_minutes,
      gpuCostPerHour: data.gpu_cost_per_hour,
      totalCost: data.total_cost,
      currency: data.currency,
      costBreakdown: data.cost_breakdown,
      trainingParameters: data.training_parameters,
      status: data.status
    };

    // Check budget alerts after recording cost
    await this.checkBudgetAlerts(cost.userId, cost.totalCost);

    this.logger.logSuccess('TRAINING_COST_RECORDED', {
      costId: recordedCost.id,
      totalCost: recordedCost.totalCost
    });

    return recordedCost;
  }

  /**
   * Calculate RunPod training cost
   */
  private calculateRunPodCost(request: CostEstimateRequest): CostEstimate {
    const config = PROVIDER_CONFIGS.runpod;
    const gpuType = request.trainingParameters.gpuType || config.defaultGpuType;
    const gpuConfig = (config.gpuTypes as any)[gpuType] || (config.gpuTypes as any)[config.defaultGpuType];

    // Calculate training time
    const baseTime = config.baseTrainingTimeMinutes;
    const imageTime = request.imageCount * config.timePerImageMinutes;
    const stepTime = (request.trainingParameters.maxTrainSteps * config.timePerStepSeconds) / 60;
    const resolutionMultiplier = request.trainingParameters.resolution >= 1024 ? 1.5 : 1.0;
    
    const estimatedTimeMinutes = Math.ceil((baseTime + imageTime + stepTime) * resolutionMultiplier);

    // Calculate costs
    const gpuCost = (estimatedTimeMinutes / 60) * gpuConfig.costPerHour;
    const storageCost = (request.imageCount * 0.005 * config.storageCostPerGB) / 30; // prorated monthly
    const networkCost = (request.imageCount * 0.01 * config.networkCostPerGB);
    const subtotal = gpuCost + storageCost + networkCost;
    const serviceFee = subtotal * config.serviceFeePercentage;
    const totalCost = subtotal + serviceFee;

    return {
      serviceProvider: 'runpod',
      estimatedCost: Math.round(totalCost * 100) / 100,
      currency: 'USD',
      estimatedTrainingTimeMinutes: estimatedTimeMinutes,
      costBreakdown: {
        gpuCost: Math.round(gpuCost * 100) / 100,
        storageCost: Math.round(storageCost * 100) / 100,
        networkCost: Math.round(networkCost * 100) / 100,
        serviceFee: Math.round(serviceFee * 100) / 100
      },
      trainingParameters: request.trainingParameters,
      confidence: request.imageCount >= 10 && request.imageCount <= 30 ? 'high' : 'medium'
    };
  }

  /**
   * Calculate Fal.ai training cost
   */
  private calculateFalCost(request: CostEstimateRequest): CostEstimate {
    const config = PROVIDER_CONFIGS.fal;
    
    const baseCost = config.baseCostPerTraining;
    const imageCost = Math.min(request.imageCount, config.maxImages) * config.costPerImage;
    const subtotal = baseCost + imageCost;
    const serviceFee = subtotal * config.serviceFeePercentage;
    const totalCost = subtotal + serviceFee;

    const estimatedTimeMinutes = Math.ceil(
      config.baseTrainingTimeMinutes + (request.imageCount * config.timePerImageMinutes)
    );

    return {
      serviceProvider: 'fal',
      estimatedCost: Math.round(totalCost * 100) / 100,
      currency: 'USD',
      estimatedTrainingTimeMinutes: estimatedTimeMinutes,
      costBreakdown: {
        gpuCost: baseCost,
        storageCost: 0,
        networkCost: imageCost,
        serviceFee: Math.round(serviceFee * 100) / 100
      },
      trainingParameters: request.trainingParameters,
      confidence: 'high'
    };
  }

  /**
   * Calculate Replicate training cost
   */
  private calculateReplicateCost(request: CostEstimateRequest): CostEstimate {
    const config = PROVIDER_CONFIGS.replicate;
    
    const estimatedTimeMinutes = Math.ceil(
      config.baseTrainingTimeMinutes + (request.imageCount * config.timePerImageMinutes)
    );
    
    const computeCost = (estimatedTimeMinutes * 60) * config.costPerSecond;
    const serviceFee = computeCost * config.serviceFeePercentage;
    const totalCost = computeCost + serviceFee;

    return {
      serviceProvider: 'replicate',
      estimatedCost: Math.round(totalCost * 100) / 100,
      currency: 'USD',
      estimatedTrainingTimeMinutes: estimatedTimeMinutes,
      costBreakdown: {
        gpuCost: Math.round(computeCost * 100) / 100,
        storageCost: 0,
        networkCost: 0,
        serviceFee: Math.round(serviceFee * 100) / 100
      },
      trainingParameters: request.trainingParameters,
      confidence: 'medium'
    };
  }

  /**
   * Get user's training cost history
   */
  async getUserCostHistory(userId: string, days: number = 30): Promise<TrainingCost[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('training_costs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.logError('COST_HISTORY_FETCH_FAILED', { error: error.message, userId });
      throw new Error(`Failed to fetch cost history: ${error.message}`);
    }

    return data.map(item => ({
      id: item.id,
      modelId: item.model_id,
      userId: item.user_id,
      trainingId: item.training_id,
      serviceProvider: item.service_provider,
      gpuType: item.gpu_type,
      trainingStartTime: new Date(item.training_start_time),
      trainingEndTime: new Date(item.training_end_time),
      trainingDurationMinutes: item.training_duration_minutes,
      gpuCostPerHour: item.gpu_cost_per_hour,
      totalCost: item.total_cost,
      currency: item.currency,
      costBreakdown: item.cost_breakdown,
      trainingParameters: item.training_parameters,
      status: item.status
    }));
  }

  /**
   * Create or update budget alert
   */
  async setBudgetAlert(alert: Omit<BudgetAlert, 'id'>): Promise<BudgetAlert> {
    const { data, error } = await this.supabase
      .from('budget_alerts')
      .upsert({
        user_id: alert.userId,
        alert_type: alert.alertType,
        threshold_amount: alert.thresholdAmount,
        currency: alert.currency,
        is_active: alert.isActive,
        notification_email: alert.notificationEmail,
        notification_webhook: alert.notificationWebhook
      })
      .select()
      .single();

    if (error) {
      this.logger.logError('BUDGET_ALERT_UPSERT_FAILED', { error: error.message });
      throw new Error(`Failed to set budget alert: ${error.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      alertType: data.alert_type,
      thresholdAmount: data.threshold_amount,
      currency: data.currency,
      isActive: data.is_active,
      notificationEmail: data.notification_email,
      notificationWebhook: data.notification_webhook
    };
  }

  /**
   * Check budget alerts and trigger notifications if needed
   */
  private async checkBudgetAlerts(userId: string, newCost: number): Promise<void> {
    const { data: alerts, error } = await this.supabase
      .from('budget_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error || !alerts) {
      this.logger.logWarning('BUDGET_ALERTS_FETCH_FAILED', 'Failed to fetch budget alerts', { error: error?.message, userId });
      return;
    }

    for (const alert of alerts) {
      const spending = await this.calculatePeriodSpending(userId, alert.alert_type);
      
      if (spending >= alert.threshold_amount) {
        await this.triggerBudgetAlert(alert, spending);
      }
    }
  }

  /**
   * Calculate spending for a specific period
   */
  private async calculatePeriodSpending(userId: string, period: string): Promise<number> {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'daily':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'per_training':
        return 0; // Handle per-training alerts separately
    }

    const { data, error } = await this.supabase
      .from('training_costs')
      .select('total_cost')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (error) {
      this.logger.logError('PERIOD_SPENDING_CALCULATION_FAILED', { error: error.message });
      return 0;
    }

    return data.reduce((sum, cost) => sum + cost.total_cost, 0);
  }

  /**
   * Trigger budget alert notification
   */
  private async triggerBudgetAlert(alert: any, currentSpending: number): Promise<void> {
    this.logger.logWarning('BUDGET_ALERT_TRIGGERED', 'Budget alert threshold exceeded', {
      userId: alert.user_id,
      alertType: alert.alert_type,
      threshold: alert.threshold_amount,
      currentSpending
    });

    // Record the alert notification
    await this.supabase
      .from('budget_alert_notifications')
      .insert({
        budget_alert_id: alert.id,
        user_id: alert.user_id,
        triggered_amount: currentSpending,
        period_start: this.getPeriodStart(alert.alert_type),
        period_end: new Date().toISOString(),
        notification_sent: false,
        notification_method: alert.notification_email ? 'email' : 'webhook'
      });

    // TODO: Implement actual notification sending (email/webhook)
    // This would integrate with your notification service
  }

  /**
   * Get period start date for alert calculations
   */
  private getPeriodStart(alertType: string): string {
    const now = new Date();
    const startDate = new Date();

    switch (alertType) {
      case 'daily':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    return startDate.toISOString();
  }

  /**
   * Get budget status for user
   */
  async getBudgetStatus(userId: string): Promise<BudgetStatus[]> {
    const { data: alerts, error } = await this.supabase
      .from('budget_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error || !alerts) {
      return [];
    }

    const statuses: BudgetStatus[] = [];

    for (const alert of alerts) {
      const currentSpending = await this.calculatePeriodSpending(userId, alert.alert_type);
      const percentageUsed = (currentSpending / alert.threshold_amount) * 100;

      statuses.push({
        currentSpending,
        budgetLimit: alert.threshold_amount,
        percentageUsed: Math.round(percentageUsed * 100) / 100,
        alertsTriggered: 0, // TODO: Calculate from notifications table
        timeRemaining: this.getTimeRemaining(alert.alert_type)
      });
    }

    return statuses;
  }

  /**
   * Get time remaining in current period
   */
  private getTimeRemaining(alertType: string): string {
    const now = new Date();
    
    switch (alertType) {
      case 'daily':
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        const hoursLeft = Math.ceil((endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60));
        return `${hoursLeft} hours`;
      
      case 'weekly':
        const daysLeft = 7 - now.getDay();
        return `${daysLeft} days`;
      
      case 'monthly':
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const daysLeftInMonth = lastDay.getDate() - now.getDate();
        return `${daysLeftInMonth} days`;
      
      default:
        return 'Unknown';
    }
  }
}

// Export singleton instance
export const costTrackingService = new CostTrackingService();