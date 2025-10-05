# Headshots Webhook API Implementation Summary

## Overview

This document summarizes the implementation of the webhook endpoint (`/api/headshots/webhook`) that receives callbacks from RunPod ComfyUI with generation progress updates and results.

**Implementation Date:** 2025-01-10  
**Status:** ✅ Complete  
**Spec Reference:** `.kiro/specs/comfyui-headshot-generation/`

---

## Implemented Features

### Task 5.1: POST /api/headshots/webhook ✅

**Location:** `app/api/headshots/webhook/route.ts`

**Key Features:**
- ✅ HMAC signature validation for webhook security
- ✅ Webhook payload parsing and validation
- ✅ Database updates for job status and progress
- ✅ Base64 image upload to Vercel Blob Storage
- ✅ Job completion and error handling
- ✅ Metadata storage (generation time, detected features)

**Request Format:**
```typescript
POST /api/headshots/webhook
Headers:
  x-webhook-signature: <hmac-sha256-signature>
  Content-Type: application/json

Body:
{
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  images?: string[]; // Base64 encoded
  error?: string;
  metadata?: {
    generation_time?: number;
    detected_features?: Record<string, any>;
  };
}
```

**Response Format:**
```typescript
{
  success: boolean;
  jobId: string;
  status: string;
  message: string;
  duplicate?: boolean; // If webhook was already processed
}
```

**Status Codes:**
- `200` - Webhook processed successfully
- `400` - Invalid payload or JSON
- `401` - Invalid signature
- `404` - Job not found
- `429` - Rate limit exceeded
- `500` - Database or processing error

### Task 5.2: Webhook Retries and Idempotency ✅

**Idempotency Implementation:**
- In-memory store tracks processed webhooks by `jobId-status-progress` key
- Duplicate webhooks within 1-hour window return success without reprocessing
- Prevents duplicate database updates and image uploads
- Returns `{ success: true, duplicate: true }` for duplicates

**Retry Handling:**
- Returns 500 status for transient errors (database failures, etc.)
- RunPod will automatically retry failed webhooks with exponential backoff
- Webhook payloads stored for 1 hour for debugging
- Graceful handling of partial failures (e.g., some image uploads fail)

**Payload Storage:**
- All webhook payloads stored in memory for debugging
- Automatic cleanup after 1-hour TTL
- Helps diagnose issues and verify webhook delivery

### Task 5.3: Webhook Security ✅

**HMAC Signature Validation:**
- Uses SHA-256 HMAC with secret key
- Timing-safe comparison to prevent timing attacks
- Signature expected in `x-webhook-signature` or `x-runpod-signature` header
- Falls back to allowing unsigned webhooks in development (with warning)

**Rate Limiting:**
- 100 requests per minute per IP address
- In-memory rate limit store with automatic cleanup
- Returns 429 status with `Retry-After` header when exceeded
- Rate limit headers included in all responses:
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: <count>`

**IP-Based Protection:**
- Extracts client IP from `x-forwarded-for` or `x-real-ip` headers
- Rate limiting applied per IP
- Optional: Can be extended to whitelist RunPod IPs

**Service Role Authentication:**
- Uses Supabase service role key for database updates
- Bypasses Row Level Security policies
- Allows webhook to update any job regardless of user

---

## Database Updates

The webhook updates the `generation_jobs` table with:

**Always Updated:**
- `status` - Current job status
- `updated_at` - Timestamp of update

**Conditionally Updated:**
- `progress` - Progress percentage (0-100)
- `progress_message` - User-friendly status message
- `error_message` - Error details if failed
- `output_images` - Array of Vercel Blob URLs (when images provided)
- `generation_time_seconds` - Total generation time
- `detected_features` - JSONB with facial features detected
- `started_at` - Timestamp when processing started
- `completed_at` - Timestamp when completed or failed

---

## Image Upload Flow

When webhook includes base64 images:

1. **Receive Base64 Images**
   - Webhook payload includes array of base64-encoded PNG images
   - Typically 4 images per generation

2. **Upload to Vercel Blob**
   - Each image uploaded to `headshots/{jobId}/output-{index}-{timestamp}.png`
   - Public access enabled
   - Content-Type: `image/png`
   - Parallel uploads for speed

3. **Store URLs**
   - Successful upload URLs stored in `output_images` array
   - Failed uploads logged but don't fail entire webhook
   - If all uploads fail, job marked as failed

4. **Error Handling**
   - Individual upload failures logged
   - Job continues if at least one image uploads successfully
   - Job marked failed only if all uploads fail

---

## Security Considerations

### HMAC Signature Validation

**Algorithm:** SHA-256 HMAC
**Secret:** `RUNPOD_WEBHOOK_SECRET` or `APP_WEBHOOK_SECRET` env var

**Validation Process:**
1. Extract signature from `x-webhook-signature` header
2. Compute expected signature from raw request body
3. Use timing-safe comparison to prevent timing attacks
4. Reject webhook if signatures don't match

**Example Signature Generation (Node.js):**
```javascript
const crypto = require('crypto');

