# Task 6 Completion: Seedream Webhook Handler

## Overview
Successfully implemented the webhook handler for Replicate Seedream integration at `/api/seedream/webhook`. The handler receives completion notifications from Replicate, downloads generated images, uploads them to Vercel Blob storage, and updates job records in the database.

## Implementation Details

### File Created
- `app/api/seedream/webhook/route.ts` - Main webhook handler

### Key Features Implemented

#### 1. Webhook Signature Verification
- Validates `replicate-signature` header using HMAC SHA-256
- Uses `REPLICATE_WEBHOOK_SECRET` environment variable
- Implements timing-safe comparison to prevent timing attacks
- Rejects webhooks with missing or invalid signatures (401)

#### 2. Rate Limiting
- In-memory rate limiting per IP address
- Max 100 requests per minute per IP
- Returns 429 status with `Retry-After` header when exceeded
- Includes `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers

#### 3. Idempotency
- Detects and handles duplicate webhooks
- Stores processed webhooks in memory for 1 hour
- Returns success response for duplicates without reprocessing
- Prevents race conditions and duplicate processing

#### 4. Payload Processing
- Parses Replicate webhook payload
- Validates required fields (id, status)
- Maps Replicate status to internal status:
  - `starting`/`processing` → `processing`
  - `succeeded` → `completed`
  - `failed`/`canceled` → `failed`

#### 5. Image Download and Upload
- Downloads images from Replicate URLs with retry logic (3 attempts)
- Implements exponential backoff for retries
- Uploads to Vercel Blob at `seedream-outputs/{userId}/{jobId}/{index}-{timestamp}.jpg`
- Handles partial failures gracefully
- Continues processing even if some images fail

#### 6. Database Updates
- Uses Supabase service role for webhook updates
- Finds job by `replicate_prediction_id`
- Updates job status, progress, and timestamps
- Stores output image URLs
- Calculates and stores generation metrics:
  - `generation_time_seconds` from Replicate metrics
  - `estimated_cost_usd` (fixed at $0.10 per generation)

#### 7. Error Handling
- Comprehensive error handling for all operations
- Returns 500 status for retryable errors (triggers Replicate retry)
- Returns 404 for job not found
- Returns 400 for invalid payloads
- Returns 401 for authentication failures
- Detailed logging for debugging

#### 8. Logging
- Uses structured logging with Logger utility
- Logs all webhook events and processing steps
- Tracks image download and upload progress
- Records errors with full context

## Webhook Payload Format

### Replicate Webhook Payload
```typescript
{
  id: string;                    // Replicate prediction ID
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: string[] | null;       // Array of image URLs
  error: string | null;          // Error message if failed
  metrics?: {
    predict_time?: number;       // Generation time in seconds
  };
}
```

### Response Format
```typescript
{
  success: true,
  jobId: string,
  status: string,
  message: string
}
```

## Security Features

1. **Signature Verification**: All webhooks must have valid HMAC signature
2. **Rate Limiting**: Prevents abuse with per-IP rate limits
3. **Service Role Access**: Uses Supabase service role for database updates
4. **Timing-Safe Comparison**: Prevents timing attacks on signature validation
5. **Input Validation**: Validates all required fields before processing

## Error Scenarios Handled

1. **Missing Signature**: Returns 401
2. **Invalid Signature**: Returns 401
3. **Invalid JSON**: Returns 400
4. **Missing Required Fields**: Returns 400
5. **Job Not Found**: Returns 404
6. **Rate Limit Exceeded**: Returns 429
7. **Image Download Failure**: Retries 3 times, continues with successful images
8. **Blob Upload Failure**: Retries 3 times, continues with successful uploads
9. **Database Error**: Returns 500 (triggers Replicate retry)
10. **All Images Failed**: Marks job as failed with error message

## Retry Logic

### Image Download
- Max 3 attempts per image
- Exponential backoff: 1s, 2s, 4s (max 10s)
- Continues processing other images on failure

### Blob Upload
- Max 3 attempts per image
- Exponential backoff: 1s, 2s, 4s (max 10s)
- Uses unique filenames with timestamps to avoid collisions

### Webhook Retry
- Returns 500 for retryable errors
- Replicate automatically retries failed webhooks
- Idempotency ensures safe reprocessing

## Testing

### Test File Created
- `test-seedream-webhook.js` - Comprehensive webhook tests

### Test Coverage
1. ✅ Valid webhook with signature
2. ✅ Invalid webhook signature
3. ✅ Missing webhook signature
4. ✅ Invalid JSON payload
5. ✅ Missing required fields
6. ✅ Idempotency (duplicate webhooks)
7. ✅ Successful completion webhook
8. ✅ Failed generation webhook

### Running Tests
```bash
# Set environment variables
export REPLICATE_WEBHOOK_SECRET="your-webhook-secret"
export NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Run tests
node test-seedream-webhook.js
```

## Database Schema Used

### seedream_jobs Table
- `id` - Job UUID
- `user_id` - User UUID
- `replicate_prediction_id` - Replicate prediction ID (indexed, unique)
- `status` - Job status (pending, processing, completed, failed)
- `progress` - Progress percentage (0-100)
- `output_images` - JSONB array of image URLs
- `generation_time_seconds` - Generation time from metrics
- `estimated_cost_usd` - Estimated cost ($0.10)
- `error_message` - Error message if failed
- `started_at` - When processing started
- `completed_at` - When processing completed
- `updated_at` - Last update timestamp

## Environment Variables Required

```bash
REPLICATE_WEBHOOK_SECRET=your-webhook-secret
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

