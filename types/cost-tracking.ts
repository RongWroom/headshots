/**
 * TypeScript types for cost tracking system
 */

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
  createdAt?: string;
  updatedAt?: string;
  lastTriggered?: string;
}

export interface BudgetStatus {
  currentSpending: number;
  budgetLimit: number;
  percentageUsed: number;
  alertsTriggered: number;
  timeRemaining: string;
}

export interface BudgetAlertNotification {
  id: number;
  budgetAlertId: number;
  userId: string;
  triggeredAmount: number;
  periodStart: string;
  periodEnd: string;
  notificationSent: boolean;
  notificationMethod?: 'email' | 'webhook' | 'both';
  notificationDetails?: any;
  createdAt: string;
}

export interface CostSummary {
  totalCost: number;
  averageCost: number;
  totalJobs: number;
  providerBreakdown: Record<string, number>;
  period: string;
}

export interface CostHistoryItem {
  id: number;
  trainingId: string;
  serviceProvider: string;
  totalCost: number;
  currency: string;
  trainingDurationMinutes: number;
  status: string;
  createdAt: string;
  costBreakdown: {
    gpuCost: number;
    storageCost: number;
    networkCost: number;
    serviceFee: number;
  };
}

export interface ProviderConfig {
  gpuTypes?: Record<string, { costPerHour: number; memoryGB: number }>;
  defaultGpuType?: string;
  storageCostPerGB?: number;
  networkCostPerGB?: number;
  serviceFeePercentage?: number;
  baseTrainingTimeMinutes?: number;
  timePerImageMinutes?: number;
  timePerStepSeconds?: number;
  baseCostPerTraining?: number;
  costPerImage?: number;
  maxImages?: number;
  costPerSecond?: number;
}

export interface CostOptimizationRecommendation {
  type: 'cost' | 'quality' | 'time' | 'provider';
  message: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
}

export interface CostComparisonResult {
  provider: string;
  estimatedCost: number;
  estimatedTime: number;
  confidence: 'high' | 'medium' | 'low';
  pros: string[];
  cons: string[];
  recommended: boolean;
}

export interface CostTrackingMetrics {
  totalSpending: number;
  averageCostPerJob: number;
  totalJobs: number;
  successRate: number;
  averageTrainingTime: number;
  mostUsedProvider: string;
  costTrend: 'increasing' | 'decreasing' | 'stable';
  budgetUtilization: number;
}

// API Response types
export interface CostEstimateResponse {
  success: boolean;
  estimate: CostEstimate & {
    recommendations: string[];
  };
}

export interface CostHistoryResponse {
  success: boolean;
  summary: CostSummary;
  history: CostHistoryItem[];
}

export interface BudgetAlertsResponse {
  success: boolean;
  budgetStatuses: BudgetStatus[];
  alerts: BudgetAlert[];
  recentNotifications: BudgetAlertNotification[];
}

export interface BudgetAlertCreateResponse {
  success: boolean;
  alert: BudgetAlert;
}

export interface BudgetAlertUpdateResponse {
  success: boolean;
  alert: BudgetAlert;
}

// Error types
export interface CostTrackingError {
  error: string;
  details?: string;
  code?: string;
  required?: string[];
  validProviders?: string[];
  validTypes?: string[];
}