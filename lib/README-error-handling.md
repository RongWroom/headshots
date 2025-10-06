# Error Handling Utilities - Quick Reference

## Overview
Comprehensive error handling and retry logic for the Seedream integration. Provides automatic retries, error classification, and user-friendly error messages.

## Core Functions

### `withRetry<T>(fn, config?, logger?)`
Generic retry wrapper with exponential backoff.

```typescript
import { withRetry, DEFAULT_RETRY_CONFIG } from '@/lib/error-utils';
import { Logger } from '@/lib/logger';

const logger = new Logger('MY_ENDPOINT');

const result = await withRetry(
  async () => {
    // Your operation that might fail
    return await someApiCall();
  },
  DEFAULT_RETRY_CONFIG,  // Optional: custom config
  logger                  // Optional: for logging
);
```

**Default Config:**
```typescript
{
  maxRetries: 3,
  initialDelay: 1000,      // 1 second
  maxDelay: 10000,         // 10 seconds
  backoffMultiplier: 2     // Delays: 1s, 2s, 4s
}
```

### `isRetryableError(error)`
Determines if an error should be retried.

**Retryable Errors:**
- 429 (Rate Limit)
- 500-599 (Server Errors)
- Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND, ECONNREFUSED)

**Non-Retryable Errors:**
- 400 (Bad Request)
- 401 (Unauthorized)
- 403 (Forbidden)
- 404 (Not Found)

```typescript
import { isRetryableError } from '@/lib/error-utils';

try {
  await someOperation();
} catch (error) {
  if (isRetryableError(error)) {
    // Retry the operation
  } else {
    // Fail immediately
  }
}
```

### `classifyError(error, context?)`
Classifies errors and provides user-friendly information.

```typescript
import { classifyError } from '@/lib/error-utils';

try {
  await someOperation();
} catch (error) {
  const classified = classifyError(error, 'upload');
  
  console.log(classified.type);           // 'RATE_LIMIT_ERROR'
  console.log(classified.statusCode);     // 429
  console.log(classified.userMessage);    // "Too many requests..."
  console.log(classified.isRetryable);    // true
  console.log(classified.suggestions);    // ["Wait 30-60 seconds..."]
}
```

**Error Types:**
- `VALIDATION_ERROR` (400)
- `AUTHENTICATION_ERROR` (401)
- `AUTHORIZATION_ERROR` (403)
- `NOT_FOUND_ERROR` (404)
- `RATE_LIMIT_ERROR` (429)
- `SERVER_ERROR` (500+)
- `NETWORK_ERROR` (network issues)
- `REPLICATE_ERROR` (Replicate API)
- `WEBHOOK_ERROR` (webhook processing)
- `STORAGE_ERROR` (blob storage)
- `UNKNOWN_ERROR` (fallback)

### `createErrorResponse(error, logger?, context?)`
Creates a standardized error response for API endpoints.

```typescript
import { createErrorResponse } from '@/lib/error-utils';
import { Logger } from '@/lib/logger';

const logger = new Logger('MY_ENDPOINT');

try {
  await someOperation();
} catch (error) {
  const errorResponse = createErrorResponse(error, logger, 'upload');
  
  return NextResponse.json(errorResponse, { 
    status: errorResponse.statusCode 
  });
}
```

**Response Format:**
```typescript
{
  error: 'RATE_LIMIT_ERROR',
  message: 'Too many requests. Please wait a moment and try again.',
  code: 'RATE_LIMIT_ERROR',
  statusCode: 429,
  suggestions: ['Wait 30-60 seconds before retrying'],
  requestId: 'req_123456'
}
```

### `webhookFallbackPoll(predictionId, getPredictionFn, maxAttempts?, intervalMs?, logger?)`
Polls Replicate API if webhook is delayed or missing.

