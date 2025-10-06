# Mock API Testing Guide

## How to Test Different States

If you want to test specific states without waiting for real generations, you can create a mock API endpoint.

### Option 1: Create a Mock Status Endpoint

Create `app/api/seedream/status/mock/[jobId]/route.ts`:

```typescript
import { NextResponse } from 'next/server';

// Simulates different generation states
let mockProgress = 0;
let mockStatus: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  // Simulate progress increment
  if (mockStatus === 'pending' || mockStatus === 'processing') {
    mockProgress = Math.min(mockProgress + 10, 100);
    
    if (mockProgress >= 100) {
      mockStatus = 'completed';
    } else if (mockProgress >= 20) {
      mockStatus = 'processing';
    }
  }

  // Simulate different responses based on jobId
  if (jobId === 'test-error') {
    return NextResponse.json({
      success: false,
      jobId,
      status: 'failed',
      progress: 50,
      error: 'Test error: Generation failed',
      errorCode: 'TEST_ERROR',
      suggestions: [
        'This is a test error',
        'Try a different job ID',
      ],
      createdAt: new Date().toISOString(),
    });
  }

  if (jobId === 'test-slow') {
    // Simulate slow progress
    mockProgress = Math.min(mockProgress + 2, 100);
  }

  // Normal response
  const response = {
    success: true,
    jobId,
    status: mockStatus,
    progress: mockProgress,
    estimatedTimeRemaining: mockProgress < 100 ? `${Math.floor((100 - mockProgress) / 10) * 3} seconds` : undefined,
    createdAt: new Date(Date.now() - mockProgress * 1000).toISOString(),
  };

  if (mockStatus === 'completed') {
    return NextResponse.json({
      ...response,
      outputs: Array.from({ length: 10 }, (_, i) => ({
        url: `https://via.placeholder.com/512?text=Result+${i + 1}`,
        thumbnail: `https://via.placeholder.com/256?text=Thumb+${i + 1}`,
      })),
      generationTime: 85,
      completedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json(response);
}

// Reset endpoint
export async function POST() {
  mockProgress = 0;
  mockStatus = 'pending';
  return NextResponse.json({ success: true, message: 'Mock state reset' });
}
```

### Option 2: Use Browser DevTools to Mock Responses

1. Open DevTools → Network tab
2. Right-click on a status request
3. Select "Override content" (Chrome) or use a network proxy
4. Modify the response JSON to test different states

### Test Job IDs for Mock Endpoint

- `test-normal` - Normal progression (0% → 100%)
- `test-error` - Immediate error
- `test-slow` - Very slow progress
- `test-fast` - Fast completion

### Testing Specific States

#### Test Initializing (0%)
```json
{
  "success": true,
  "jobId": "test-id",
  "status": "pending",
  "progress": 0,
  "estimatedTimeRemaining": "60-90 seconds",
  "createdAt": "2025-06-10T18:00:00Z"
}
```

#### Test Uploading (15%)
```json
{
  "success": true,
  "jobId": "test-id",
  "status": "processing",
  "progress": 15,
  "estimatedTimeRemaining": "70 seconds",
  "createdAt": "2025-06-10T18:00:00Z"
}
```

#### Test Processing (55%)
```json
{
  "success": true,
  "jobId": "test-id",
  "status": "processing",
  "progress": 55,
  "estimatedTimeRemaining": "35 seconds",
  "createdAt": "2025-06-10T18:00:00Z"
}
```

#### Test Finalizing (95%)
```json
{
  "success": true,
  "jobId": "test-id",
  "status": "processing",
  "progress": 95,
  "estimatedTimeRemaining": "5 seconds",
  "createdAt": "2025-06-10T18:00:00Z"
}
```

#### Test Completed
```json
{
  "success": true,
  "jobId": "test-id",
  "status": "completed",
  "progress": 100,
  "outputs": [
    {
      "url": "https://example.com/image1.jpg",
      "thumbnail": "https://example.com/thumb1.jpg"
    }
  ],
  "generationTime": 85,
  "createdAt": "2025-06-10T18:00:00Z",
  "completedAt": "2025-06-10T18:01:25Z"
}
```

#### Test Failed
```json
{
  "success": false,
  "jobId": "test-id",
  "status": "failed",
  "progress": 50,
  "error": "Generation failed due to invalid input",
  "errorCode": "GENERATION_FAILED",
  "suggestions": [
    "Try generating again with different images",
    "Check that your images meet the requirements",
    "Contact support if the issue persists"
  ],
  "createdAt": "2025-06-10T18:00:00Z"
}
```

#### Test Rate Limit (429)
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Please wait 2 seconds before polling again",
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "suggestions": [
    "Wait 2 seconds before making another request",
    "Reduce polling frequency to once every 3 seconds"
  ]
}
```

### Using the Mock Endpoint

Modify the test page to use mock endpoint:

```typescript
// In SeedreamGenerationProgress.tsx, temporarily change:
const response = await fetch(`/api/seedream/status/mock/${jobId}`, {
  // ... rest of the code
});
```

Or create a prop to toggle mock mode:

```typescript
interface Props {
  jobId: string;
  useMock?: boolean; // Add this
  // ... other props
}

// Then in the fetch:
const endpoint = useMock 
  ? `/api/seedream/status/mock/${jobId}`
  : `/api/seedream/status/${jobId}`;
```
