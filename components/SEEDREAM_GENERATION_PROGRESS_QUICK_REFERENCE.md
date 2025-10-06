# Seedream Generation Progress - Quick Reference

## Component Import

```tsx
import SeedreamGenerationProgress from '@/components/SeedreamGenerationProgress';
```

## Basic Usage

```tsx
<SeedreamGenerationProgress
  jobId="uuid-here"
  onComplete={(outputs) => console.log('Done!', outputs)}
  onError={(error) => console.error('Failed:', error)}
/>
```

## Props Quick Reference

```tsx
interface Props {
  jobId: string;                    // Required: Job UUID
  onComplete?: (outputs) => void;   // Optional: Success callback
  onError?: (error) => void;        // Optional: Error callback
  onCancel?: () => void;            // Optional: Cancel callback (shows cancel button)
  pollInterval?: number;            // Optional: Default 3000ms
  maxPollDuration?: number;         // Optional: Default 600000ms (10 min)
}
```

## Generation Phases

| Progress | Phase | Description |
|----------|-------|-------------|
| 0% | Initializing | Preparing request |
| 1-19% | Uploading | Sending images |
| 20-89% | Processing | Generating headshots |
| 90-99% | Finalizing | Preparing results |
| 100% | Completed | Ready! |
| - | Failed | Error occurred |

## Status Response Structure

```tsx
interface StatusResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;                 // 0-100
  estimatedTimeRemaining?: string;  // "45 seconds"
  outputs?: Array<{
    url: string;
    thumbnail: string;
  }>;
  error?: string;
  suggestions?: string[];
  generationTime?: number;
  createdAt: string;
  completedAt?: string;
}
```

## Complete Workflow Example

```tsx
'use client';

import { useState } from 'react';
import SeedreamGenerationProgress from '@/components/SeedreamGenerationProgress';

export default function GenerationPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState([]);

  const startGeneration = async () => {
    const res = await fetch('/api/seedream/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId: 'upload-id',
        styleId: 'corporate-blue',
        numOutputs: 10,
      }),
    });
    
    const data = await res.json();
    if (data.success) {
      setJobId(data.jobId);
    }
  };

  return (
    <div>
      {!jobId ? (
        <button onClick={startGeneration}>
          Start Generation
        </button>
      ) : !outputs.length ? (
        <SeedreamGenerationProgress
          jobId={jobId}
          onComplete={setOutputs}
          onError={(err) => alert(err)}
          onCancel={() => setJobId(null)}
        />
      ) : (
        <div>
          <h2>Results ({outputs.length} images)</h2>
          {outputs.map((img, i) => (
            <img key={i} src={img.url} alt={`Result ${i}`} />
          ))}
        </div>
      )}
    </div>
  );
}
```

## Error Handling

### Automatic Retry
- Retries up to 3 times on connection errors
- Shows retry indicator
- Manual retry button after 3 failures

### Rate Limiting
- Handles 429 responses gracefully
- Continues polling on next interval

### Long-running Jobs
- Shows notice after 2 minutes
- Times out after 10 minutes (configurable)

## Styling & Icons

### Phase Colors
- **Blue**: Initializing, Uploading
- **Purple**: Processing
- **Green**: Finalizing, Completed
- **Red**: Failed

### Icons Used
- `Loader2`: Spinning loader
- `Sparkles`: Processing phase
- `CheckCircle`: Success
- `AlertCircle`: Error
- `Clock`: Time indicators
- `RefreshCw`: Retry
- `XCircle`: Failed state

## API Endpoint

```
GET /api/seedream/status/{jobId}
```

### Rate Limits
- Max 1 request per 2 seconds per job
- Returns 429 if exceeded

### Response Codes
- `200`: Success
- `401`: Unauthorized
- `403`: Forbidden (not your job)
- `404`: Job not found
- `429`: Rate limited
- `500`: Server error

## Performance Tips

1. **Polling Interval**: Default 3s is optimal
2. **Cleanup**: Component auto-cleans on unmount
3. **Memory**: No memory leaks from polling
4. **Caching**: Completed jobs cached for 1 hour

## Common Issues

### Not Polling
- Check jobId is valid UUID
- Verify API endpoint accessible
- Check browser console

### Progress Stuck
- Verify webhook handler working
- Check database updates
- Try fallback polling (after 2 min)

### Rate Limit Errors
- Don't poll faster than 3 seconds
- Check multiple instances not running
- Verify API configuration

## Testing Checklist

- [ ] Renders with valid jobId
- [ ] Progress bar updates
- [ ] Time displays correctly
- [ ] Phase transitions work
- [ ] Completed state shows
- [ ] Failed state shows
- [ ] Retry logic works
- [ ] Cancel button works
- [ ] Cleans up on unmount

## Related Files

- Component: `components/SeedreamGenerationProgress.tsx`
- API: `app/api/seedream/status/[jobId]/route.ts`
- Types: `types/seedream.ts`
- Docs: `components/README-SeedreamGenerationProgress.md`

## Key Features

✅ Real-time progress tracking
✅ Phase-based UI
✅ Automatic retry logic
✅ Rate limit handling
✅ Long-running job support
✅ Error messages with suggestions
✅ Elapsed time tracking
✅ Estimated time remaining
✅ Cancel support
✅ Responsive design
