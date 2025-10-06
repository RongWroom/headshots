/**
 * TypeScript types and interfaces for Seedream integration
 * 
 * This module defines all types used across the Seedream headshot generation feature,
 * including database models, API request/response types, and service interfaces.
 */

import { Database } from './supabase';

// ============================================================================
// Database Types (from Supabase)
// ============================================================================

export type SeedreamUploadRow = Database['public']['Tables']['seedream_uploads']['Row'];
export type SeedreamUploadInsert = Database['public']['Tables']['seedream_uploads']['Insert'];
export type SeedreamUploadUpdate = Database['public']['Tables']['seedream_uploads']['Update'];

export type SeedreamJobRow = Database['public']['Tables']['seedream_jobs']['Row'];
export type SeedreamJobInsert = Database['public']['Tables']['seedream_jobs']['Insert'];
export type SeedreamJobUpdate = Database['public']['Tables']['seedream_jobs']['Update'];

// ============================================================================
// Core Domain Types
// ============================================================================

/**
 * Uploaded image metadata
 */
export interface UploadedImage {
  filename: string;
  blobUrl: string;
  size: number;
}

/**
 * Seedream upload with typed images array
 */
export interface SeedreamUpload {
  id: string;
  userId: string;
  images: UploadedImage[];
  createdAt: string;
  expiresAt: string;
}

/**
 * User customization options for headshot generation
 */
export interface SeedreamCustomizations {
  removeJewelry?: boolean;
  removeGlasses?: boolean;
  removePiercings?: boolean;
  cleanBackground?: boolean;
}

/**
 * Generated output image with metadata
 */
export interface OutputImage {
  url: string;
  thumbnail?: string;
}

/**
 * Job status enum
 */
export type SeedreamJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Seedream job with typed fields
 */
