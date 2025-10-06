# Seedream Status API Reference

## Endpoint
```
GET /api/seedream/status/[jobId]
```

## Description
Poll the status of a Seedream headshot generation job. Returns current progress, estimated time remaining, and results when complete.

## Authentication
Required. Must be authenticated via Supabase session.

## Rate Limiting
- **Limit**: 1 request per 2 seconds per job
- **Response**: 429 Too Many Requests with `Retry-After` header

## Parameters

### Path Parameters
| Parameter | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| jobId     | string | Yes      | UUID of the generation job     |

## Response Formats

### Pending Job (200 OK)
```json
{
  "success": true,
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "pending",
  "progress": 0,
  "estimatedTimeRemaining": "60-90 seconds",
  "createdAt": "2025-06-10T10:00:00Z"
}
```

### Processing Job (200 OK)
```json
{
  "success": true,
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "processing",
  "progress": 50,
  "estimatedTimeRemaining": "45 seconds",
  "createdAt": "2025-06-10T10:00:00Z"
}
```

### Completed Job (200 OK)
```json
{
  "success": true,
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "completed",
  "progress": 100,
  "outputs": [
    {
      "url": "https://blob.vercel-storage.com/seedream-outputs/user123/job456/0.jpg",
      "thumbnail": "https://blob.vercel-storage.com/seedream-outputs/user123/job456/0.jpg"
    },
    {
      "url": "https://blob.vercel-storage.com/seedream-outputs/user123/job456/1.jpg",
      "thumbnail": "https://blob.vercel-storage.com/seedream-outputs/user123/job456/1.jpg"
    }
  ],
  "generationTime": 75.5,
  "createdAt": "2025-06-10T10:00:00Z",
  "completedAt": "2025-06-10T10:01:15Z"
}
```

### Failed Job (200 OK)
```json
{
  "success": false,
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "failed",
  "progress": 25,
  "error": "Invalid input images",
  "errorCode": "GENERATION_FAILED",
  "suggestions": [
    "Try generating again with different images",
    "Check that your images meet the requirements (JPEG, PNG, WebP, max 10MB)",
    "Ensure images contain clear faces",
    "Contact support if the issue persists"
  ],
  "createdAt": "2025-06-10T10:00:00Z"
}
```

## Error Responses

