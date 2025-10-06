# Design Document

## Overview

This design implements a professional headshot generation service using Replicate's Seedream API. The architecture follows a simple async job pattern: users upload photos to Vercel Blob, the system calls Replicate's API with webhook callbacks, and results are stored back to Vercel Blob and Supabase.

The key innovation is using **fixed seeds per style** to achieve consistent backgrounds across all users while Seedream handles facial accuracy through its multi-image reference capability.

## Architecture

### High-Level Flow

```
User Upload → Vercel Blob → Supabase Job Record → Replicate API
                                                         ↓
User Downloads ← Vercel Blob ← Webhook Handler ← Replicate Webhook
```

### Component Diagram

```
┌─────────────────┐
│   Next.js App   │
│   (Frontend)    │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────────────────────────┐
│              API Routes (Backend)                    │
│                                                      │
│  /api/seedream/upload     - Upload images           │
│  /api/seedream/generate   - Start generation        │
│  /api/seedream/status/:id - Poll job status         │
│  /api/seedream/webhook    - Receive Replicate       │
└──────┬──────────────────────┬───────────────────────┘
       │                      │
       ↓                      ↓
┌──────────────┐      ┌──────────────┐
│ Vercel Blob  │      │   Supabase   │
│   Storage    │      │   Database   │
└──────────────┘      └──────────────┘
       ↑                      ↑
       │                      │
       └──────────┬───────────┘
                  │
                  ↓
         ┌────────────────┐
         │  Replicate API │
         │   (Seedream)   │
         └────────────────┘
```

## Components and Interfaces

### 1. Upload API (`/api/seedream/upload`)

**Purpose:** Handle image uploads to Vercel Blob

**Request:**
```typescript
POST /api/seedream/upload
Content-Type: multipart/form-data

{
  files: File[] // 1-5 images
}
```

**Response:**
```typescript
{
  success: true,
  uploadId: string,
  images: [
    {
      filename: string,
      blobUrl: string,
      size: number
    }
  ]
}
```

**Implementation:**
- Use `@vercel/blob` package's `put()` method
- Generate unique blob paths: `seedream-uploads/{userId}/{uploadId}/{filename}`
- Validate file types (JPEG, PNG, WebP) and sizes (max 10MB)
- Store upload metadata in Supabase `seedream_uploads` table
- Return blob URLs for use in generation request

### 2. Generate API (`/api/seedream/generate`)

**Purpose:** Initiate headshot generation via Replicate

**Request:**
```typescript
POST /api/seedream/generate
Content-Type: application/json

{
  uploadId: string,
  styleId: string, // e.g., "corporate-blue", "warm-studio"
  numOutputs?: number, // default 10
  customizations?: {
    removeJewelry?: boolean,
    removeGlasses?: boolean,
    removePiercings?: boolean,
    cleanBackground?: boolean
  }
}
```

**Response:**
```typescript
{
  success: true,
  jobId: string,
  status: "pending",
  estimatedTime: "60-90 seconds",
  pollUrl: "/api/seedream/status/{jobId}"
}
```

**Implementation:**
- Fetch upload metadata and image URLs from Supabase
- Fetch style configuration (prompt, seed) from style catalog
- Build custom negative prompt based on user selections:
  ```typescript
  const negativePrompts = [style.negativePrompt]
  if (customizations?.removeJewelry) {
    negativePrompts.push("jewelry, earrings, necklace, rings, bracelet")
  }
  if (customizations?.removeGlasses) {
    negativePrompts.push("glasses, eyeglasses, sunglasses")
  }
  if (customizations?.removePiercings) {
    negativePrompts.push("piercings, nose ring, lip ring, eyebrow ring")
  }
  if (customizations?.cleanBackground) {
    negativePrompts.push("cluttered, messy, distracting elements")
  }
  const finalNegativePrompt = negativePrompts.join(", ")
  ```
- Call Replicate API with:
  ```typescript
  {
    version: "bytedance/seedream:latest",
    input: {
      image: imageUrls, // Array of reference images
      prompt: style.prompt,
      negative_prompt: finalNegativePrompt,
      num_outputs: 10,
      seed: style.seed, // Fixed seed for consistency
      guidance_scale: 7.5,
      num_inference_steps: 50
    },
    webhook: `${SITE_URL}/api/seedream/webhook`,
    webhook_events_filter: ["completed"]
  }
  ```
- Create job record in `seedream_jobs` table
- Return job ID for polling

### 3. Status API (`/api/seedream/status/:jobId`)

**Purpose:** Allow frontend to poll job status

**Request:**
```typescript
GET /api/seedream/status/{jobId}
```

**Response (Pending):**
```typescript
{
  jobId: string,
  status: "pending" | "processing",
  progress: number, // 0-100
  estimatedTimeRemaining: string,
  createdAt: string
}
```

**Response (Completed):**
```typescript
{
  jobId: string,
  status: "completed",
  progress: 100,
  outputs: [
    {
      url: string, // Vercel Blob URL
      thumbnail: string
    }
  ],
  generationTime: number,
  completedAt: string
}
```