```typescript
import { webhookFallbackPoll } from '@/lib/error-utils';
import { seedreamService } from '@/lib/seedream-service';
import { Logger } from '@/lib/logger';

const logger = new Logger('WEBHOOK_FALLBACK');

const prediction = await webhookFallbackPoll(
  'pred_abc123',
  (id) => seedreamService.getPrediction(id),
  10,      // Max 10 attempts
  5000,    // 5 second interval
  logger
);

if (prediction.status === 'succeeded') {
  // Process results
}
```

### `retryImageDownload(url, maxRetries?, logger?)`
Downloads an image with automatic retries.

```typescript
import { retryImageDownload } from '@/lib/error-utils';
import { Logger } from '@/lib/logger';

const logger = new Logger('IMAGE_DOWNLOAD');

const imageBuffer = await retryImageDownload(
  'https://replicate.delivery/image.jpg',
  3,      // Max 3 retries
  logger
);

// imageBuffer is an ArrayBuffer
const buffer = Buffer.from(imageBuffer);
```

### `retryBlobUpload(uploadFn, basePath, maxRetries?, logger?)`
Uploads to Vercel Blob with automatic retries and conflict resolution.

```typescript
import { retryBlobUpload } from '@/lib/error-utils';
import { put } from '@vercel/blob';
import { Logger } from '@/lib/logger';

const logger = new Logger('BLOB_UPLOAD');

const blob = await retryBlobUpload(
  async (path) => {
    return await put(path, file, {
      access: 'public',
      contentType: 'image/jpeg',
    });
  },
  'seedream-uploads/user123/image.jpg',
  3,      // Max 3 retries
  logger
);

console.log(blob.url);  // Blob URL
```

## Usage Examples

### Example 1: API Endpoint with Retry Logic

```typescript
import { NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';
import { withRetry, createErrorResponse } from '@/lib/error-utils';

export async function POST(req: Request) {
  const logger = new Logger('MY_ENDPOINT');
  
  try {
    // Operation with automatic retry
    const result = await withRetry(
      async () => {
        return await externalApiCall();
      },
      undefined,  // Use default config
      logger
    );
    
    return NextResponse.json({ success: true, result });
    
  } catch (error) {
    const errorResponse = createErrorResponse(error, logger, 'api_call');
    return NextResponse.json(errorResponse, { 
      status: errorResponse.statusCode 
    });
  }
}
```

### Example 2: Image Processing with Retries

```typescript
import { retryImageDownload, retryBlobUpload } from '@/lib/error-utils';
import { put } from '@vercel/blob';
import { Logger } from '@/lib/logger';

async function processImage(replicateUrl: string, userId: string, jobId: string) {
  const logger = new Logger('IMAGE_PROCESSING');
  
  // Download with retry
  const imageBuffer = await retryImageDownload(replicateUrl, 3, logger);
  
  // Upload with retry
  const blob = await retryBlobUpload(
    async (path) => {
      return await put(path, Buffer.from(imageBuffer), {
        access: 'public',
        contentType: 'image/jpeg',
      });
    },
    `seedream-outputs/${userId}/${jobId}/image.jpg`,
    3,
    logger
  );
  
  return blob.url;
}
```

### Example 3: Webhook Fallback

```typescript
import { webhookFallbackPoll } from '@/lib/error-utils';
import { seedreamService } from '@/lib/seedream-service';
import { Logger } from '@/lib/logger';

async function checkJobStatus(jobId: string, replicatePredictionId: string) {
  const logger = new Logger('JOB_STATUS');
  
  // Check if webhook is delayed (2+ minutes since creation)
  const timeSinceCreation = Date.now() - job.created_at.getTime();
  
  if (timeSinceCreation > 2 * 60 * 1000) {
    logger.logInfo('WEBHOOK_DELAYED', { jobId, replicatePredictionId });
    
    // Poll Replicate as fallback
    const prediction = await webhookFallbackPoll(
      replicatePredictionId,
      (id) => seedreamService.getPrediction(id),
      10,    // Max 10 polls
      5000,  // 5 second interval
      logger
    );
    
    // Update job with results
    if (prediction.status === 'succeeded') {
      // Process outputs
    }
  }
}
```

