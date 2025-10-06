# Seedream Types Documentation

This document provides an overview of the TypeScript types and interfaces defined for the Seedream headshot generation feature.

## Overview

The `types/seedream.ts` module contains all type definitions for the Seedream integration, organized into the following categories:

1. **Database Types** - Supabase table types
2. **Core Domain Types** - Business logic types
3. **API Request/Response Types** - HTTP interface types
4. **Replicate Service Types** - External API types
5. **Validation Types** - Input validation types
6. **Configuration Types** - System configuration types
7. **Metrics Types** - Monitoring and analytics types
8. **Type Guards** - Runtime type checking utilities
9. **Utility Types** - Helper types for common operations

## Key Types

### Core Domain Types

#### `SeedreamUpload`
Represents an upload session with user images.

```typescript
interface SeedreamUpload {
  id: string;
  userId: string;
  images: UploadedImage[];
  createdAt: string;
  expiresAt: string;
}
```

#### `SeedreamJob`
Represents a headshot generation job.

```typescript
interface SeedreamJob {
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
```

#### `Style`
Defines a headshot style configuration.

```typescript
interface Style {
  id: string;
  name: string;
  description: string;
  prompt: string;
  negativePrompt: string;
  seed: number;
  previewImage: string;
  category: StyleCategory;
}
```

### API Request Types

#### `GenerateRequest`
Request body for starting a generation job.

```typescript
interface GenerateRequest {
  uploadId: string;
  styleId: string;
  numOutputs?: number;
  customizations?: SeedreamCustomizations;
}
```

#### `WebhookRequest`
Webhook payload from Replicate.

```typescript
interface WebhookRequest {
  id: string;
  status: 'succeeded' | 'failed' | 'canceled';
  output: string[] | null;
  error: string | null;
  metrics?: {
    predict_time?: number;
  };
}
```

### API Response Types

#### `UploadResponse`
Success response from upload endpoint.

```typescript
interface UploadResponse {
  success: true;
  uploadId: string;
  images: UploadedImage[];
  expiresAt: string;
  message: string;
}
```

#### `StatusResponse`
Union type for status endpoint responses.

```typescript
type StatusResponse = 
  | StatusResponsePending 
  | StatusResponseCompleted 
  | StatusResponseFailed;
```

Use type guards to narrow the type:

```typescript
if (isStatusCompleted(response)) {
  // response is StatusResponseCompleted
  console.log(response.outputs);
} else if (isStatusFailed(response)) {
  // response is StatusResponseFailed
  console.log(response.error);
}
```

#### `ErrorResponse`
Standard error response structure.

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  errorCode: string;
  details?: Record<string, any>;
  suggestions?: string[];
  timestamp?: string;
}
```

## Usage Examples

### In API Routes

```typescript
import { 
  GenerateRequest, 
  GenerateResponse, 
  ErrorResponse 
} from '@/types/seedream';

export async function POST(req: Request) {
  const body: GenerateRequest = await req.json();
  
  // ... validation and processing
  
  const response: GenerateResponse = {
    success: true,
    jobId: job.id,
    status: 'pending',
    estimatedTime: '60-90 seconds',
    pollUrl: `/api/seedream/status/${job.id}`
  };
  
  return NextResponse.json(response);
}
```

### In Service Layer

```typescript
import { SeedreamInput, Prediction } from '@/types/seedream';

async function createPrediction(input: SeedreamInput): Promise<Prediction> {
  // ... implementation
}
```

### In Frontend Components

```typescript
import { 
  StatusResponse, 
  isStatusCompleted,
  isStatusFailed 
} from '@/types/seedream';

async function pollJobStatus(jobId: string) {
  const response = await fetch(`/api/seedream/status/${jobId}`);
  const data: StatusResponse = await response.json();
  
  if (isStatusCompleted(data)) {
    // Show results
    displayImages(data.outputs);
  } else if (isStatusFailed(data)) {
    // Show error
    showError(data.error, data.suggestions);
  } else {
    // Show progress
    updateProgress(data.progress);
  }
}
```

### Database Operations

```typescript
import { 
  SeedreamJobInsert, 
  SeedreamJobUpdate,
  JobCreate 
} from '@/types/seedream';

// Creating a new job
const jobData: JobCreate = {
  userId: user.id,
  uploadId: upload.id,
  styleId: 'corporate-blue',
  numOutputs: 10,
  customizations: {
    removeGlasses: true,
    cleanBackground: true
  }
};

const { data } = await supabase
  .from('seedream_jobs')
  .insert(jobData as SeedreamJobInsert)
  .select()
  .single();

// Updating a job
const update: SeedreamJobUpdate = {
  status: 'completed',
  progress: 100,
  output_images: outputs
};

await supabase
  .from('seedream_jobs')
  .update(update)
  .eq('id', jobId);
```

## Type Guards

The module provides several type guard functions for runtime type checking:

- `isStatusCompleted(response)` - Check if status is completed
- `isStatusFailed(response)` - Check if status is failed
- `isStatusPending(response)` - Check if status is pending/processing
- `isErrorResponse(response)` - Check if response is an error

These are especially useful when handling API responses in the frontend.

## Best Practices

1. **Always use the defined types** - Don't use `any` or inline types
2. **Use type guards** - Narrow union types with type guards for type safety
3. **Leverage utility types** - Use `JobCreate`, `JobUpdate` for partial operations
4. **Import from central location** - Always import from `@/types/seedream`
5. **Keep types in sync** - Update types when database schema changes

## Related Files

- `types/supabase.ts` - Auto-generated Supabase types
- `lib/seedream-service.ts` - Replicate service implementation
- `lib/style-catalog.ts` - Style definitions
- `app/api/seedream/*` - API route implementations

## Updating Types

When the database schema changes:

1. Update the migration in `supabase/migrations/`
2. Regenerate Supabase types: `npx supabase gen types typescript --local > types/supabase.ts`
3. Update `types/seedream.ts` if needed
4. Update this documentation

## Type Safety Checklist

- [ ] All API routes use typed request/response interfaces
- [ ] Database operations use Supabase-generated types
- [ ] Frontend components use type guards for response handling
- [ ] Service layer functions have proper type signatures
- [ ] No `any` types in production code
- [ ] All JSON fields have proper TypeScript interfaces