**Response (Failed):**
```typescript
{
  jobId: string,
  status: "failed",
  error: string,
  errorCode: string,
  suggestions: string[]
}
```

**Implementation:**
- Query `seedream_jobs` table by job ID
- Verify user owns the job (RLS policy)
- If status is "processing" and no webhook received after 2 minutes, poll Replicate API
- Return current status and outputs if available

### 4. Webhook API (`/api/seedream/webhook`)

**Purpose:** Receive completion notifications from Replicate

**Request:**
```typescript
POST /api/seedream/webhook
X-Webhook-Signature: <signature>

{
  id: string, // Replicate prediction ID
  status: "succeeded" | "failed",
  output: string[], // Array of image URLs from Replicate
  error: string | null,
  metrics: {
    predict_time: number
  }
}
```

**Implementation:**
- Verify webhook signature using `REPLICATE_WEBHOOK_SECRET`
- Find job by Replicate prediction ID
- Download images from Replicate URLs
- Upload images to Vercel Blob: `seedream-outputs/{userId}/{jobId}/{index}.jpg`
- Update job record with output URLs and status
- Calculate and store cost estimate

### 5. Replicate Service (`lib/seedream-service.ts`)

**Purpose:** Encapsulate Replicate API interactions

**Interface:**
```typescript
class SeedreamService {
  async createPrediction(input: SeedreamInput): Promise<Prediction>
  async getPrediction(predictionId: string): Promise<Prediction>
  async cancelPrediction(predictionId: string): Promise<void>
}

interface SeedreamInput {
  image: string | string[], // Reference image URLs
  prompt: string,
  negative_prompt?: string,
  num_outputs?: number,
  seed?: number,
  guidance_scale?: number,
  num_inference_steps?: number
}

interface Prediction {
  id: string,
  status: "starting" | "processing" | "succeeded" | "failed",
  output: string[] | null,
  error: string | null,
  metrics: {
    predict_time: number
  }
}
```

**Implementation:**
- Use Replicate Node.js SDK
- Handle authentication with `REPLICATE_API_TOKEN`
- Implement retry logic for transient failures
- Parse and normalize API responses

### 6. Style Catalog (`lib/style-catalog.ts`)

**Purpose:** Define consistent style configurations

**Interface:**
```typescript
interface Style {
  id: string,
  name: string,
  description: string,
  prompt: string,
  negativePrompt: string,
  seed: number, // Fixed seed for consistency
  previewImage: string
}

const STYLE_CATALOG: Style[] = [
  {
    id: "corporate-blue",
    name: "Corporate Blue",
    description: "Professional blue gradient background",
    prompt: "professional corporate headshot, blue gradient background, studio lighting, sharp focus, high quality, 8k",
    negativePrompt: "casual, outdoor, messy, blurry, low quality",
    seed: 42,
    previewImage: "/styles/corporate-blue.jpg"
  },
  {
    id: "warm-studio",
    name: "Warm Studio",
    description: "Warm-toned studio background",
    prompt: "professional headshot, warm beige background, soft studio lighting, natural look, high quality, 8k",
    negativePrompt: "cold, harsh lighting, outdoor, casual",
    seed: 123,
    previewImage: "/styles/warm-studio.jpg"
  },
  // More styles...
]
```

## Data Models

### Supabase Tables

#### `seedream_uploads`
```sql
CREATE TABLE seedream_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  images JSONB NOT NULL, -- Array of {filename, blobUrl, size}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_seedream_uploads_user ON seedream_uploads(user_id);
CREATE INDEX idx_seedream_uploads_expires ON seedream_uploads(expires_at);
```

#### `seedream_jobs`
```sql
CREATE TABLE seedream_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  upload_id UUID NOT NULL REFERENCES seedream_uploads(id) ON DELETE CASCADE,
  
  -- Job configuration
  style_id TEXT NOT NULL,
  num_outputs INTEGER DEFAULT 10,
  customizations JSONB, -- {removeJewelry, removeGlasses, removePiercings, cleanBackground}
  
  -- Replicate tracking
  replicate_prediction_id TEXT UNIQUE,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  progress INTEGER DEFAULT 0, -- 0-100
  error_message TEXT,
  
  -- Results
  output_images JSONB, -- Array of {url, thumbnail}
  
  -- Metrics
  generation_time_seconds NUMERIC(6,2),
  estimated_cost_usd NUMERIC(6,4),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_seedream_jobs_user ON seedream_jobs(user_id);
CREATE INDEX idx_seedream_jobs_status ON seedream_jobs(status);
CREATE INDEX idx_seedream_jobs_replicate ON seedream_jobs(replicate_prediction_id);
```

### TypeScript Types

```typescript
// types/seedream.ts

export interface SeedreamUpload {
  id: string
  userId: string
  images: {
    filename: string
    blobUrl: string
    size: number
  }[]
  createdAt: string
  expiresAt: string
}

export interface SeedreamJob {
  id: string
  userId: string
  uploadId: string
  styleId: string
  numOutputs: number
  customizations: {
    removeJewelry?: boolean
    removeGlasses?: boolean
    removePiercings?: boolean
    cleanBackground?: boolean
  } | null
  replicatePredictionId: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  errorMessage: string | null
  outputImages: {
    url: string
    thumbnail: string
  }[] | null
  generationTimeSeconds: number | null
  estimatedCostUsd: number | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  updatedAt: string
}
```