## Integration Points

### Upstream (Replicate)
- Receives webhooks from Replicate API
- Webhook URL: `{SITE_URL}/api/seedream/webhook`
- Configured in generate API when creating predictions

### Downstream (Database)
- Updates `seedream_jobs` table via Supabase service role
- Stores output image URLs and metrics

### Storage (Vercel Blob)
- Downloads images from Replicate URLs
- Uploads to Vercel Blob storage
- Path: `seedream-outputs/{userId}/{jobId}/{index}-{timestamp}.jpg`

## Performance Considerations

1. **Parallel Image Processing**: Downloads and uploads images sequentially to avoid overwhelming resources
2. **Timeout**: 60-second max duration for webhook processing
3. **Memory Efficient**: Streams images through buffers
4. **Rate Limiting**: Prevents resource exhaustion from webhook spam

## Monitoring and Debugging

### Log Events
- `WEBHOOK_REQUEST_START` - Webhook received
- `WEBHOOK_SIGNATURE_VALID` - Signature verified
- `WEBHOOK_PAYLOAD_PARSED` - Payload parsed successfully
- `JOB_FOUND` - Job located in database
- `IMAGE_DOWNLOAD_ATTEMPT` - Image download started
- `IMAGE_DOWNLOAD_SUCCESS` - Image downloaded
- `BLOB_UPLOAD_SUCCESS` - Image uploaded to blob
- `DATABASE_UPDATE_SUCCESS` - Job updated in database
- `WEBHOOK_PROCESSED` - Webhook processing complete

### Error Events
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `WEBHOOK_NO_SIGNATURE` - Missing signature
- `INVALID_WEBHOOK_SIGNATURE` - Invalid signature
- `WEBHOOK_JSON_PARSE_FAILED` - Invalid JSON
- `JOB_NOT_FOUND` - Job not found
- `IMAGE_DOWNLOAD_FAILED` - Image download failed
- `BLOB_UPLOAD_FAILED` - Blob upload failed
- `DATABASE_UPDATE_FAILED` - Database update failed

## Requirements Satisfied

✅ **Requirement 4.3**: Webhook receives results from Replicate  
✅ **Requirement 4.4**: Downloads images from Replicate URLs  
✅ **Requirement 4.5**: Uploads images to Vercel Blob for permanent storage  
✅ **Requirement 4.6**: Updates job record with output URLs and status  
✅ **Requirement 8.4**: Verifies webhook signature using REPLICATE_WEBHOOK_SECRET  

## Next Steps

1. Test webhook with real Replicate predictions
2. Monitor webhook processing times and success rates
3. Implement webhook delivery monitoring/alerting
4. Consider adding webhook event history to database
5. Implement cleanup for old webhook payload cache

## Notes

- Webhook handler is idempotent and safe to retry
- All image operations include retry logic
- Partial failures are handled gracefully
- Service role ensures webhooks can update any job
- Rate limiting prevents abuse while allowing legitimate traffic
- Signature verification ensures only Replicate can trigger webhooks
