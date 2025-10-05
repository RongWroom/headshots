# Headshots Generation API Implementation

## Overview

This document describes the implementation of Task 3: "Create headshot generation API endpoint" from the ComfyUI Headshot Generation specification.

## What Was Implemented

### Task 3.1: POST /api/headshots/generate Endpoint

**Location:** `app/api/headshots/generate/route.ts`

**Features:**
- ✅ User authentication validation using Supabase session
- ✅ Request body validation:
  - `referenceImages`: Array of 5-10 Vercel Blob URLs
  - `numOutputs`: Optional, defaults to 4 (1-10 range)
  - `styleIntensity`: Optional, defaults to 0.8 (0-1 range)
- ✅ Creates job record in `generation_jobs` table with status "queued"
- ✅ Calls RunPod endpoint asynchronously (fire-and-forget pattern)
- ✅ Returns response with:
  - `success`: boolean
  - `jobId`: string (for polling)
  - `status`: "queued"
  - `estimatedTime`: "60-120 seconds"
  - `pollUrl`: "/api/headshots/status/{jobId}"

**Request Example:**
```json
POST /api/headshots/generate
{
  "referenceImages": [
    "https://blob.vercel-storage.com/photo1.jpg",
    "https://blob.vercel-storage.com/photo2.jpg",
    "https://blob.vercel-storage.com/photo3.jpg",
    "https://blob.vercel-storage.com/photo4.jpg",
    "https://blob.vercel-storage.com/photo5.jpg"
  ],
  "numOutputs": 4,
  "styleIntensity": 0.8
}
```

**Response Example:**
```json
{
  "success": true,
  "jobId": "123",
  "status": "queued",
  "estimatedTime": "60-120 seconds",
  "pollUrl": "/api/headshots/status/123",
  "message": "Headshot generation job created successfully"
}
```

### Task 3.2: Error Handling for Invalid Inputs

**Implemented Error Cases:**

1. **400 - Too Few/Many Photos**
   - Returns error if photo count is not between 5-10
   - Error message: "referenceImages must contain between 5-10 URLs"

2. **400 - Invalid URLs**
   - Returns error if URLs are not from Vercel Blob Storage
   - Checks for `blob.vercel-storage.com` or `public.blob.vercel-storage.com`
   - Error message: "All image URLs must be from Vercel Blob Storage"

3. **401 - Unauthenticated**
   - Returns error if user is not authenticated
   - Error message: "Please sign in to generate headshots"
   - Suggestions: "Sign in to your account", "Check if your session has expired"

4. **500 - Database Error**
   - Returns error if job creation fails
   - Error message: "Failed to create generation job"
   - Automatically updates job status to "failed" if RunPod call fails

5. **500 - Configuration Error**
   - Returns error if RunPod endpoint is not configured
   - Error message: "RunPod endpoint not configured"

**Error Response Format:**
```json
{
  "error": "Validation failed",
  "message": "Request data does not meet requirements",
  "code": "VALIDATION_ERROR",
  "timestamp": "2025-05-10T12:00:00.000Z",
  "requestId": "headshots_generate_api_1234567890_abc123",
  "userId": "user-uuid",
  "details": {
    "validationErrors": ["referenceImages must contain between 5-10 URLs"]
  },
  "suggestions": ["Upload between 5-10 photos"]
}
```

### Task 3.3: Request Logging and Monitoring

**Logging Features:**
- ✅ All requests logged with:
  - `user_id`: User identifier
  - `timestamp`: ISO 8601 timestamp
  - `parameters`: Request parameters (imageCount, numOutputs, styleIntensity)
  - `requestId`: Unique request identifier
- ✅ Success/failure tracking through Logger class
- ✅ Metrics recording for monitoring:
  - Operation: `generate_headshots`
  - Success/failure status
  - Error messages for failures

**Log Examples:**

```
[HEADSHOTS_GENERATE_API_INFO] AUTH_CHECK_START: {
  "requestId": "headshots_generate_api_1234567890_abc123",
  "endpoint": "HEADSHOTS_GENERATE_API",
  "stage": "AUTH_CHECK_START",
  "timestamp": "2025-05-10T12:00:00.000Z"
}

[HEADSHOTS_GENERATE_API_SUCCESS] AUTH_SUCCESS: {
  "requestId": "headshots_generate_api_1234567890_abc123",
  "userId": "user-uuid",
  "endpoint": "HEADSHOTS_GENERATE_API",
  "stage": "AUTH_SUCCESS",
  "timestamp": "2025-05-10T12:00:01.000Z",
  "data": {
    "userId": "user-uuid",
    "userEmail": "user@example.com"
  }
}

[HEADSHOTS_GENERATE_API_SUCCESS] GENERATION_JOB_CREATED: {
  "requestId": "headshots_generate_api_1234567890_abc123",
  "userId": "user-uuid",
  "endpoint": "HEADSHOTS_GENERATE_API",
  "stage": "GENERATION_JOB_CREATED",
  "timestamp": "2025-05-10T12:00:02.000Z",
  "data": {
    "jobId": "123",
    "pollUrl": "/api/headshots/status/123",
    "estimatedTime": "60-120 seconds"
  }
}
```

