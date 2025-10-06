# Seedream Webhook API Reference

## Endpoint
```
POST /api/seedream/webhook
```

## Purpose
Receives completion notifications from Replicate Seedream API, downloads generated images, uploads them to Vercel Blob storage, and updates job records.

## Authentication
Requires valid HMAC signature in `replicate-signature` header.

## Headers

### Required
- `replicate-signature`: HMAC SHA-256 signature in format `sha256={hash}`
- `Content-Type`: `application/json`

### Optional
- `x-forwarded-for`: Client IP for rate limiting
- `x-real-ip`: Alternative client IP header

## Request Body

```typescript
{
  id: string;                    // Replicate prediction ID
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: string[] | null;       // Array of image URLs from Replicate
  error: string | null;          // Error message if failed
  metrics?: {
    predict_time?: number;       // Generation time in seconds
  };
}
```

## Response

### Success (200)
```json
{
  "success": true,
  "jobId": "uuid",
  "status": "completed",
  "message": "Webhook processed successfully"
}
```

### Duplicate (200)
```json
{
  "success": true,
  "message": "Webhook already processed",
  "duplicate": true
}
```

### Missing Signature (401)
```json
{
  "error": "Missing signature"
}
```

### Invalid Signature (401)
```json
{
  "error": "Invalid signature"
}
```

### Invalid JSON (400)
```json
{
  "error": "Invalid JSON"
}
```

### Missing Fields (400)
```json
{
  "error": "Missing required fields: id or status"
}
```

### Job Not Found (404)
```json
{
  "error": "Job not found",
  "predictionId": "string"
}
```

### Rate Limit (429)
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many webhook requests from this IP"
}
```

Headers:
- `X-RateLimit-Limit`: 100
- `X-RateLimit-Remaining`: 0
- `Retry-After`: 60

### Server Error (500)
```json
{
  "error": "Webhook processing failed",
  "message": "Error details"
}
```

## Signature Verification

### Algorithm
HMAC SHA-256 with `REPLICATE_WEBHOOK_SECRET`

### Format
```
replicate-signature: sha256={hex_digest}
```

### Example (Node.js)
```javascript
const crypto = require('crypto');

function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

const payload = JSON.stringify(webhookData);
const signature = generateSignature(payload, process.env.REPLICATE_WEBHOOK_SECRET);
```

## Rate Limiting

- **Limit**: 100 requests per minute per IP
- **Window**: 60 seconds (rolling)
- **Response**: 429 with `Retry-After: 60` header

## Idempotency

- Duplicate webhooks (same prediction ID + status) are detected
- Returns success response without reprocessing
- Cache TTL: 1 hour

## Processing Flow

1. **Validate Rate Limit** - Check IP-based rate limit
2. **Verify Signature** - Validate HMAC signature
3. **Parse Payload** - Parse and validate JSON
4. **Check Idempotency** - Detect duplicate webhooks
5. **Find Job** - Locate job by prediction ID
6. **Download Images** - Download from Replicate URLs (with retry)
7. **Upload to Blob** - Upload to Vercel Blob storage (with retry)
8. **Update Database** - Update job record with results
9. **Return Response** - Return success response

## Image Processing

### Download
- Source: Replicate image URLs from `output` array
- Retry: 3 attempts with exponential backoff
- Timeout: Part of 60-second webhook timeout

### Upload
- Destination: `seedream-outputs/{userId}/{jobId}/{index}-{timestamp}.jpg`
- Storage: Vercel Blob (public access)
- Retry: 3 attempts with exponential backoff
- Content-Type: `image/jpeg`

### Partial Failures
- Continues processing remaining images if some fail
- Stores successfully uploaded images
- Marks job as failed if all images fail

## Status Mapping

| Replicate Status | Internal Status | Progress |
|-----------------|-----------------|----------|
| starting        | processing      | 10%      |
| processing      | processing      | 50%      |
| succeeded       | completed       | 100%     |
| failed          | failed          | -        |
| canceled        | failed          | -        |

## Database Updates

### Fields Updated
- `status` - Job status
- `progress` - Progress percentage
- `output_images` - Array of blob URLs
- `generation_time_seconds` - From metrics
- `estimated_cost_usd` - Fixed at $0.10
- `error_message` - Error if failed
- `updated_at` - Current timestamp

### Triggers
- `started_at` - Set when status changes to processing
- `completed_at` - Set when status changes to completed/failed

## Error Handling

### Retryable Errors (500)
- Database connection failures
- Temporary network issues
- Replicate will automatically retry

### Non-Retryable Errors (4xx)
- Invalid signature (401)
- Invalid payload (400)
- Job not found (404)
- Rate limit exceeded (429)

## Monitoring

### Success Metrics
- Webhook processing time
- Image download success rate
- Blob upload success rate
- Database update success rate

### Error Metrics
- Signature validation failures
- Rate limit hits
- Job not found errors
- Image processing failures

## Testing

### Test Script
```bash
node test-seedream-webhook.js
```

### Test Cases
1. Valid webhook with signature
2. Invalid signature
3. Missing signature
4. Invalid JSON
5. Missing required fields
6. Idempotency (duplicates)
7. Successful completion
8. Failed generation

## Configuration

### Environment Variables
```bash
REPLICATE_WEBHOOK_SECRET=your-webhook-secret
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

