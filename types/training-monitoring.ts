/**
 * Training Monitoring Types
 * Comprehensive types for training session monitoring, status tracking, and performance metrics
 */

export interface TrainingSession {
  id: string;
  model_id: number;
  user_id: string;
  provider: 'runpod' | 'replicate' | 'fal';
  external_training_id?: string;
  status: TrainingStatus;
  progress: number;
  current_step: number;
  total_steps?: number;
  estimated_completion_time?: string;
  training_started_at?: string;
  training_completed_at?: string;
  training_duration?: number; // milliseconds
  error_message?: string;
  error_code?: string;
  retry_count: number;
  webhook_events: WebhookEvent[];
  training_config?: TrainingConfig;
  performance_metrics?: PerformanceMetrics;
  created_at: string;
  updated_at: string;
}

export type TrainingStatus = 
  | 'pending'     // Initial state, waiting to start
  | 'queued'      // Queued in provider's system
  | 'training'    // Currently training
  | 'completed'   // Successfully completed
  | 'failed'      // Failed with error
  | 'cancelled';  // Cancelled by user or system

export interface TrainingStatusUpdate {
  id: string;
  training_session_id: string;
  status: TrainingStatus;
  progress?: number;
  current_step?: number;
  message?: string;
  details?: Record<string, any>;
  source: 'system' | 'webhook' | 'manual';
  created_at: string;
}

export interface TrainingConfig {
  resolution: number;
  max_train_steps: number;
  lora_rank: number;
  lora_alpha: number;
  learning_rate: number;
  train_batch_size: number;
  gradient_accumulation_steps: number;
  mixed_precision: string;
  use_8bit_adam: boolean;
  enable_xformers: boolean;
  save_steps: number;
  warmup_steps: number;
  scheduler_type: string;
  weight_decay: number;
  max_grad_norm: number;
  ab_test_id?: string;
  variant_id?: string;
}

export interface PerformanceMetrics {
  final_loss?: number;
  peak_memory_usage?: number;
  average_gpu_utilization?: number;
  training_speed?: number; // steps per second
  convergence_step?: number;
  quality_score?: number;
  [key: string]: any;
}

export interface TrainingPerformanceMetric {
  id: string;
  training_session_id: string;
  metric_type: string;
  metric_value: number;
  step?: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface TrainingHistorySummary {
  id: string;
  user_id: string;
  provider: string;
  date: string;
  total_sessions: number;
  successful_sessions: number;
  failed_sessions: number;
  cancelled_sessions: number;
  average_duration?: number; // milliseconds
  total_training_time?: number; // milliseconds
  success_rate?: number; // percentage
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  training_session_id?: string;
  provider: string;
  event_type: string;
  event_data: Record<string, any>;
  processed: boolean;
  processing_error?: string;
  received_at: string;
  processed_at?: string;
}

// Training monitoring service interfaces
export interface TrainingMonitoringService {
  createTrainingSession(params: CreateTrainingSessionParams): Promise<TrainingSession>;
  updateTrainingSession(sessionId: string, updates: Partial<TrainingSession>): Promise<TrainingSession>;
  getTrainingSession(sessionId: string): Promise<TrainingSession | null>;
  getTrainingSessionsByModel(modelId: number): Promise<TrainingSession[]>;
  getTrainingSessionsByUser(userId: string, options?: GetSessionsOptions): Promise<TrainingSession[]>;
  addStatusUpdate(sessionId: string, update: CreateStatusUpdateParams): Promise<TrainingStatusUpdate>;
  addPerformanceMetric(sessionId: string, metric: CreatePerformanceMetricParams): Promise<TrainingPerformanceMetric>;
  processWebhookEvent(event: CreateWebhookEventParams): Promise<WebhookEvent>;
  getTrainingHistory(userId: string, options?: GetHistoryOptions): Promise<TrainingHistorySummary[]>;
  estimateCompletionTime(sessionId: string): Promise<Date | null>;
  calculateTrainingProgress(sessionId: string): Promise<TrainingProgressInfo>;
}

export interface CreateTrainingSessionParams {
  model_id: number;
  user_id: string;
  provider: 'runpod' | 'replicate' | 'fal';
  external_training_id?: string;
  training_config?: TrainingConfig;
  total_steps?: number;
}

export interface CreateStatusUpdateParams {
  status: TrainingStatus;
  progress?: number;
  current_step?: number;
  message?: string;
  details?: Record<string, any>;
  source?: 'system' | 'webhook' | 'manual';
}

export interface CreatePerformanceMetricParams {
  metric_type: string;
  metric_value: number;
  step?: number;
  metadata?: Record<string, any>;
}

export interface CreateWebhookEventParams {
  training_session_id?: string;
  provider: string;
  event_type: string;
  event_data: Record<string, any>;
}

export interface GetSessionsOptions {
  status?: TrainingStatus;
  provider?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'updated_at' | 'training_started_at';
  orderDirection?: 'asc' | 'desc';
}

export interface GetHistoryOptions {
  provider?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface TrainingProgressInfo {
  currentStep: number;
  totalSteps: number;
  progressPercentage: number;
  elapsedTime: number; // milliseconds
  estimatedTimeRemaining: number; // milliseconds
  averageStepTime: number; // milliseconds per step
  stepsPerSecond: number;
  statusMessage: string;
  isStalled: boolean; // No progress for extended period
  lastUpdateTime: string;
}

export interface TrainingTimeEstimation {
  estimatedCompletionTime: Date;
  estimatedRemainingTime: number; // milliseconds
  confidence: number; // 0-1, how confident we are in the estimate
  basedOnSamples: number; // Number of similar training sessions used for estimation
  factors: {
    imageCount: number;
    trainingSteps: number;
    resolution: number;
    provider: string;
    historicalAverage: number;
  };
}

// Dashboard and UI types
export interface TrainingDashboardData {
  activeSessions: TrainingSession[];
  recentSessions: TrainingSession[];
  summary: {
    totalSessions: number;
    activeSessions: number;
    successRate: number;
    averageTrainingTime: number;
    totalTrainingTime: number;
  };
  performanceMetrics: {
    successRateByProvider: Record<string, number>;
    averageTimeByProvider: Record<string, number>;
    dailyTrainingCounts: Array<{
      date: string;
      count: number;
      successCount: number;
    }>;
  };
}

export interface TrainingStatusDisplayInfo {
  status: TrainingStatus;
  statusMessage: string;
  progressPercentage: number;
  elapsedTime: string;
  estimatedTimeRemaining: string;
  canCancel: boolean;
  canRetry: boolean;
  showProgress: boolean;
  statusColor: 'blue' | 'yellow' | 'green' | 'red' | 'gray';
  statusIcon: string;
}

// Error types
export interface TrainingError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  userMessage: string;
  actionableSteps: string[];
  timestamp: string;
}

// Webhook payload types for different providers
export interface RunPodWebhookPayload {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  output?: any;
  error?: string;
  executionTime?: number;
  delayTime?: number;
  logs?: string;
  progress?: {
    current_step: number;
    total_steps: number;
    percentage: number;
    message?: string;
  };
}

export interface ReplicateWebhookPayload {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: any;
  error?: string;
  logs?: string;
  metrics?: {
    predict_time?: number;
    total_time?: number;
  };
}

export interface FalWebhookPayload {
  request_id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  output?: any;
  error?: string;
  logs?: string[];
  metrics?: {
    inference_time?: number;
    queue_time?: number;
  };
}