## Environment Variables

Added to `.env.example`:

```bash
# RUNPOD COMFYUI CONFIGURATION (For headshot generation)
RUNPOD_COMFYUI_ENDPOINT=your_runpod_comfyui_endpoint
RUNPOD_API_KEY=your_runpod_api_key
```

## Database Requirements

The endpoint uses the existing `generation_jobs` table with the following schema:

```sql
CREATE TABLE public.generation_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'::text,
  progress INTEGER NOT NULL DEFAULT 0,
  progress_message TEXT NULL DEFAULT 'Queued'::text,
  reference_images TEXT[] NOT NULL,
  num_outputs INTEGER NOT NULL DEFAULT 4,
  style_intensity NUMERIC(3, 2) NULL DEFAULT 0.80,
  output_images TEXT[] NULL,
  detected_features JSONB NULL,
  generation_time_seconds NUMERIC(5, 2) NULL,
  estimated_cost_usd NUMERIC(5, 4) NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE NULL,
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT generation_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT generation_jobs_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_generation_jobs_user_status ON public.generation_jobs (user_id, status);
CREATE INDEX idx_generation_jobs_created_at ON public.generation_jobs (created_at DESC);
CREATE INDEX idx_generation_jobs_status ON public.generation_jobs (status);
```

**Note:** ✅ This table already exists in the database.

## Testing

A test script has been created: `test-headshots-generate-api.js`

**Run tests:**
```bash
node test-headshots-generate-api.js
```

**Test Coverage:**
- ✅ Authentication required (401)
- ✅ Too few images validation (400)
- ✅ Too many images validation (400)
- ✅ Invalid URLs validation (400)
- ✅ Invalid numOutputs validation (400)
- ✅ Invalid styleIntensity validation (400)
- ✅ Invalid JSON handling (400)

## Integration Points

### RunPod Integration

The endpoint makes an asynchronous POST request to the RunPod ComfyUI endpoint:

**Payload:**
```json
{
  "input": {
    "reference_images": ["url1", "url2", ...],
    "num_outputs": 4,
    "style_intensity": 0.8,
    "webhook_url": "https://yourapp.com/api/headshots/webhook",
    "job_id": "123"
  }
}
```

**Headers:**
```
Authorization: Bearer {RUNPOD_API_KEY}
Content-Type: application/json
```

### Database Integration

The endpoint interacts with Supabase:
1. **Authentication:** Uses `supabase.auth.getUser()` to validate session
2. **Job Creation:** Inserts record into `generation_jobs` table
3. **Job Updates:** Updates job status if RunPod call fails

### Webhook Integration

The endpoint provides a webhook URL to RunPod for progress updates:
- Webhook URL: `{SITE_URL}/api/headshots/webhook`
- Job ID is passed to RunPod for correlation

## Next Steps

To complete the headshot generation system, the following tasks are needed:

1. ✅ **Task 1:** `generation_jobs` table already exists in database
2. **Task 4:** Implement `/api/headshots/status/:jobId` polling endpoint
3. **Task 5:** Implement `/api/headshots/webhook` callback endpoint
4. ✅ **Task 6-7:** ComfyUI workflow appears complete in `runpod-comfyui-headshots/`
5. **Task 8:** Create frontend component

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 1.1:** User photo upload and processing (API accepts 5-10 photos)
- **Requirement 1.4:** Photo validation (count and URL validation)
- **Requirement 5.1:** Job record creation with status "queued"
- **Requirement 5.2:** Asynchronous RunPod call with webhook
- **Requirement 6.1:** Request logging with user_id, timestamp, parameters
- **Requirement 7.1:** Error handling for invalid inputs

## Architecture

```
┌─────────────────┐
│   Frontend      │
└────────┬────────┘
         │ POST /api/headshots/generate
         ▼
┌─────────────────────────────────────────┐
│  /api/headshots/generate (This Task)    │
│  - Validate auth                        │
│  - Validate request                     │
│  - Create job in DB                     │
│  - Call RunPod async                    │
│  - Return jobId                         │
└────────┬────────────────────────────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────────┐  ┌──────────────────┐
│   Supabase DB   │  │  RunPod Endpoint │
│  generation_jobs│  │  (ComfyUI)       │
└─────────────────┘  └────────┬─────────┘
                              │
                              │ Webhook callback
                              ▼
                     ┌──────────────────────┐
                     │ /api/headshots/webhook│
                     │  (Task 5 - TODO)     │
                     └──────────────────────┘
```

## Code Quality

- ✅ TypeScript with full type safety
- ✅ Comprehensive error handling
- ✅ Structured logging with request tracking
- ✅ Input validation with clear error messages
- ✅ Async/await pattern for database operations
- ✅ Cookie-based authentication handling
- ✅ No TypeScript diagnostics or errors
- ✅ Follows existing codebase patterns

## Summary

Task 3 "Create headshot generation API endpoint" has been successfully implemented with all three subtasks completed:

- ✅ 3.1: POST /api/headshots/generate endpoint
- ✅ 3.2: Error handling for invalid inputs
- ✅ 3.3: Request logging and monitoring

The implementation is production-ready and follows best practices for API development, error handling, and logging.