### Replicate Configuration
Set webhook URL when creating predictions:
```typescript
{
  webhook: `${SITE_URL}/api/seedream/webhook`,
  webhook_events_filter: ['completed']
}
```

## Security

1. **Signature Verification**: All webhooks must have valid HMAC signature
2. **Timing-Safe Comparison**: Prevents timing attacks
3. **Rate Limiting**: Prevents abuse (100 req/min per IP)
4. **Service Role**: Uses Supabase service role for database access
5. **Input Validation**: Validates all required fields

## Performance

- **Max Duration**: 60 seconds
- **Concurrent Processing**: Sequential image processing
- **Memory**: Streams images through buffers
- **Retry Logic**: Exponential backoff (1s, 2s, 4s, max 10s)

## Troubleshooting

### Webhook Not Received
1. Check Replicate webhook configuration
2. Verify webhook URL is publicly accessible
3. Check firewall/security group settings

### Signature Validation Fails
1. Verify `REPLICATE_WEBHOOK_SECRET` matches Replicate config
2. Check signature header name (`replicate-signature`)
3. Ensure payload is not modified before verification

### Images Not Uploading
1. Check `BLOB_READ_WRITE_TOKEN` is configured
2. Verify Vercel Blob storage is accessible
3. Check image URLs from Replicate are valid
4. Review logs for specific error messages

### Job Not Found
1. Verify job was created with correct `replicate_prediction_id`
2. Check database connection
3. Ensure RLS policies allow service role access

## Example Webhook Payload

### Successful Generation
```json
{
  "id": "abc123xyz",
  "status": "succeeded",
  "output": [
    "https://replicate.delivery/pbxt/image1.jpg",
    "https://replicate.delivery/pbxt/image2.jpg",
    "https://replicate.delivery/pbxt/image3.jpg"
  ],
  "error": null,
  "metrics": {
    "predict_time": 65.5
  }
}
```

### Failed Generation
```json
{
  "id": "abc123xyz",
  "status": "failed",
  "output": null,
  "error": "Out of memory during generation",
  "metrics": null
}
```

## Related Endpoints

- `POST /api/seedream/generate` - Creates job and prediction
- `GET /api/seedream/status/[jobId]` - Polls job status
- `POST /api/seedream/upload` - Uploads reference images

## Support

For issues or questions:
1. Check logs for detailed error messages
2. Review test script output
3. Verify environment variables
4. Check Replicate webhook logs