function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

const signature = generateSignature(JSON.stringify(webhookPayload), secret);
```

### Rate Limiting

**Limits:**
- 100 requests per minute per IP
- Sliding window implementation
- Automatic reset after 1 minute

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
Retry-After: 60 (when rate limited)
```

### Development vs Production

**Development:**
- Unsigned webhooks allowed (with warning logged)
- Useful for local testing without signature setup

**Production:**
- Should enforce signature validation
- Set `RUNPOD_WEBHOOK_SECRET` environment variable
- Monitor logs for unsigned webhook warnings

---

## Testing

### Test Script

**Location:** `test-headshots-webhook.js`

**Usage:**
```bash
# Set environment variables
export NEXT_PUBLIC_SITE_URL=http://localhost:3000
export RUNPOD_WEBHOOK_SECRET=your-secret-key

# Run tests
node test-headshots-webhook.js
```

**Test Coverage:**
1. ✅ Processing webhook (progress update)
2. ✅ Completed webhook with images
3. ✅ Failed webhook with error
4. ✅ Invalid signature rejection
5. ✅ Missing signature handling
6. ✅ Invalid payload rejection
7. ✅ Idempotency (duplicate webhooks)
8. ✅ Rate limiting (optional)

### Manual Testing

**1. Create a test job:**
```bash
node test-headshots-generate-api.js
# Note the returned jobId
```

**2. Send test webhook:**
```bash
curl -X POST http://localhost:3000/api/headshots/webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: <computed-signature>" \
  -d '{
    "jobId": "your-job-id",
    "status": "processing",
    "progress": 50,
    "message": "Generating headshots..."
  }'
```

**3. Check job status:**
```bash
curl http://localhost:3000/api/headshots/status/your-job-id
```

---

## Environment Variables

Add to `.env.local`:

```bash
# Webhook secret for signature validation
RUNPOD_WEBHOOK_SECRET=your-webhook-secret-key

# Or use the existing app webhook secret
APP_WEBHOOK_SECRET=your-app-webhook-secret

# Required for image uploads
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token

# Required for database updates
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Integration with RunPod

### RunPod Workflow Configuration

The RunPod ComfyUI workflow should send webhooks at key stages:

**Progress Updates:**
```python
# In RunPod handler.py
import requests

