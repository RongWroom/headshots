# Design Document

## Overview

This document outlines the technical design for a professional AI headshot generation system using ComfyUI deployed on RunPod. The system processes 5-10 user photos, removes backgrounds, analyzes facial features, and generates high-quality professional headshots in the DanDan photography style using Seedream 4.0.

The design prioritizes quality, reliability, and cost-effectiveness while maintaining the photographer's unique aesthetic.

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Next.js App   │
│   (Frontend)    │
└────────┬────────┘
         │
         │ 1. Upload photos
         ▼
┌─────────────────────────────────────────┐
│      Vercel Blob Storage                │
│  - Store user reference images          │
│  - Returns: Array of image URLs         │
└────────┬────────────────────────────────┘
         │
         │ 2. Create generation job
         ▼
┌─────────────────────────────────────────┐
│         API Routes (Next.js)            │
│  - /api/headshots/generate              │
│  - /api/headshots/status/:jobId         │
│  - /api/headshots/webhook               │
└────────┬────────────────────────────────┘
         │
         │ 3. Store job record
         ▼
┌─────────────────────────────────────────┐
│         Supabase Database               │
│  - generation_jobs table                │
│  - Store: status, progress, image URLs  │
└────────┬────────────────────────────────┘
         │
         │ 4. Trigger generation
         ▼
┌─────────────────────────────────────────┐
│      RunPod Serverless Endpoint         │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │      ComfyUI Workflow             │ │
│  │                                   │ │
│  │  1. Load Images (from URLs)      │ │
│  │  2. RMBG (background removal)    │ │
│  │  3. CLIP Interrogator (analyze)  │ │
│  │  4. Seedream 4.0 (generate)      │ │
│  │  5. (Optional) LoRA refinement   │ │
│  │  6. Return base64 images         │ │
│  └───────────────────────────────────┘ │
│                                         │
└────────┬────────────────────────────────┘
         │
         │ 5. Webhook with results
         ▼
┌─────────────────────────────────────────┐
│    /api/headshots/webhook               │
│  - Receives generated images (base64)  │
│  - Uploads to Vercel Blob Storage       │
│  - Updates job status in Supabase       │
└─────────────────────────────────────────┘
         │
         │ 6. Poll for status
         ▼
┌─────────────────────────────────────────┐
│   Frontend displays results             │
│  - Shows progress updates               │
│  - Displays generated headshots         │
└─────────────────────────────────────────┘
```

### Component Flow (Detailed)

1. **User uploads photos (Frontend)**
   - User selects 5-10 photos
   - Frontend validates: count, file size, format
   - Photos uploaded directly to Vercel Blob Storage
   - Returns: Array of Vercel Blob URLs

2. **Create generation job (API)**
   - Frontend calls `/api/headshots/generate` with Blob URLs
   - API creates job record in Supabase (status: "queued")
   - Returns: jobId for polling

3. **Trigger RunPod generation (API)**
   - API calls RunPod endpoint with:
     - Reference image URLs (from Vercel Blob)
     - Generation parameters
     - Webhook URL for progress updates
   - RunPod starts processing asynchronously

4. **ComfyUI processes images (RunPod)**
   - Downloads images from Vercel Blob URLs
   - Executes workflow (background removal, analysis, generation)
   - Sends progress webhooks to API
   - Returns generated images as base64 strings

5. **Store results (Webhook)**
   - Webhook receives base64 images from RunPod
   - Converts base64 to blobs
   - Uploads generated headshots to Vercel Blob Storage
   - Updates job record with image URLs
   - Marks job as "completed"

6. **Frontend polls and displays (Frontend)**
   - Polls `/api/headshots/status/:jobId` every 2 seconds
   - Shows progress updates to user
   - When complete, displays generated headshots
   - User can download or use images

## Components and Interfaces

### 1. Frontend Component: HeadshotGenerationZone

**Purpose:** User interface for uploading photos and monitoring generation

**Interface:**
```typescript
interface HeadshotGenerationZoneProps {
  userId: string;
  onComplete: (images: string[]) => void;
}

