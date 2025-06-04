import { z } from 'zod';

export const trainRequestSchema = z.object({
  imageUrls: z.array(z.string().url()).min(1, "At least one image is required"),
  modelName: z.string()
    .min(1, "Model name is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Model name must be lowercase alphanumeric with hyphens only (e.g., my-model-name)"),
  packSlug: z.enum(["actor-headshots", "corporate-headshots"]).optional(),
  trainingConfig: z.object({
    trigger_word: z.string().default("sks"),
    lora_type: z.enum(["subject", "style"]).default("subject"),
    resolution: z.number().default(768),
    learning_rate: z.number().default(1e-6),
    training_steps: z.number().default(1000),
  }).optional()
});

export type TrainRequest = z.infer<typeof trainRequestSchema>;