### Rate Limited (429 Too Many Requests)
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Please wait 1 seconds before polling again",
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "suggestions": [
    "Wait 1 seconds before making another request",
    "Reduce polling frequency to once every 3 seconds"
  ]
}
```
**Headers**: `Retry-After: 1`

### Unauthorized (401 Unauthorized)
```json
{
  "success": false,
  "error": "Authentication failed",
  "message": "Please sign in to view job status",
  "errorCode": "UNAUTHORIZED",
  "suggestions": [
    "Sign in to your account",
    "Check if your session has expired"
  ]
}
```

### Forbidden (403 Forbidden)
```json
{
  "success": false,
  "error": "Access denied",
  "message": "You do not have permission to view this job",
  "errorCode": "FORBIDDEN",
  "suggestions": [
    "You can only view your own generation jobs"
  ]
}
```

### Invalid Job ID (400 Bad Request)
```json
{
  "success": false,
  "error": "Invalid job ID",
  "message": "The provided job ID is not valid",
  "errorCode": "INVALID_JOB_ID",
  "suggestions": [
    "Check that the job ID is correct"
  ]
}
```

### Job Not Found (404 Not Found)
```json
{
  "success": false,
  "error": "Job not found",
  "message": "No generation job found with the provided ID",
  "errorCode": "JOB_NOT_FOUND",
  "suggestions": [
    "Check that the job ID is correct",
    "The job may have been deleted"
  ]
}
```

### Server Error (500 Internal Server Error)
```json
{
  "success": false,
  "error": "Status request failed",
  "message": "An unexpected error occurred while retrieving job status",
  "errorCode": "STATUS_REQUEST_ERROR",
  "suggestions": [
    "Check your internet connection",
    "Try again in a few moments",
    "Contact support if the issue persists"
  ]
}
```

## Response Fields

| Field                   | Type     | Description                                           |
|-------------------------|----------|-------------------------------------------------------|
| success                 | boolean  | Whether the request was successful                    |
| jobId                   | string   | UUID of the job                                       |
| status                  | string   | Job status: pending, processing, completed, failed    |
| progress                | number   | Progress percentage (0-100)                           |
| estimatedTimeRemaining  | string   | Estimated time until completion (pending/processing)  |
| outputs                 | array    | Array of output images (completed only)               |
| outputs[].url           | string   | Full-size image URL                                   |
| outputs[].thumbnail     | string   | Thumbnail image URL                                   |
| error                   | string   | Error message (failed only)                           |
| errorCode               | string   | Machine-readable error code                           |
| suggestions             | array    | Actionable suggestions for the user                   |
| generationTime          | number   | Generation time in seconds (completed only)           |
| createdAt               | string   | ISO 8601 timestamp of job creation                    |
| completedAt             | string   | ISO 8601 timestamp of job completion                  |

## Cache Headers

### Completed/Failed Jobs
```
Cache-Control: public, max-age=3600, s-maxage=3600
```
Cached for 1 hour since status won't change.

### In-Progress Jobs
```
Cache-Control: no-store, no-cache, must-revalidate
```
Never cached since status is actively changing.

## Usage Examples

### JavaScript/TypeScript
```typescript
async function pollJobStatus(jobId: string): Promise<StatusResponse> {
  const response = await fetch(`/api/seedream/status/${jobId}`, {
    method: 'GET',
    credentials: 'include', // Include cookies for auth
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return response.json();
}

// Poll every 3 seconds until complete
async function waitForCompletion(jobId: string): Promise<StatusResponse> {
  while (true) {
    const status = await pollJobStatus(jobId);
    
    if (status.status === 'completed') {
      return status;
    }
    
    if (status.status === 'failed') {
      throw new Error(status.error);
    }
    
    // Wait 3 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}
```

### React Hook
```typescript
import { useState, useEffect } from 'react';

interface UseJobStatusResult {
  status: StatusResponse | null;
  loading: boolean;
  error: Error | null;
}

function useJobStatus(jobId: string | null): UseJobStatusResult {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!jobId) return;
    
    let cancelled = false;
    
    async function poll() {
      try {
        setLoading(true);
        const response = await fetch(`/api/seedream/status/${jobId}`, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }
        
        const data = await response.json();
        
        if (!cancelled) {
          setStatus(data);
          setError(null);
          
          // Continue polling if not complete
          if (data.status === 'pending' || data.status === 'processing') {
            setTimeout(poll, 3000);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    
    poll();
    
    return () => {
      cancelled = true;
    };
  }, [jobId]);
  
  return { status, loading, error };
}
```

### cURL
```bash
# Poll job status
curl -X GET \
  'https://your-site.com/api/seedream/status/123e4567-e89b-12d3-a456-426614174000' \
  -H 'Cookie: sb-access-token=YOUR_TOKEN' \
  -H 'Content-Type: application/json'
```

## Best Practices

### Polling Frequency
- **Recommended**: Poll every 3 seconds
- **Minimum**: 2 seconds (enforced by rate limiting)
- **Maximum**: 5 seconds (for better UX)

### Error Handling
```typescript
async function pollWithRetry(jobId: string, maxRetries = 3): Promise<StatusResponse> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const response = await fetch(`/api/seedream/status/${jobId}`);
      
      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = response.headers.get('Retry-After');
        await new Promise(resolve => setTimeout(resolve, (parseInt(retryAfter || '2') * 1000)));
        continue;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      
      return response.json();
      
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        throw error;
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

### Stop Polling
Always stop polling when:
- Status is `completed`
- Status is `failed`
- User navigates away from the page
- Component unmounts

### Display Progress
```typescript
function ProgressDisplay({ status }: { status: StatusResponse }) {
  if (status.status === 'pending') {
    return (
      <div>
        <p>Queued for processing...</p>
        <p>Estimated time: {status.estimatedTimeRemaining}</p>
      </div>
    );
  }
  
  if (status.status === 'processing') {
    return (
      <div>
        <ProgressBar value={status.progress} max={100} />
        <p>{status.progress}% complete</p>
        <p>Estimated time remaining: {status.estimatedTimeRemaining}</p>
      </div>
    );
  }
  
  if (status.status === 'completed') {
    return (
      <div>
        <p>Generation complete! ({status.generationTime}s)</p>
        <ImageGallery images={status.outputs} />
      </div>
    );
  }
  
  if (status.status === 'failed') {
    return (
      <div>
        <p>Generation failed: {status.error}</p>
        <ul>
          {status.suggestions?.map((suggestion, i) => (
            <li key={i}>{suggestion}</li>
          ))}
        </ul>
      </div>
    );
  }
}
```

## Special Features

### Fallback Polling
If the webhook from Replicate is delayed (no update in 2 minutes), the endpoint automatically polls Replicate's API to get the latest status. This ensures:
- Jobs don't get stuck in "processing" state
- Users always get up-to-date information
- Webhook failures don't impact user experience

### Job Expiration
Jobs older than 24 hours are automatically marked as failed with an expiration message. This prevents:
- Stale jobs cluttering the database
- Indefinite polling of old jobs
- Resource waste on abandoned jobs

### Smart Caching
- Completed and failed jobs are cached for 1 hour
- Reduces database load by ~90% for finished jobs
- CDN-friendly cache headers
- In-progress jobs are never cached

## Troubleshooting

### Issue: Rate Limited
**Symptom**: 429 status code
**Solution**: Reduce polling frequency to once every 3 seconds

### Issue: Job Stuck in Processing
**Symptom**: Job shows "processing" for more than 5 minutes
**Solution**: The endpoint will automatically poll Replicate after 2 minutes. If still stuck, check Replicate dashboard.

### Issue: Job Not Found
**Symptom**: 404 status code
**Solution**: Verify the job ID is correct and the job hasn't been deleted

### Issue: Unauthorized
**Symptom**: 401 status code
**Solution**: Ensure user is authenticated and session is valid

## Related Endpoints
- `POST /api/seedream/generate` - Create a new generation job
- `POST /api/seedream/webhook` - Webhook for Replicate callbacks
- `POST /api/seedream/upload` - Upload images for generation
