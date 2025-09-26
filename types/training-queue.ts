// Training Queue and Concurrency Management Types

export interface TrainingQueueEntry {
  id: string;
  user_id: string;
  model_id: number;
  priority: number; // 1 (highest) to 10 (lowest)
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  provider: 'runpod' | 'replicate' | 'fal';
  estimated_duration?: number; // milliseconds
  estimated_start_time?: string;
  actual_start_time?: string;
  completion_time?: string;
  queue_position?: number;
  retry_count: number;
  max_retries: number;
  training_config: TrainingConfig;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingConfig {
  image_urls: string[];
  trigger_word: string;
  model_name: string;
  resolution: number;
  max_train_steps: number;
  lora_rank: number;
  learning_rate: number;
  train_batch_size: number;
  gradient_accumulation: number;
  mixed_precision: 'fp16' | 'bf16';
  use_xformers: boolean;
  [key: string]: any; // Allow additional provider-specific config
}

export interface UserRateLimit {
  id: string;
  user_id: string;
  limit_type: 'hourly' | 'daily' | 'monthly';
  limit_value: number;
  current_usage: number;
  reset_time: string;
  created_at: string;
  updated_at: string;
}

export interface ProviderCapacity {
  id: string;
  provider: 'runpod' | 'replicate' | 'fal';
  instance_id?: string;
  max_concurrent_jobs: number;
  current_jobs: number;
  status: 'active' | 'maintenance' | 'disabled';
  health_score: number; // 0.0 to 1.0
  average_job_duration?: number; // milliseconds
  last_health_check: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface QueueStatistics {
  id: string;
  date: string;
  provider: string;
  total_queued: number;
  total_processed: number;
  total_failed: number;
  total_cancelled: number;
  average_wait_time?: number; // milliseconds
  average_processing_time?: number; // milliseconds
  peak_queue_size: number;
  throughput_per_hour?: number;
  created_at: string;
  updated_at: string;
}

export interface QueueStatus {
  total_queued: number;
  total_processing: number;
  estimated_wait_time: number; // milliseconds
  queue_position?: number;
  provider_status: ProviderStatus[];
}

export interface ProviderStatus {
  provider: string;
  available_capacity: number;
  current_load: number;
  health_score: number;
  estimated_processing_time: number;
}

export interface QueueMetrics {
  current_queue_size: number;
  processing_jobs: number;
  completed_today: number;
  failed_today: number;
  average_wait_time: number;
  average_processing_time: number;
  throughput_per_hour: number;
  provider_health: ProviderStatus[];
}

export interface LoadBalancingDecision {
  selected_provider: string;
  estimated_start_time: string;
  estimated_completion_time: string;
  queue_position: number;
  reasoning: string;
}

export interface RateLimitCheck {
  allowed: boolean;
  limit_type: string;
  current_usage: number;
  limit_value: number;
  reset_time: string;
  time_until_reset: number; // milliseconds
}

export interface QueueDashboardData {
  user_queue_entries: TrainingQueueEntry[];
  user_rate_limits: UserRateLimit[];
  queue_status: QueueStatus;
  queue_metrics: QueueMetrics;
  recent_completions: TrainingQueueEntry[];
}

// API Request/Response types
export interface EnqueueTrainingRequest {
  model_id: number;
  training_config: TrainingConfig;
  priority?: number;
  preferred_provider?: string;
}

export interface EnqueueTrainingResponse {
  queue_entry: TrainingQueueEntry;
  estimated_start_time: string;
  estimated_completion_time: string;
  queue_position: number;
}

export interface UpdateQueueEntryRequest {
  status?: TrainingQueueEntry['status'];
  priority?: number;
  error_message?: string;
  actual_start_time?: string;
  completion_time?: string;
}

export interface CancelTrainingRequest {
  queue_entry_id: string;
  reason?: string;
}

export interface RetryTrainingRequest {
  queue_entry_id: string;
  new_priority?: number;
  new_provider?: string;
}

// Error types
export class QueueError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'QueueError';
  }
}

export class RateLimitError extends QueueError {
  constructor(
    message: string,
    public limit_type: string,
    public reset_time: string
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', { limit_type, reset_time });
    this.name = 'RateLimitError';
  }
}

export class CapacityError extends QueueError {
  constructor(message: string, public provider: string) {
    super(message, 'CAPACITY_EXCEEDED', { provider });
    this.name = 'CapacityError';
  }
}