## Error Handling

### Error Categories

1. **Validation Errors (400)**
   - Invalid file format
   - File too large
   - Invalid style ID
   - Missing required fields

2. **Authentication Errors (401)**
   - User not authenticated
   - Invalid session

3. **Authorization Errors (403)**
   - User doesn't own the job
   - Invalid webhook signature

4. **Not Found Errors (404)**
   - Job not found
   - Upload not found

5. **Rate Limit Errors (429)**
   - Too many requests
   - Replicate rate limit

6. **Server Errors (500)**
   - Replicate API failure
   - Vercel Blob upload failure
   - Database errors

### Retry Strategy

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2
}

async function withRetry<T>(
  fn: () => Promise<T>,
  config = RETRY_CONFIG
): Promise<T> {
  let lastError: Error
  let delay = config.initialDelay
  
  for (let i = 0; i < config.maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (i < config.maxRetries - 1) {
        await sleep(delay)
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay)
      }
    }
  }
  
  throw lastError
}
```

## Testing Strategy

### Unit Tests

1. **Style Catalog**
   - Verify all styles have required fields
   - Validate seed uniqueness
   - Test style lookup by ID

2. **Seedream Service**
   - Mock Replicate API responses
   - Test error handling
   - Verify retry logic

3. **Webhook Signature Verification**
   - Test valid signatures
   - Test invalid signatures
   - Test missing signatures

### Integration Tests

1. **Upload Flow**
   - Upload single image
   - Upload multiple images
   - Test file validation
   - Test Vercel Blob integration

2. **Generation Flow**
   - Create job with valid upload
   - Verify Replicate API call
   - Test webhook processing
   - Verify output storage

3. **Status Polling**
   - Poll pending job
   - Poll completed job
   - Poll failed job
   - Test rate limiting

### End-to-End Tests

1. **Complete User Journey**
   - Upload images
   - Select style
   - Generate headshots
   - Poll until complete
   - Download results

2. **Error Scenarios**
   - Invalid file upload
   - Replicate API failure
   - Webhook delivery failure
   - Fallback to polling

3. **Consistency Testing**
   - Generate headshots for 5 different users with same style
   - Verify backgrounds are visually identical
   - Verify faces are different but backgrounds match

## Performance Considerations

### Optimization Strategies

1. **Image Upload**
   - Use streaming uploads for large files
   - Compress images client-side before upload
   - Parallel uploads for multiple files

2. **Replicate API**
   - Batch multiple reference images in single request
   - Use optimal num_outputs (10) for cost efficiency
   - Cache style configurations

3. **Webhook Processing**
   - Process webhook asynchronously
   - Use background jobs for image downloads
   - Implement idempotency for duplicate webhooks

4. **Status Polling**
   - Implement exponential backoff
   - Cache recent status responses (5 seconds)
   - Use Server-Sent Events for real-time updates (future enhancement)

### Estimated Timings

- Image upload: 2-5 seconds (per image)
- Replicate processing: 60-90 seconds
- Webhook delivery: 1-2 seconds
- Image download & storage: 5-10 seconds
- **Total user wait time: 70-110 seconds**

## Cost Analysis

### Replicate Seedream Pricing

- Estimated cost: $0.10 per generation (10 outputs)
- Monthly volume: 1000 generations = $100
- With 20% margin: Charge users $0.12 per generation

### Vercel Blob Pricing

- Storage: $0.15/GB/month
- Bandwidth: $0.40/GB
- Estimated: $0.01 per generation (storage + bandwidth)

### Total Cost Per Generation

- Replicate: $0.10
- Vercel Blob: $0.01
- **Total: $0.11 per generation**
- **Suggested user price: $0.15-$0.20**

## Security Considerations

1. **Authentication**
   - All API routes require Supabase authentication
   - Use RLS policies to enforce user ownership

2. **Webhook Security**
   - Verify webhook signatures
   - Use HTTPS only
   - Implement idempotency keys

3. **File Upload Security**
   - Validate file types and sizes
   - Scan for malicious content
   - Use unique, unguessable blob paths

4. **Rate Limiting**
   - Limit uploads: 10 per hour per user
   - Limit generations: 5 per hour per user
   - Limit status polls: 30 per minute per job

5. **Data Privacy**
   - Auto-delete uploads after 24 hours
   - Allow users to delete their generations
   - Don't log image contents

## Deployment Checklist

- [ ] Set up Vercel Blob storage
- [ ] Configure Replicate API token
- [ ] Create Supabase tables and RLS policies
- [ ] Deploy API routes to Vercel
- [ ] Configure webhook URL in Replicate
- [ ] Set up monitoring and alerting
- [ ] Test with real user photos
- [ ] Verify background consistency across users
- [ ] Load test with concurrent requests
- [ ] Document API for frontend team
