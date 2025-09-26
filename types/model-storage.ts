// Model Storage System Types
// Types for secure model storage, versioning, and management

export interface ModelWeight {
  id: string;
  model_id: number;
  version: number;
  file_path: string;
  file_size: number;
  file_hash: string;
  storage_provider: 'supabase' | 'aws' | 'gcp' | 'azure';
  metadata: ModelWeightMetadata;
  training_config: TrainingConfig;
  quality_metrics: QualityMetrics;
  is_active: boolean;
  created_at: string;
  expires_at?: string;
  created_by?: string;
}

export interface ModelWeightMetadata {
  model_type: 'lora' | 'full' | 'checkpoint';
  framework: 'pytorch' | 'tensorflow' | 'safetensors';
  architecture: string;
  base_model: string;
  trigger_words: string[];
  training_images_count: number;
  training_duration_minutes: number;
  gpu_type?: string;
  memory_usage_gb?: number;
  tags?: string[];
  description?: string;
}

export interface TrainingConfig {
  resolution: number;
  max_train_steps: number;
  lora_rank: number;
  learning_rate: number;
  train_batch_size: number;
  gradient_accumulation_steps: number;
  mixed_precision: 'fp16' | 'bf16' | 'fp32';
  use_xformers: boolean;
  optimizer: string;
  lr_scheduler: string;
  warmup_steps: number;
  save_every_n_epochs: number;
  validation_split: number;
}

export interface QualityMetrics {
  clip_similarity_score?: number;
  face_recognition_accuracy?: number;
  fid_score?: number;
  lpips_score?: number;
  user_rating?: number;
  validation_loss?: number;
  training_loss?: number;
  convergence_epoch?: number;
  overfitting_score?: number;
}

export interface ModelShare {
  id: string;
  model_id: number;
  shared_by: string;
  shared_with?: string;
  share_token?: string;
  access_level: 'view' | 'download' | 'clone';
  expires_at?: string;
  download_count: number;
  max_downloads?: number;
  is_public: boolean;
  created_at: string;
  last_accessed?: string;
}

export interface ModelCleanupLog {
  id: string;
  model_id?: number;
  cleanup_type: 'expired' | 'user_requested' | 'storage_limit' | 'inactive';
  files_deleted: string[];
  bytes_freed: number;
  cleanup_reason?: string;
  created_at: string;
  performed_by?: string;
}

export interface ModelExport {
  id: string;
  model_id: number;
  user_id: string;
  export_format: 'safetensors' | 'pytorch' | 'onnx' | 'zip';
  export_status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  download_url?: string;
  file_size?: number;
  expires_at: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

// Request/Response types for API endpoints
export interface CreateModelWeightRequest {
  model_id: number;
  file_path: string;
  file_size: number;
  file_hash: string;
  storage_provider?: string;
  metadata: ModelWeightMetadata;
  training_config: TrainingConfig;
  quality_metrics?: QualityMetrics;
  expires_at?: string;
}

export interface CreateModelShareRequest {
  model_id: number;
  shared_with?: string;
  access_level: 'view' | 'download' | 'clone';
  expires_at?: string;
  max_downloads?: number;
  is_public?: boolean;
}

export interface CreateModelExportRequest {
  model_id: number;
  export_format: 'safetensors' | 'pytorch' | 'onnx' | 'zip';
}

export interface ModelStorageStats {
  total_models: number;
  total_storage_bytes: number;
  active_versions: number;
  expired_models: number;
  shared_models: number;
  public_models: number;
  cleanup_operations: number;
  average_model_size: number;
}

export interface ModelVersionHistory {
  model_id: number;
  versions: ModelWeight[];
  current_version: ModelWeight;
  total_versions: number;
  storage_usage_bytes: number;
}

export interface ModelCleanupOptions {
  cleanup_expired: boolean;
  cleanup_inactive_days?: number;
  max_versions_per_model?: number;
  max_storage_per_user_gb?: number;
  dry_run?: boolean;
}

export interface ModelCleanupResult {
  models_cleaned: number;
  files_deleted: string[];
  bytes_freed: number;
  cleanup_logs: ModelCleanupLog[];
  errors: string[];
}

// Storage provider interfaces
export interface StorageProvider {
  name: string;
  upload(file: Buffer, path: string): Promise<string>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  getSignedUrl(path: string, expiresIn: number): Promise<string>;
  getFileInfo(path: string): Promise<{ size: number; hash: string }>;
}

export interface ModelStorageService {
  storeModelWeight(weight: CreateModelWeightRequest): Promise<ModelWeight>;
  getModelWeight(id: string): Promise<ModelWeight | null>;
  getModelVersions(modelId: number): Promise<ModelWeight[]>;
  getActiveModelWeight(modelId: number): Promise<ModelWeight | null>;
  deleteModelWeight(id: string): Promise<void>;
  createModelShare(share: CreateModelShareRequest): Promise<ModelShare>;
  getModelShare(token: string): Promise<ModelShare | null>;
  createModelExport(exportReq: CreateModelExportRequest): Promise<ModelExport>;
  getModelExport(id: string): Promise<ModelExport | null>;
  cleanupExpiredModels(options?: ModelCleanupOptions): Promise<ModelCleanupResult>;
  getStorageStats(userId?: string): Promise<ModelStorageStats>;
}

// Error types
export class ModelStorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ModelStorageError';
  }
}

export class ModelNotFoundError extends ModelStorageError {
  constructor(modelId: string | number) {
    super(`Model not found: ${modelId}`, 'MODEL_NOT_FOUND', { modelId });
  }
}

export class StorageQuotaExceededError extends ModelStorageError {
  constructor(currentUsage: number, limit: number) {
    super(
      `Storage quota exceeded: ${currentUsage}GB / ${limit}GB`,
      'STORAGE_QUOTA_EXCEEDED',
      { currentUsage, limit }
    );
  }
}

export class InvalidModelVersionError extends ModelStorageError {
  constructor(version: number, modelId: number) {
    super(
      `Invalid model version: ${version} for model ${modelId}`,
      'INVALID_MODEL_VERSION',
      { version, modelId }
    );
  }
}

export class ModelShareExpiredError extends ModelStorageError {
  constructor(shareToken: string) {
    super(`Model share has expired: ${shareToken}`, 'MODEL_SHARE_EXPIRED', { shareToken });
  }
}