### Example 4: Error Classification and User Messages

```typescript
import { classifyError } from '@/lib/error-utils';

try {
  await someOperation();
} catch (error) {
  const classified = classifyError(error, 'generation');
  
  // Log technical details
  console.error('Technical error:', classified.message);
  
  // Show user-friendly message to user
  showToast({
    type: 'error',
    title: classified.type.replace('_', ' '),
    message: classified.userMessage,
    suggestions: classified.suggestions
  });
  
  // Retry if appropriate
  if (classified.isRetryable) {
    setTimeout(() => retryOperation(), 5000);
  }
}
```

## Best Practices

### 1. Always Use Logger
```typescript
const logger = new Logger('ENDPOINT_NAME');
await withRetry(operation, config, logger);  // ✓ Good
await withRetry(operation);                   // ✗ Missing logs
```

### 2. Provide Context
```typescript
createErrorResponse(error, logger, 'upload');     // ✓ Good
createErrorResponse(error, logger);               // ✗ Missing context
```

### 3. Handle Both Retryable and Non-Retryable Errors
```typescript
try {
  await withRetry(operation);
} catch (error) {
  const classified = classifyError(error);
  
  if (classified.isRetryable) {
    // Schedule retry or show "try again" message
  } else {
    // Show error and don't retry
  }
}
```

### 4. Use Appropriate Retry Configs
```typescript
// Quick operations (API calls)
const quickConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 5000,
  backoffMultiplier: 2
};

// Slow operations (file uploads)
const slowConfig = {
  maxRetries: 5,
  initialDelay: 2000,
  maxDelay: 30000,
  backoffMultiplier: 2
};
```

### 5. Clean Up on Failure
```typescript
const uploadedFiles = [];

try {
  for (const file of files) {
    const blob = await retryBlobUpload(uploadFn, path);
    uploadedFiles.push(blob);
  }
} catch (error) {
  // Clean up successfully uploaded files
  for (const blob of uploadedFiles) {
    await del(blob.url);
  }
  throw error;
}
```

## Error Message Guidelines

### User-Friendly Messages
- ✓ "Too many requests. Please wait a moment and try again."
- ✗ "HTTP 429: Rate limit exceeded on /api/endpoint"

### Actionable Suggestions
- ✓ "Wait 30-60 seconds before retrying"
- ✗ "Error occurred"

### No Technical Jargon
- ✓ "Network connection failed"
- ✗ "ECONNRESET: Connection reset by peer"

### Positive Tone
- ✓ "Please try again in a moment"
- ✗ "Request failed permanently"

## Testing

Run the test suite:
```bash
node test-error-handling.js
```

Tests cover:
- Retry with exponential backoff
- Non-retryable errors
- Retryable errors (429, 500)
- Error classification
- User-friendly messages
- Webhook fallback polling
- Image download retry

## Integration with Existing Code

The error utilities integrate seamlessly with:
- `Logger` class for comprehensive logging
- `seedreamService` for Replicate API calls
- All Seedream API endpoints
- Vercel Blob storage operations

## Performance Considerations

- **Retry Delays**: 1s, 2s, 4s (reasonable for user experience)
- **Max Retries**: 3 (prevents infinite loops)
- **Immediate Failure**: Non-retryable errors fail immediately
- **Exponential Backoff**: Prevents server overload

## Security Considerations

- Error messages don't expose sensitive information
- Stack traces only shown in development mode
- Rate limiting prevents abuse
- Webhook signature verification prevents tampering

## Monitoring

All errors are logged with:
- Request ID for tracing
- User ID (if authenticated)
- Error type and classification
- Retry attempts and outcomes
- Timestamps and durations

## Support

For issues or questions:
1. Check the logs for detailed error information
2. Review the error classification and suggestions
3. Verify retry configuration is appropriate
4. Check network connectivity and API status
5. Contact support with request ID if issue persists
