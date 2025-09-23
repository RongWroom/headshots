import { z } from 'zod';

// Enhanced training configuration schema with optimized parameters
export const optimizedTrainingConfigSchema = z.object({
  // Basic parameters
  trigger_word: z.string().default("sks"),
  lora_type: z.enum(["subject", "style"]).default("subject"),
  
  // Core training parameters
  resolution: z.number().int().min(512).max(1024).default(1024),
  learning_rate: z.number().min(1e-6).max(1e-3).default(1e-4),
  max_train_steps: z.number().int().min(100).max(5000).default(1500),
  
  // LoRA parameters
  lora_rank: z.number().int().min(8).max(256).default(64),
  lora_alpha: z.number().int().min(8).max(256).default(64),
  
  // Training optimization
  train_batch_size: z.number().int().min(1).max(4).default(1),
  gradient_accumulation_steps: z.number().int().min(1).max(16).default(4),
  mixed_precision: z.enum(["fp16", "bf16"]).default("bf16"),
  use_8bit_adam: z.boolean().default(true),
  enable_xformers: z.boolean().default(true),
  
  // Scheduling and regularization
  save_steps: z.number().int().min(50).max(1000).default(500),
  warmup_steps: z.number().int().min(0).max(500).default(150),
  scheduler_type: z.enum(["cosine", "linear", "polynomial"]).default("cosine"),
  weight_decay: z.number().min(0).max(0.1).default(0.01),
  max_grad_norm: z.number().min(0.1).max(2.0).default(1.0),
  
  // Quality preferences
  quality_preset: z.enum(["basic", "standard", "high", "premium"]).optional(),
  user_preference: z.enum(["speed", "quality", "balanced"]).optional(),
  
  // A/B testing
  ab_test_id: z.string().optional(),
  variant_id: z.string().optional()
});

export const trainRequestSchema = z.object({
  imageUrls: z.array(z.string().url()).min(1, "At least one image is required"),
  modelName: z.string()
    .min(1, "Model name is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Model name must be lowercase alphanumeric with hyphens only (e.g., my-model-name)"),
  packSlug: z.enum(["actor-headshots", "corporate-headshots", "creative-headshots"]).optional(),
  trainingConfig: optimizedTrainingConfigSchema.optional()
});

// Legacy support for old training config format
export const legacyTrainingConfigSchema = z.object({
  trigger_word: z.string().default("sks"),
  lora_type: z.enum(["subject", "style"]).default("subject"),
  resolution: z.number().default(768),
  learning_rate: z.number().default(1e-6),
  training_steps: z.number().default(1000),
});

export type TrainRequest = z.infer<typeof trainRequestSchema>;
export type OptimizedTrainingConfig = z.infer<typeof optimizedTrainingConfigSchema>;
export type LegacyTrainingConfig = z.infer<typeof legacyTrainingConfigSchema>;

// Training quality assessment types
export interface TrainingQualityAssessment {
  imageCount: number;
  averageResolution: number;
  faceDetectionScore: number;
  imageVariety: number;
  lightingQuality: number;
  overallQuality: number;
  recommendedPreset: string;
  estimatedTime: string;
  estimatedCost: number;
}

// Training result types
export interface TrainingResult {
  trainingId: string;
  status: 'queued' | 'training' | 'completed' | 'failed';
  modelUrl?: string;
  triggerWord: string;
  qualityMetrics?: {
    facePreservation: number;
    imageSharpness: number;
    colorAccuracy: number;
    overallQuality: number;
  };
  trainingMetrics?: {
    actualTime: number;
    actualCost: number;
    convergenceRate: number;
    finalLoss: number;
  };
  abTestData?: {
    testId: string;
    variantId: string;
    parameters: OptimizedTrainingConfig;
  };
}