export interface SeedreamJob {
  id: string;
  userId: string;
  uploadId: string;
  styleId: string;
  numOutputs: number;
  customizations: SeedreamCustomizations | null;
  replicatePredictionId: string | null;
  status: SeedreamJobStatus;
  progress: number;
  errorMessage: string | null;
  outputImages: OutputImage[] | null;
  generationTimeSeconds: number | null;
  estimatedCostUsd: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

/**
 * Style category enum
 */
export type StyleCategory = 'corporate' | 'creative' | 'casual';

/**
 * Style configuration for consistent headshot generation
 */
export interface Style {
  id: string;
  name: string;
  description: string;
  prompt: string;
  negativePrompt: string;
  seed: number; // Fixed seed for background consistency
  previewImage: string;
  category: StyleCategory;
}

// ============================================================================
// API Request Types
// ============================================================================

/**
 * Request body for /api/seedream/upload
 */
export interface UploadRequest {
  // Files are sent as multipart/form-data, not in JSON body
  // This interface documents the expected FormData structure
}

/**
 * Request body for /api/seedream/generate
 */
export interface GenerateRequest {
  uploadId: string;
  styleId: string;
  numOutputs?: number; // Default: 10
  customizations?: SeedreamCustomizations;
}

/**
 * Request body for /api/seedream/webhook (from Replicate)
 */
export interface WebhookRequest {
  id: string; // Replicate prediction ID
  status: 'succeeded' | 'failed' | 'canceled';
  output: string[] | null; // Array of image URLs from Replicate
  error: string | null;
  metrics?: {
    predict_time?: number;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Success response for /api/seedream/upload
 */
export interface UploadResponse {
  success: true;
  uploadId: string;
  images: UploadedImage[];
  expiresAt: string;
  message: string;
}

/**
 * Success response for /api/seedream/generate
 */
export interface GenerateResponse {
  success: true;
  jobId: string;
  status: 'pending';
  estimatedTime: string;
  pollUrl: string;
}

/**
 * Response for /api/seedream/status/:jobId (pending/processing)
 */
export interface StatusResponsePending {
  jobId: string;
  status: 'pending' | 'processing';
  progress: number; // 0-100
  estimatedTimeRemaining: string;
  createdAt: string;
}

/**
 * Response for /api/seedream/status/:jobId (completed)
 */
export interface StatusResponseCompleted {
  jobId: string;
  status: 'completed';
  progress: 100;
  outputs: OutputImage[];
  generationTime: number;
  completedAt: string;
}

/**
 * Response for /api/seedream/status/:jobId (failed)
 */
export interface StatusResponseFailed {
  jobId: string;
  status: 'failed';
  error: string;
  errorCode: string;
  suggestions: string[];
}

/**
 * Union type for all possible status responses
 */
export type StatusResponse = 
  | StatusResponsePending 
  | StatusResponseCompleted 
  | StatusResponseFailed;

/**
 * Success response for /api/seedream/webhook
 */
export interface WebhookResponse {
  success: true;
  jobId: string;
  status: string;
  message: string;
}

/**
 * Generic error response structure
 */
export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  errorCode: string;
  details?: Record<string, any>;
  suggestions?: string[];
  timestamp?: string;
}

// ============================================================================
// Replicate Service Types
// ============================================================================

/**
 * Input parameters for Seedream prediction
 */
export interface SeedreamInput {
  image: string | string[]; // Reference image URLs
  prompt: string;
  negative_prompt?: string;
  num_outputs?: number;
  seed?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
}

/**
 * Replicate prediction status
 */
export type PredictionStatus = 
  | 'starting' 
  | 'processing' 
  | 'succeeded' 
  | 'failed' 
  | 'canceled';

/**
 * Replicate prediction response
 */
export interface Prediction {
  id: string;
  status: PredictionStatus;
  output: string[] | null;
  error: string | null;
  metrics?: {
    predict_time?: number;
  };
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * File validation result
 */
export interface FileValidation {
  valid: boolean;
  error?: string;
}

/**
 * Request validation result
 */
export interface RequestValidation {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Retry configuration for API calls
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
}

/**
 * File upload constraints
 */
export interface UploadConstraints {
  maxFileSize: number; // bytes
  maxFiles: number;
  minFiles: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
}

// ============================================================================
// Metrics and Monitoring Types
// ============================================================================

/**
 * Generation metrics for monitoring and cost tracking
 */
export interface GenerationMetrics {
  jobId: string;
  userId: string;
  styleId: string;
  numOutputs: number;
  generationTimeSeconds: number;
  estimatedCostUsd: number;
  replicatePredictionId: string;
  success: boolean;
  errorMessage?: string;
  timestamp: string;
}

/**
 * Upload metrics for monitoring
 */
export interface UploadMetrics {
  uploadId: string;
  userId: string;
  fileCount: number;
  totalSizeBytes: number;
  uploadTimeSeconds: number;
  success: boolean;
  errorMessage?: string;
  timestamp: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a status response is completed
 */
export function isStatusCompleted(
  response: StatusResponse
): response is StatusResponseCompleted {
  return response.status === 'completed';
}

/**
 * Type guard to check if a status response is failed
 */
export function isStatusFailed(
  response: StatusResponse
): response is StatusResponseFailed {
  return response.status === 'failed';
}

/**
 * Type guard to check if a status response is pending/processing
 */
export function isStatusPending(
  response: StatusResponse
): response is StatusResponsePending {
  return response.status === 'pending' || response.status === 'processing';
}

/**
 * Type guard to check if a response is an error
 */
export function isErrorResponse(
  response: any
): response is ErrorResponse {
  return response && response.success === false && 'error' in response;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Partial job update for database operations
 */
export type JobUpdate = Partial<Pick<
  SeedreamJob,
  | 'status'
  | 'progress'
  | 'errorMessage'
  | 'outputImages'
  | 'generationTimeSeconds'
  | 'estimatedCostUsd'
  | 'startedAt'
  | 'completedAt'
  | 'replicatePredictionId'
>>;

/**
 * Job creation parameters
 */
export type JobCreate = Pick<
  SeedreamJob,
  'userId' | 'uploadId' | 'styleId' | 'numOutputs' | 'customizations'
>;

/**
 * Upload creation parameters
 */
export type UploadCreate = Pick<
  SeedreamUpload,
  'userId' | 'images'
>;
