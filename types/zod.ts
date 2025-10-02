import { z } from "zod";

export const fileUploadFormSchema = z.object({
  name: z
    .string()
    .min(1, "Model name is required")
    .max(50)
    .regex(/^[a-zA-Z0-9\-_ ]+$/, "Only letters, numbers, spaces, hyphens and underscores are allowed"),
  type: z.string().min(1).max(50),
  triggerWord: z
    .string()
    .max(20)
    .regex(/^[a-zA-Z0-9]*$/, "Only letters and numbers are allowed, no spaces")
    .optional()
});