interface GenerationState {
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
  jobId?: string;
  images?: string[];
}
```

**Responsibilities:**
- Photo upload (5-10 images, validation)
- Progress display with real-time updates
- Result display with download options
- Error handling and retry logic

### 2. API Route: /api/headshots/generate

**Purpose:** Initiate headshot generation job

**Request:**
```typescript
POST /api/headshots/generate
{
  userId: string;
  referenceImages: string[]; // 5-10 Vercel Blob URLs
  numOutputs: number; // Default 4
  styleIntensity?: number; // 0-1, default 0.8
}
```

**Response:**
```typescript
{
  success: boolean;
  jobId: string;
  status: 'queued';
  estimatedTime: string; // "60-120 seconds"
  pollUrl: string; // "/api/headshots/status/{jobId}"
}
```

**Responsibilities:**
- Validate user authentication
- Validate photo count (5-10)
- Create job record in database
- Call RunPod endpoint (async)
- Return job ID for polling

### 3. API Route: /api/headshots/status/:jobId

**Purpose:** Poll for job status and results

**Request:**
```typescript
GET /api/headshots/status/:jobId
```

**Response:**
```typescript
{
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string; // "Removing backgrounds..." etc
  images?: string[]; // Available when status = 'completed'
  error?: string; // Available when status = 'failed'
  createdAt: string;
  completedAt?: string;
}
```

**Responsibilities:**
- Verify user owns the job
- Return current status and progress
- Return images when complete

### 4. API Route: /api/headshots/webhook

**Purpose:** Receive progress updates from RunPod

**Request:**
```typescript
POST /api/headshots/webhook
{
  jobId: string;
  status: string;
  progress: number;
  message: string;
  images?: string[];
  error?: string;
}
```

**Responsibilities:**
- Validate webhook signature
- Update job record in database
- Upload images to Vercel Blob if provided
- Handle completion and errors

### 5. RunPod ComfyUI Workflow

**Purpose:** Execute the headshot generation pipeline

**Input:**
```json
{
  "reference_images": ["url1", "url2", ...], // 5-10 URLs
  "num_outputs": 4,
  "style_intensity": 0.8,
  "webhook_url": "https://yourapp.com/api/headshots/webhook",
  "job_id": "uuid"
}
```

**Output:**
```json
{
  "status": "success",
  "images": ["base64_image1", "base64_image2", ...],
  "metadata": {
    "generation_time": 87.5,
    "detected_features": {
      "gender": "male",
      "skin_tone": "medium",
      "hair_color": "brown",
      "age_range": "30-40"
    }
  }
}
```

**Workflow Nodes:**

1. **Load Images Node**
   - Downloads reference images from URLs
   - Validates image format and size
   - Outputs: Image tensors

2. **RMBG Node** (Background Removal)
   - Removes background from each image
   - Uses RMBG-v1.4 or BiRefNet model
   - Outputs: Transparent PNG images

3. **CLIP Interrogator Node**
   - Analyzes facial features
   - Detects: gender, skin tone, hair, eyes, age
   - Generates feature description
   - Outputs: Feature dictionary

4. **Prompt Builder Node** (Custom)
   - Combines detected features with DanDan style
   - Template: "A professional headshot portrait of a {gender} with {skin_tone} skin, {hair_color} hair, {age_range} years old, in dandan style. Cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8, muted tones (brown, gray, green, blue), soft directional lighting, professional serious expression, looking directly at camera, body angled 45 degrees, face toward camera, photorealistic skin textures, sharp eyes, natural hair color, subtle shadows, contemplative mood"
   - Outputs: Final prompt string

5. **Seedream 4.0 Node**
   - Model: bytedance/seedream-4
   - Input: All background-removed images + prompt
   - Parameters:
     - size: "2K"
     - width: 1728
     - height: 2304
     - aspect_ratio: "3:4"
     - max_images: 4
     - prompt_strength: 0.85
     - sequential_image_generation: "disabled"
   - Outputs: 4 high-res headshots

6. **Optional: LoRA Refinement Node**
   - Only if style_intensity > 0.5
   - Applies DanDan-Actor LoRA via img2img
   - Low strength (0.3-0.4) to preserve face
   - Enhances photography aesthetic
   - Outputs: Style-refined images

7. **Save Images Node**
   - Converts to base64 or uploads to storage
   - Sends webhook with results
   - Outputs: Image URLs or base64 strings

**Progress Webhooks:**
- 10%: "Loading reference images..."
- 20%: "Removing backgrounds..."
- 40%: "Analyzing facial features..."
- 50%: "Generating professional headshots..."
- 80%: "Refining photography style..."
- 100%: "Complete!"

## Data Models

### generation_jobs Table

```sql
CREATE TABLE generation_jobs (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status VARCHAR(20) NOT NULL, -- 'queued', 'processing', 'completed', 'failed'
  progress INTEGER DEFAULT 0, -- 0-100
  progress_message TEXT DEFAULT 'Queued',
  
  -- Input data
  reference_images TEXT[] NOT NULL, -- Array of Vercel Blob URLs
  num_outputs INTEGER DEFAULT 4,
  style_intensity DECIMAL(3,2) DEFAULT 0.80,
  
  -- Output data
  output_images TEXT[], -- Array of generated image URLs
  detected_features JSONB, -- Facial features detected by CLIP
  
  -- Metadata
  generation_time_seconds DECIMAL(5,2), -- How long it took
  estimated_cost_usd DECIMAL(5,4), -- Cost tracking
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_user_status (user_id, status),
  INDEX idx_created_at (created_at DESC)
);
```

### RunPod Endpoint Configuration

```json
{
  "name": "comfyui-headshot-generator",
  "image": "runpod/comfyui:latest",
  "gpu_type": "NVIDIA A40",
  "min_workers": 0,
  "max_workers": 3,
  "idle_timeout": 300,
  "environment": {
    "COMFYUI_WORKFLOW": "/workspace/workflows/headshot_generation.json",
    "WEBHOOK_SECRET": "your-secret-key",
    "DANDAN_LORA_URL": "https://replicate.delivery/xezq/.../trained_model.tar"
  },
  "volume": {
    "models": "/workspace/models",
    "workflows": "/workspace/workflows"
  }
}
```

## Error Handling

### Error Scenarios and Responses

1. **Invalid Photo Count**
   - Error: "Please upload between 5-10 photos"
   - HTTP 400
   - User action: Upload more/fewer photos

2. **Background Removal Failure**
   - Retry with adjusted parameters
   - If still fails: Continue with original images
   - Log warning but don't fail job

3. **Face Detection Failure**
   - Error: "Could not detect faces in uploaded photos"
   - HTTP 400
   - User action: Upload clearer face photos

4. **Seedream Generation Failure**
   - Retry once with adjusted parameters
   - If still fails: Mark job as failed
   - Error message: "Generation failed. Please try again."

5. **RunPod Endpoint Unavailable**
   - Queue job for retry
   - Retry every 30 seconds for 5 minutes
   - If still unavailable: Mark as failed
   - Error: "Service temporarily unavailable"

6. **NSFW Content Detected**
   - Filter out NSFW images
   - Regenerate if all images are NSFW
   - Log incident for review

7. **Timeout (>5 minutes)**
   - Mark job as failed
   - Error: "Generation timed out. Please try again."
   - Investigate RunPod logs

## Testing Strategy

### Unit Tests

1. **API Route Tests**
   - Test job creation with valid/invalid inputs
   - Test status polling with valid/invalid job IDs
   - Test webhook signature validation
   - Test error handling for each scenario

2. **Database Tests**
   - Test job CRUD operations
   - Test concurrent job updates
   - Test query performance with large datasets

### Integration Tests

1. **End-to-End Workflow**
   - Upload 5-10 test photos
   - Verify job creation
   - Monitor progress updates
   - Verify image generation
   - Verify image storage
   - Verify job completion

2. **RunPod Integration**
   - Test endpoint availability
   - Test workflow execution
   - Test webhook delivery
   - Test error scenarios

### Quality Assurance Tests

1. **Face Consistency Testing**
   - Test with 10 different people
   - Manual review: Does generated face match input?
   - Target: 90%+ recognizable

2. **Style Accuracy Testing**
   - Compare generated images to DanDan portfolio
   - Manual review: Does style match?
   - Target: 95%+ style match

3. **Load Testing**
   - Simulate 10 concurrent users
   - Verify no degradation in quality
   - Verify reasonable queue times

4. **Cost Testing**
   - Track generation costs over 100 jobs
   - Verify average cost per generation
   - Target: <$0.30 per 4-image batch

## Performance Considerations

### Optimization Strategies

1. **Image Processing**
   - Resize uploaded images to max 2048px before sending to RunPod
   - Use WebP format for storage (smaller file size)
   - Lazy load images in frontend

2. **RunPod Scaling**
   - Start with min_workers=0 to save costs
   - Scale up to max_workers=3 during peak times
   - Monitor queue length and adjust

3. **Database Queries**
   - Index on (user_id, status) for fast job lookups
   - Index on created_at for recent jobs
   - Paginate job history queries

4. **Caching**
   - Cache CLIP Interrogator results for similar faces
   - Cache background-removed images
   - Cache generated prompts

5. **Webhook Reliability**
   - Implement retry logic with exponential backoff
   - Store webhook payloads for debugging
   - Monitor webhook delivery success rate

## Security Considerations

1. **Authentication**
   - All API routes require valid Supabase session
   - Verify user owns the job before returning results

2. **Input Validation**
   - Validate image URLs are from Vercel Blob
   - Validate image file types (JPEG, PNG only)
   - Validate image sizes (max 10MB per image)

3. **Webhook Security**
   - Validate webhook signature using HMAC
   - Only accept webhooks from RunPod IPs
   - Rate limit webhook endpoint

4. **Content Safety**
   - Use NSFW filter on generated images
   - Log and review flagged content
   - Implement user reporting system

5. **Cost Protection**
   - Limit generations per user per day (e.g., 10)
   - Implement rate limiting on API routes
   - Monitor for abuse patterns

## Deployment Plan

### Phase 1: RunPod Setup
1. Create RunPod account and configure billing
2. Build custom ComfyUI Docker image with required nodes
3. Upload DanDan LoRA to RunPod storage
4. Create serverless endpoint
5. Test endpoint with sample workflow

### Phase 2: Database Migration
1. Create generation_jobs table in Supabase
2. Add indexes for performance
3. Set up Row Level Security policies
4. Test CRUD operations

### Phase 3: API Development
1. Implement /api/headshots/generate
2. Implement /api/headshots/status/:jobId
3. Implement /api/headshots/webhook
4. Add error handling and logging
5. Write unit tests

### Phase 4: Frontend Development
1. Create HeadshotGenerationZone component
2. Implement photo upload with validation
3. Implement progress polling
4. Implement result display
5. Add error handling and retry logic

### Phase 5: Testing
1. End-to-end testing with test photos
2. Quality assurance with 10 different people
3. Load testing with concurrent users
4. Cost analysis and optimization

### Phase 6: Launch
1. Deploy to production
2. Monitor logs and metrics
3. Gather user feedback
4. Iterate and improve

## Cost Analysis

### Estimated Costs per Generation

**RunPod (GPU time):**
- A40 GPU: ~$0.79/hour
- Average generation time: 90 seconds
- Cost per generation: ~$0.02

**Seedream API (if using Replicate):**
- Alternative: Use Seedream via Replicate API
- Cost: ~$0.10 per generation
- Total: ~$0.10

**Storage (Vercel Blob):**
- 4 images × 2MB each = 8MB
- Cost: ~$0.001 per generation

**Total Cost per Generation: ~$0.10-0.12**

**Monthly Costs (100 generations/month):**
- Generation: $10-12
- Storage: $0.10
- Database: Free (Supabase free tier)
- Total: ~$10-12/month

**Scaling (1000 generations/month):**
- Generation: $100-120
- Storage: $1
- Database: $25 (Supabase Pro)
- Total: ~$125-150/month

## Future Enhancements

1. **Multiple Style Options**
   - Allow users to choose from different photography styles
   - Train additional LoRAs for variety

2. **Advanced Customization**
   - Let users specify: background color, clothing, expression
   - Provide style intensity slider

3. **Batch Processing**
   - Generate headshots for multiple people at once
   - Team/company headshot packages

4. **Video Headshots**
   - Generate short video clips (3-5 seconds)
   - Animated professional portraits

5. **AI Retouching**
   - Automatic skin smoothing
   - Blemish removal
   - Teeth whitening

6. **Style Transfer**
   - Apply different photography styles to existing headshots
   - "Try before you buy" preview mode
