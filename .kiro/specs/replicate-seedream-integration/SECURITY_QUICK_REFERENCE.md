# Seedream Security Quick Reference

## Authentication

All endpoints require Supabase authentication except webhooks (which use signature verification).

### Checking Authentication:
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser();

if (authError || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const userId = user.id;
```

## Rate Limiting

### Import:
```typescript
import { checkRateLimit, RateLimitPresets, createRateLimitHeaders } from '@/lib/rate-limiter';
```

### Check Rate Limit:
```typescript
const rateLimit = checkRateLimit(userId, 'upload', RateLimitPresets.UPLOAD);

if (!rateLimit.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
    { 
      status: 429,
      headers: createRateLimitHeaders(rateLimit, RateLimitPresets.UPLOAD)
    }
  );
}
```

### Rate Limit Presets:
- **UPLOAD**: 10 requests per hour per user
- **GENERATE**: 5 requests per hour per user
- **STATUS_POLL**: 30 requests per minute per job
- **WEBHOOK**: 100 requests per minute per IP

### Add Headers to Response:
```typescript
const rateLimitHeaders = createRateLimitHeaders(rateLimit, RateLimitPresets.UPLOAD);
for (const [key, value] of Object.entries(rateLimitHeaders)) {
  response.headers.set(key, value);
}
```

## Input Validation

### File Upload Validation:
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File too large' };
  }
  
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type' };
  }
  
  return { valid: true };
}
```

### Request Body Validation:
```typescript
function validateRequest(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.uploadId || typeof data.uploadId !== 'string') {
    errors.push('uploadId is required and must be a string');
  }
  
  if (!data.styleId || typeof data.styleId !== 'string') {
    errors.push('styleId is required and must be a string');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

## Webhook Security

### Signature Verification:
```typescript
import crypto from 'crypto';

function validateWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  
  const signatureValue = signature.replace(/^sha256=/, '');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signatureValue, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
```

### Usage:
```typescript
const rawBody = await req.text();
const signature = req.headers.get('replicate-signature');
const webhookSecret = process.env.REPLICATE_WEBHOOK_SECRET!;

if (!validateWebhookSignature(rawBody, signature, webhookSecret)) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}
```

## Secure Blob Paths

### Upload Path:
```typescript
const uploadId = crypto.randomUUID();
const timestamp = Date.now();
const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
const blobPath = `seedream-uploads/${userId}/${uploadId}/${timestamp}-${index}-${sanitizedFilename}`;
```

### Output Path:
```typescript
const timestamp = Date.now();
const filename = `seedream-outputs/${userId}/${jobId}/${index}-${timestamp}.jpg`;
```

## RLS Policies

### Query with RLS:
```typescript
// RLS automatically filters by user_id = auth.uid()
const { data, error } = await supabase
  .from('seedream_jobs')
  .select('*')
  .eq('id', jobId)
  .single();
```

### Service Role (Bypass RLS):
```typescript
// Use service role for webhook updates
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

## Error Responses

### Standard Error Format:
```typescript
return NextResponse.json({
  success: false,
  error: 'Error title',
  message: 'User-friendly error message',
  errorCode: 'ERROR_CODE',
  details: { /* additional context */ },
  suggestions: [
    'Suggestion 1',
    'Suggestion 2'
  ]
}, { status: 400 });
```

## Environment Variables

### Required:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (webhooks)
- `REPLICATE_API_TOKEN` - Replicate API token
- `REPLICATE_WEBHOOK_SECRET` - Webhook signature secret
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token

### Validation:
```typescript
if (!process.env.REPLICATE_WEBHOOK_SECRET) {
  return NextResponse.json(
    { error: 'Webhook not configured' },
    { status: 500 }
  );
}
```

## Testing

### Test Authentication:
```bash
# Without auth - should return 401
curl -X POST http://localhost:3000/api/seedream/upload

# With auth - should work
curl -X POST http://localhost:3000/api/seedream/upload \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Rate Limiting:
```bash
# Set test credentials
export TEST_USER_EMAIL="your-test-user@example.com"
export TEST_USER_PASSWORD="your-test-password"

# Run rate limiting test suite
node test-seedream-rate-limiting.js
```

### Test Webhook Signature:
```bash
# With invalid signature - should return 401
curl -X POST http://localhost:3000/api/seedream/webhook \
  -H "Content-Type: application/json" \
  -H "replicate-signature: sha256=invalid" \
  -d '{"id":"test","status":"succeeded"}'
```

## Security Checklist

Before deploying to production:

- [ ] All endpoints verify authentication
- [ ] RLS policies are enabled on all tables
- [ ] Rate limiting is configured on all endpoints
- [ ] Webhook signature verification is enabled
- [ ] All user inputs are validated
- [ ] Blob paths use UUIDs and timestamps
- [ ] Environment variables are set
- [ ] Error messages don't expose sensitive data
- [ ] Logging is configured for security events
- [ ] HTTPS is enforced
- [ ] CORS is properly configured
- [ ] Security headers are set (CSP, etc.)

## Common Issues

### Rate Limit Not Working:
- Check that rate limiter is imported
- Verify rate limit check is before processing
- Ensure headers are added to response

### Authentication Failing:
- Check Supabase URL and keys
- Verify cookie handling in Supabase client
- Check that user session is valid

### Webhook Signature Invalid:
- Verify REPLICATE_WEBHOOK_SECRET is set
- Check that raw body is used for signature
- Ensure signature header format is correct

### RLS Blocking Queries:
- Verify user is authenticated
- Check RLS policies in database
- Use service role for webhook updates only

## Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Replicate Webhooks Documentation](https://replicate.com/docs/webhooks)
- [Vercel Blob Documentation](https://vercel.com/docs/storage/vercel-blob)
