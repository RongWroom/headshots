# Seedream Generate API Reference

Quick reference guide for the `/api/seedream/generate` endpoint.

## Endpoint

```
POST /api/seedream/generate
```

## Authentication

Requires Supabase authentication. Include session cookie in request.

## Request

### Headers
```
Content-Type: application/json
Cookie: sb-<project>-auth-token=<token>
```

### Body
```json
{
  "uploadId": "uuid",
  "styleId": "corporate-blue",
  "numOutputs": 10,
  "customizations": {
    "removeJewelry": true,
    "removeGlasses": false,
    "removePiercings": false,
    "cleanBackground": true
  }
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `uploadId` | string (UUID) | ✅ Yes | - | Upload ID from `/api/seedream/upload` |
| `styleId` | string | ✅ Yes | - | Style ID from catalog |
| `numOutputs` | number | ❌ No | 10 | Number of headshots (1-10) |
| `customizations` | object | ❌ No | null | Customization preferences |
| `customizations.removeJewelry` | boolean | ❌ No | false | Remove jewelry from headshots |
| `customizations.removeGlasses` | boolean | ❌ No | false | Remove glasses from headshots |
| `customizations.removePiercings` | boolean | ❌ No | false | Remove piercings from headshots |
| `customizations.cleanBackground` | boolean | ❌ No | false | Remove distracting background elements |

## Response

### Success (200)
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "estimatedTime": "60-90 seconds",
  "pollUrl": "/api/seedream/status/550e8400-e29b-41d4-a716-446655440000",
  "message": "Seedream headshot generation job created successfully"
}
```

### Error (4xx/5xx)
```json
{
  "success": false,
  "error": "Validation failed",
  "errorCode": "VALIDATION_ERROR",
  "details": {
    "validationErrors": ["styleId is required and must be a string"]
  },
  "suggestions": ["Use a valid styleId from the style catalog"]
}
```

## Available Styles

| Style ID | Name | Description | Category |
|----------|------|-------------|----------|
| `corporate-blue` | Corporate Blue | Professional blue gradient background | Corporate |
| `warm-studio` | Warm Studio | Warm-toned studio background | Corporate |
| `professional-gray` | Professional Gray | Classic neutral gray background | Corporate |
| `creative-teal` | Creative Teal | Modern teal gradient | Creative |
| `executive-charcoal` | Executive Charcoal | Sophisticated dark charcoal | Corporate |

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | User not authenticated |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UPLOAD_NOT_FOUND` | 404 | Upload doesn't exist or user doesn't own it |
| `UPLOAD_EXPIRED` | 410 | Upload older than 24 hours |
| `STYLE_NOT_FOUND` | 404 | Invalid style ID |
| `NO_IMAGES` | 400 | Upload contains no images |
| `DATABASE_ERROR` | 500 | Failed to create job |
| `REPLICATE_ERROR` | 500 | Failed to call Replicate API |
| `GENERATION_REQUEST_ERROR` | 500 | Unexpected error |

## Usage Examples

### JavaScript/TypeScript

```typescript
async function generateHeadshots(
  uploadId: string,
  styleId: string,
  customizations?: {
    removeJewelry?: boolean;
    removeGlasses?: boolean;
    removePiercings?: boolean;
    cleanBackground?: boolean;
  }
) {
  const response = await fetch('/api/seedream/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uploadId,
      styleId,
      numOutputs: 10,
      customizations,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const data = await response.json();
  return data.jobId;
}

// Usage
const jobId = await generateHeadshots(
  'upload-uuid',
  'corporate-blue',
  {
    removeJewelry: true,
    cleanBackground: true,
  }
);

console.log(`Job created: ${jobId}`);
```

### cURL

```bash
curl -X POST https://your-domain.com/api/seedream/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-project-auth-token=your-token" \
  -d '{
    "uploadId": "550e8400-e29b-41d4-a716-446655440000",
    "styleId": "corporate-blue",
    "numOutputs": 10,
    "customizations": {
      "removeJewelry": true,
      "removeGlasses": false,
      "removePiercings": false,
      "cleanBackground": true
    }
  }'
```

### Python

```python
import requests

def generate_headshots(upload_id, style_id, customizations=None):
    url = "https://your-domain.com/api/seedream/generate"
    
    payload = {
        "uploadId": upload_id,
        "styleId": style_id,
        "numOutputs": 10,
    }
    
    if customizations:
        payload["customizations"] = customizations
    
    response = requests.post(
        url,
        json=payload,
        cookies={"sb-project-auth-token": "your-token"}
    )
    
    response.raise_for_status()
    data = response.json()
    return data["jobId"]

# Usage
job_id = generate_headshots(
    upload_id="550e8400-e29b-41d4-a716-446655440000",
    style_id="corporate-blue",
    customizations={
        "removeJewelry": True,
        "cleanBackground": True,
    }
)

print(f"Job created: {job_id}")
```

## Workflow

1. **Upload Images** → `/api/seedream/upload`
   - Upload 1-5 reference photos
   - Receive `uploadId`

2. **Generate Headshots** → `/api/seedream/generate` (this endpoint)
   - Provide `uploadId` and `styleId`
   - Receive `jobId`

3. **Poll Status** → `/api/seedream/status/{jobId}`
   - Check job progress
   - Receive results when complete

4. **Download Results**
   - Download individual images
   - Or download all as ZIP

## Rate Limits

- **Uploads**: 10 per hour per user
- **Generations**: 5 per hour per user
- **Status Polls**: 30 per minute per job

## Cost Estimation

- **Replicate Cost**: ~$0.10 per generation (10 outputs)
- **Vercel Blob**: ~$0.01 per generation
- **Total**: ~$0.11 per generation

## Processing Time

- **Average**: 60-90 seconds
- **Range**: 45-120 seconds
- **Factors**: Image count, server load, model complexity

## Best Practices

1. **Upload First**: Always upload images before generating
2. **Check Expiration**: Uploads expire after 24 hours
3. **Poll Wisely**: Poll status every 3-5 seconds, not more
4. **Handle Errors**: Implement retry logic for transient failures
5. **Use Webhooks**: For production, rely on webhooks not polling
6. **Validate Inputs**: Validate on client before sending request
7. **Show Progress**: Display estimated time to users

## Troubleshooting

### "Upload not found"
- Verify `uploadId` is correct
- Check upload hasn't expired (24 hours)
- Ensure you own the upload

### "Invalid styleId"
- Use one of the available style IDs
- Check for typos in style ID

### "Authentication failed"
- Verify user is signed in
- Check session hasn't expired
- Include auth cookie in request

### "Replicate API error"
- Check `REPLICATE_API_TOKEN` is set
- Verify Replicate account has credits
- Check Replicate API status

## Support

For issues or questions:
1. Check error message and suggestions
2. Review this documentation
3. Check application logs
4. Contact support with job ID

## Related Endpoints

- **Upload**: `/api/seedream/upload` - Upload reference images
- **Status**: `/api/seedream/status/{jobId}` - Check job status
- **Webhook**: `/api/seedream/webhook` - Receive completion (internal)