def send_webhook(webhook_url, job_id, status, progress, message):
    payload = {
        "jobId": job_id,
        "status": status,
        "progress": progress,
        "message": message
    }
    
    # Generate signature
    import hmac
    import hashlib
    secret = os.environ.get('WEBHOOK_SECRET')
    signature = hmac.new(
        secret.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()
    
    headers = {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature
    }
    
    requests.post(webhook_url, json=payload, headers=headers)

# Send progress updates
send_webhook(webhook_url, job_id, 'processing', 20, 'Removing backgrounds...')
send_webhook(webhook_url, job_id, 'processing', 40, 'Analyzing faces...')
send_webhook(webhook_url, job_id, 'processing', 60, 'Generating headshots...')
```

**Completion with Images:**
```python
import base64

# Convert images to base64
images_base64 = []
for image_path in output_images:
    with open(image_path, 'rb') as f:
        image_data = f.read()
        images_base64.append(base64.b64encode(image_data).decode('utf-8'))

# Send completion webhook
payload = {
    "jobId": job_id,
    "status": "completed",
    "progress": 100,
    "message": "Complete!",
    "images": images_base64,
    "metadata": {
        "generation_time": 87.5,
        "detected_features": {
            "gender": "male",
            "skin_tone": "medium",
            "hair_color": "brown"
        }
    }
}

send_webhook_with_signature(webhook_url, payload, secret)
```

---

## Error Handling

### Webhook Processing Errors

**Database Update Failure:**
- Returns 500 status
- RunPod will retry automatically
- Error logged with full context

**Image Upload Failure:**
- Individual failures logged
- Job continues if at least one succeeds
- Job marked failed if all uploads fail

**Invalid Payload:**
- Returns 400 status
- No retry (client error)
- Validation errors returned in response

**Job Not Found:**
- Returns 404 status
- No retry (job may have been deleted)
- Logged for investigation

### Retry Strategy

**Transient Errors (500):**
- RunPod retries with exponential backoff
- Typical retry schedule: 1s, 2s, 4s, 8s, 16s, 32s
- Max retries: 5-10 (configurable in RunPod)

**Permanent Errors (400, 404):**
- No retry
- Logged for manual investigation

---

## Monitoring and Logging

### Log Events

All webhook events logged with structured data:

**Success Events:**
- `WEBHOOK_REQUEST_START` - Webhook received
- `WEBHOOK_SIGNATURE_VALID` - Signature validated
- `WEBHOOK_PAYLOAD_PARSED` - Payload parsed successfully
- `DATABASE_UPDATE_SUCCESS` - Job updated in database
- `IMAGE_UPLOAD_COMPLETE` - Images uploaded to Blob
- `WEBHOOK_PROCESSED` - Webhook fully processed

**Warning Events:**
- `WEBHOOK_NO_SIGNATURE` - Unsigned webhook (dev mode)
- `WEBHOOK_DUPLICATE_DETECTED` - Duplicate webhook handled

**Error Events:**
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INVALID_WEBHOOK_SIGNATURE` - Signature validation failed
- `WEBHOOK_JSON_PARSE_FAILED` - Invalid JSON
- `WEBHOOK_INVALID_PAYLOAD` - Missing required fields
- `DATABASE_UPDATE_FAILED` - Database error
- `IMAGE_UPLOAD_FAILED` - Blob upload error
- `JOB_NOT_FOUND` - Job doesn't exist
- `WEBHOOK_ERROR` - Unexpected error

### Metrics to Monitor

**Success Rate:**
- Track successful vs failed webhooks
- Alert if success rate drops below 95%

**Processing Time:**
- Track webhook processing duration
- Alert if p95 exceeds 5 seconds

**Image Upload Success:**
- Track image upload success rate
- Alert if rate drops below 90%

**Rate Limit Hits:**
- Track rate limit violations
- Investigate if frequent

---

## Next Steps

### Completed ✅
- [x] Task 5.1: Implement POST /api/headshots/webhook
- [x] Task 5.2: Handle webhook retries and idempotency
- [x] Task 5.3: Add webhook security

### Remaining Tasks
- [ ] Task 6: Build ComfyUI workflow nodes
- [ ] Task 7: Test ComfyUI workflow end-to-end
- [ ] Task 8: Create HeadshotGenerationZone component
- [ ] Task 9: Conduct comprehensive testing
- [ ] Task 10: Set up monitoring and logging
- [ ] Task 11: Optimize performance and costs
- [ ] Task 12: Prepare for production launch
- [ ] Task 13: Gather feedback and iterate

### Integration Testing

Once RunPod workflow is deployed:

1. **End-to-End Test:**
   - Upload photos via generate endpoint
   - Monitor webhook callbacks
   - Verify images uploaded to Blob
   - Check job status updates
   - Confirm completion

2. **Load Testing:**
   - Test concurrent webhook delivery
   - Verify rate limiting works
   - Check database performance
   - Monitor Blob upload speed

3. **Error Scenarios:**
   - Test webhook retry logic
   - Verify idempotency
   - Test partial image upload failures
   - Confirm error handling

---

## API Documentation

### Webhook Endpoint

**Endpoint:** `POST /api/headshots/webhook`

**Authentication:** HMAC signature in `x-webhook-signature` header

**Request Body:**
```typescript
{
  jobId: string;              // Required: UUID of generation job
  status: string;             // Required: 'processing' | 'completed' | 'failed'
  progress?: number;          // Optional: 0-100
  message?: string;           // Optional: User-friendly status message
  images?: string[];          // Optional: Base64 encoded images
  error?: string;             // Optional: Error message if failed
  metadata?: {
    generation_time?: number;           // Seconds
    detected_features?: Record<string, any>;
  };
}
```

**Response (Success):**
```typescript
{
  success: true,
  jobId: string,
  status: string,
  message: string,
  duplicate?: boolean
}
```

**Response (Error):**
```typescript
{
  success: false,
  error: string,
  message: string,
  code: string,
  details?: any,
  suggestions?: string[]
}
```

**Rate Limits:**
- 100 requests per minute per IP
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

---

## Conclusion

The webhook endpoint is fully implemented with:
- ✅ Secure HMAC signature validation
- ✅ Comprehensive error handling
- ✅ Idempotency for duplicate webhooks
- ✅ Rate limiting for protection
- ✅ Image upload to Vercel Blob
- ✅ Database updates with metadata
- ✅ Detailed logging and monitoring
- ✅ Test coverage

The endpoint is ready for integration with the RunPod ComfyUI workflow.
