# Webhook Quick Reference Guide

## Overview

Quick reference for integrating with the `/api/headshots/webhook` endpoint.

---

## Endpoint Details

**URL:** `POST /api/headshots/webhook`  
**Authentication:** HMAC SHA-256 signature  
**Content-Type:** `application/json`

---

## Request Format

### Headers

```
Content-Type: application/json
x-webhook-signature: <hmac-sha256-hex-signature>
```

### Body

```json
{
  "jobId": "uuid-of-generation-job",
  "status": "processing|completed|failed",
  "progress": 50,
  "message": "User-friendly status message",
  "images": ["base64-image-1", "base64-image-2"],
  "error": "Error message if failed",
  "metadata": {
    "generation_time": 87.5,
    "detected_features": {
      "gender": "male",
      "skin_tone": "medium",
      "hair_color": "brown"
    }
  }
}
```

---

## Signature Generation

### Node.js / JavaScript

```javascript
const crypto = require('crypto');

function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

// Usage
const payload = { jobId: '...', status: 'processing', ... };
const secret = process.env.WEBHOOK_SECRET;
const signature = generateSignature(payload, secret);

// Send request
fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-webhook-signature': signature
  },
  body: JSON.stringify(payload)
});
```

### Python

```python
import hmac
import hashlib
import json
import requests

def generate_signature(payload, secret):
    payload_str = json.dumps(payload)
    signature = hmac.new(
        secret.encode(),
        payload_str.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature

# Usage
payload = {'jobId': '...', 'status': 'processing', ...}
secret = os.environ.get('WEBHOOK_SECRET')
signature = generate_signature(payload, secret)

# Send request
headers = {
    'Content-Type': 'application/json',
    'x-webhook-signature': signature
}
requests.post(webhook_url, json=payload, headers=headers)
```

---

## Webhook Stages

### 1. Processing Started (10%)

```json
{
  "jobId": "job-uuid",
  "status": "processing",
  "progress": 10,
  "message": "Loading reference images..."
}
```

### 2. Background Removal (20%)

```json
{
  "jobId": "job-uuid",
  "status": "processing",
  "progress": 20,
  "message": "Removing backgrounds..."
}
```

### 3. Face Analysis (40%)

```json
{
  "jobId": "job-uuid",
  "status": "processing",
  "progress": 40,
  "message": "Analyzing facial features..."
}
```

### 4. Generation (60%)

```json
{
  "jobId": "job-uuid",
  "status": "processing",
  "progress": 60,
  "message": "Generating professional headshots..."
}
```

### 5. Style Refinement (80%)

```json
{
  "jobId": "job-uuid",
  "status": "processing",
  "progress": 80,
  "message": "Refining photography style..."
}
```

### 6. Completion (100%)

```json
{
  "jobId": "job-uuid",
  "status": "completed",
  "progress": 100,
  "message": "Complete!",
  "images": [
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ...",
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ...",
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ...",
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ..."
  ],
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

### 7. Failure

```json
{
  "jobId": "job-uuid",
  "status": "failed",
  "progress": 50,
  "message": "Generation failed",
  "error": "Face detection failed: No clear faces found in uploaded photos"
}
```

---

## Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Webhook processed |
| 400 | Bad Request | Fix payload format |
| 401 | Unauthorized | Check signature |
| 404 | Not Found | Job doesn't exist |
| 429 | Rate Limited | Wait and retry |
| 500 | Server Error | Retry automatically |

---

## Rate Limits

- **Limit:** 100 requests per minute per IP
- **Headers:** 
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: 95`
  - `Retry-After: 60` (when rate limited)

---

## Testing

### Local Testing

```bash
# Set environment variables
export NEXT_PUBLIC_SITE_URL=http://localhost:3000
export RUNPOD_WEBHOOK_SECRET=your-secret-key

# Run test script
node test-headshots-webhook.js
```

### Manual cURL Test

```bash
# Generate signature (use script or online tool)
SIGNATURE=$(echo -n '{"jobId":"test-id","status":"processing"}' | \
  openssl dgst -sha256 -hmac "your-secret" | \
  awk '{print $2}')

# Send webhook
curl -X POST http://localhost:3000/api/headshots/webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $SIGNATURE" \
  -d '{"jobId":"test-id","status":"processing","progress":50}'
```

---

## Common Issues

### Issue: 401 Invalid Signature

**Cause:** Signature doesn't match payload

**Solutions:**
- Ensure secret matches on both sides
- Verify payload is exactly the same (no whitespace changes)
- Check signature is hex-encoded
- Use timing-safe comparison

### Issue: 429 Rate Limited

**Cause:** Too many requests from same IP

**Solutions:**
- Implement exponential backoff
- Reduce webhook frequency
- Contact admin to increase limits

### Issue: 500 Server Error

**Cause:** Database or storage error

**Solutions:**
- Webhook will be retried automatically
- Check server logs for details
- Verify database connection
- Verify Blob storage configuration

---

## Environment Variables

Required in `.env.local`:

```bash
# Webhook signature validation
RUNPOD_WEBHOOK_SECRET=your-webhook-secret

# Database access (service role for webhooks)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Image storage
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token

# Site URL for webhook URL generation
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

---

## Best Practices

1. **Always Include Signature**
   - Generate HMAC signature for every webhook
   - Use secure secret (32+ characters)

2. **Handle Retries**
   - Implement exponential backoff
   - Max 5-10 retries
   - Log all retry attempts

3. **Idempotency**
   - Webhooks may be delivered multiple times
   - Endpoint handles duplicates automatically
   - Safe to retry on 500 errors

4. **Progress Updates**
   - Send webhooks at key stages (10%, 20%, 40%, 60%, 80%, 100%)
   - Include descriptive messages
   - Update progress smoothly

5. **Image Format**
   - Send images as base64 strings
   - Remove data URL prefix if present
   - PNG format recommended
   - Max 4 images per webhook

6. **Error Handling**
   - Always include error message on failure
   - Set status to 'failed'
   - Include partial progress if available

---

## Support

For issues or questions:
- Check logs: `Logger` class provides detailed logging
- Review test script: `test-headshots-webhook.js`
- See full documentation: `HEADSHOTS_WEBHOOK_API_IMPLEMENTATION.md`
