# Seedream Types Quick Reference

Quick reference guide for the most commonly used Seedream types.

## Import Statement

```typescript
import { 
  // Core types
  SeedreamUpload,
  SeedreamJob,
  Style,
  
  // API types
  GenerateRequest,
  StatusResponse,
  ErrorResponse,
  
  // Type guards
  isStatusCompleted,
  isStatusFailed,
  
  // Utility types
  JobCreate,
  JobUpdate
} from '@/types/seedream';
```

## Common Patterns

### 1. Creating a Generation Request

```typescript
const request: GenerateRequest = {
  uploadId: 'uuid-here',
  styleId: 'corporate-blue',
  numOutputs: 10,
  customizations: {
    removeGlasses: true,
    cleanBackground: true
  }
};
```

### 2. Handling Status Responses

```typescript
const response = await fetch(`/api/seedream/status/${jobId}`);
const data: StatusResponse = await response.json();

if (isStatusCompleted(data)) {
  // data is StatusResponseCompleted
  data.outputs.forEach(img => console.log(img.url));
} else if (isStatusFailed(data)) {
  // data is StatusResponseFailed
  console.error(data.error);
  data.suggestions?.forEach(s => console.log(s));
} else {
  // data is StatusResponsePending
  console.log(`Progress: ${data.progress}%`);
}
```

### 3. Creating a Job in Database

```typescript
const jobData: JobCreate = {
  userId: user.id,
  uploadId: upload.id,
  styleId: 'warm-studio',
  numOutputs: 10,
  customizations: null
};

const { data } = await supabase
  .from('seedream_jobs')
  .insert(jobData as SeedreamJobInsert)
  .select()
  .single();
```

### 4. Updating a Job

```typescript
const update: JobUpdate = {
  status: 'processing',
  progress: 50,
  replicatePredictionId: 'pred-123'
};

await supabase
  .from('seedream_jobs')
  .update(update as SeedreamJobUpdate)
  .eq('id', jobId);
```

### 5. Error Handling

```typescript
try {
  const response = await fetch('/api/seedream/generate', {
    method: 'POST',
    body: JSON.stringify(request)
  });
  
  const data = await response.json();
  
  if (isErrorResponse(data)) {
    console.error(data.error);
    data.suggestions?.forEach(s => console.log(`Suggestion: ${s}`));
  }
} catch (error) {
  // Handle network errors
}
```

## Type Cheat Sheet

| Type | Use Case | Key Fields |
|------|----------|------------|
| `GenerateRequest` | POST /api/seedream/generate | uploadId, styleId, customizations |
| `StatusResponse` | GET /api/seedream/status/:id | status, progress, outputs |
| `SeedreamJob` | Database operations | id, status, outputImages |
| `Style` | Style catalog | id, name, prompt, seed |
| `ErrorResponse` | Error handling | error, message, suggestions |

## Status Flow

```
pending → processing → completed
                    ↘ failed
```

Use type guards to handle each state:
- `isStatusPending(data)` - Show progress
- `isStatusCompleted(data)` - Show results
- `isStatusFailed(data)` - Show error

## Common Customizations

```typescript
const customizations: SeedreamCustomizations = {
  removeJewelry: true,    // Remove earrings, necklaces, etc.
  removeGlasses: true,    // Remove eyeglasses
  removePiercings: true,  // Remove facial piercings
  cleanBackground: true   // Remove distracting elements
};
```

## Style IDs

Available styles (from style catalog):
- `'corporate-blue'` - Professional blue gradient
- `'warm-studio'` - Warm beige background
- `'professional-gray'` - Neutral gray
- `'creative-teal'` - Modern teal gradient
- `'executive-charcoal'` - Dark charcoal

## Type Guards

```typescript
// Check response type
if (isErrorResponse(data)) { /* handle error */ }

// Check status
if (isStatusCompleted(data)) { /* show results */ }
if (isStatusFailed(data)) { /* show error */ }
if (isStatusPending(data)) { /* show progress */ }
```

## Full Documentation

See `types/README-seedream.md` for complete documentation with detailed examples.
