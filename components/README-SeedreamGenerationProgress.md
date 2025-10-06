# SeedreamGenerationProgress Component

## Overview

The `SeedreamGenerationProgress` component provides a real-time progress tracking UI for Seedream headshot generation jobs. It polls the status endpoint, displays progress indicators, estimated time remaining, and handles various states including success, failure, and long-running generations.

## Features

- **Real-time Progress Tracking**: Polls the status endpoint every 3 seconds (configurable)
- **Phase-based UI**: Shows different phases (initializing, uploading, processing, finalizing, completed, failed)
- **Progress Bar**: Visual progress indicator with percentage
- **Time Tracking**: Displays elapsed time and estimated time remaining
- **Error Handling**: Gracefully handles errors with retry logic and user-friendly messages
- **Rate Limiting**: Respects API rate limits (429 responses)
- **Long-running Generation Support**: Shows special notices for generations taking longer than expected
- **Retry Logic**: Automatically retries failed requests up to 3 times with exponential backoff
- **Cancellation**: Optional cancel button to stop polling

## Usage

### Basic Usage

```tsx
import SeedreamGenerationProgress from '@/components/SeedreamGenerationProgress';

function MyComponent() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Array<{ url: string; thumbnail: string }>>([]);

  const handleComplete = (generatedOutputs) => {
    setOutputs(generatedOutputs);
    console.log('Generation complete!', generatedOutputs);
  };

  const handleError = (error) => {
    console.error('Generation failed:', error);
  };

  return (
    <div>
      {jobId && (
        <SeedreamGenerationProgress
          jobId={jobId}
          onComplete={handleComplete}
          onError={handleError}
        />
      )}
    </div>
  );
}
```

### With Custom Poll Interval

```tsx
<SeedreamGenerationProgress
  jobId={jobId}
  onComplete={handleComplete}
  onError={handleError}
  pollInterval={5000} // Poll every 5 seconds instead of 3
  maxPollDuration={15 * 60 * 1000} // 15 minutes max
/>
```

### With Cancel Support

```tsx
<SeedreamGenerationProgress
  jobId={jobId}
  onComplete={handleComplete}
  onError={handleError}
  onCancel={() => {
    console.log('User cancelled generation');
    setJobId(null);
  }}
/>
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `jobId` | `string` | Yes | - | The UUID of the generation job to track |
| `onComplete` | `(outputs: Array<{ url: string; thumbnail: string }>) => void` | No | - | Callback fired when generation completes successfully |
| `onError` | `(error: string) => void` | No | - | Callback fired when generation fails |
| `onCancel` | `() => void` | No | - | Callback fired when user cancels. If provided, shows cancel button |
| `pollInterval` | `number` | No | `3000` | Polling interval in milliseconds |
| `maxPollDuration` | `number` | No | `600000` | Maximum polling duration in milliseconds (default 10 minutes) |

## Generation Phases

The component displays different phases based on the job progress:

1. **Initializing** (0% progress)
   - Icon: Spinning loader
   - Description: "Preparing your generation request..."

2. **Uploading** (1-19% progress)
   - Icon: Spinning loader
   - Description: "Sending your images to the AI..."

3. **Processing** (20-89% progress)
   - Icon: Sparkles
   - Description: "Creating your professional headshots..."

4. **Finalizing** (90-99% progress)
   - Icon: Spinning loader
   - Description: "Almost done! Preparing your results..."

5. **Completed** (100% progress, status: completed)
   - Icon: Check circle
   - Description: "Your headshots are ready!"

6. **Failed** (status: failed)
   - Icon: Alert circle
   - Description: Error message with suggestions

## Status Response Structure

The component expects the following response structure from `/api/seedream/status/{jobId}`:

```typescript
interface StatusResponse {
  success?: boolean;
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  estimatedTimeRemaining?: string; // e.g., "45 seconds"
  outputs?: Array<{
    url: string;
    thumbnail: string;
  }>;
  error?: string;
  errorCode?: string;
  suggestions?: string[];
  generationTime?: number; // seconds
  createdAt: string;
  completedAt?: string;
}
```

## Error Handling

### Retry Logic

The component implements automatic retry logic:
- Retries up to 3 times on connection errors
- Shows retry indicator during retries
- After 3 failed retries, shows error with manual retry button

### Rate Limiting

When the API returns a 429 (rate limit) response:
- The component logs a warning
- Continues polling on the next interval
- Does not count as a failed retry

### Long-running Generations

If a generation takes longer than 2 minutes:
- Shows a special notice: "This generation is taking longer than usual..."
- Continues polling until `maxPollDuration` is reached
- After `maxPollDuration`, shows timeout error

### Failed Generations

When status is "failed":
- Stops polling
- Displays error message
- Shows suggestions from the API response
- Calls `onError` callback if provided

## Styling

The component uses:
- Tailwind CSS for styling
- shadcn/ui components (Card, Progress, Alert, Button)
- Lucide React icons
- Responsive design

### Color Coding

- **Blue**: Initializing, uploading
- **Purple**: Processing (main generation phase)
- **Green**: Finalizing, completed
- **Red**: Failed, errors

## Performance Considerations

### Polling Optimization

- Default 3-second interval balances responsiveness and API load
- Rate limiting prevents excessive requests
- Automatic cleanup on component unmount

### Memory Management

- Clears intervals and timeouts on unmount
- Resets state appropriately
- No memory leaks from polling

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Screen reader friendly status updates
- Keyboard navigation support

## Integration Example

Complete integration with upload, customization, and style selection:

```tsx
'use client';

import { useState } from 'react';
import SeedreamUploadZone from '@/components/SeedreamUploadZone';
import SeedreamCustomizationUI from '@/components/SeedreamCustomizationUI';
import SeedreamStyleSelector from '@/components/SeedreamStyleSelector';
import SeedreamGenerationProgress from '@/components/SeedreamGenerationProgress';

export default function SeedreamWorkflow() {
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [customizations, setCustomizations] = useState({});
  const [styleId, setStyleId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState([]);

  const handleUploadComplete = (id, images) => {
    setUploadId(id);
  };

  const handleGenerate = async () => {
    const response = await fetch('/api/seedream/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        styleId,
        customizations,
        numOutputs: 10,
      }),
    });

    const result = await response.json();
    if (result.success) {
      setJobId(result.jobId);
    }
  };

  const handleComplete = (generatedOutputs) => {
    setOutputs(generatedOutputs);
  };

  return (
    <div className="space-y-6">
      {!jobId ? (
        <>
          <SeedreamUploadZone onUploadComplete={handleUploadComplete} />
          
          {uploadId && (
            <>
              <SeedreamCustomizationUI
                customizations={customizations}
                onCustomizationsChange={setCustomizations}
              />
              
              <SeedreamStyleSelector
                selectedStyleId={styleId}
                onStyleSelect={setStyleId}
              />
              
              <button onClick={handleGenerate} disabled={!styleId}>
                Generate Headshots
              </button>
            </>
          )}
        </>
      ) : (
        <SeedreamGenerationProgress
          jobId={jobId}
          onComplete={handleComplete}
          onError={(error) => console.error(error)}
        />
      )}

      {outputs.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {outputs.map((output, index) => (
            <img key={index} src={output.url} alt={`Headshot ${index + 1}`} />
          ))}
        </div>
      )}
    </div>
  );
}
```

## Testing

### Manual Testing Checklist

- [ ] Component renders with valid jobId
- [ ] Progress bar updates as status changes
- [ ] Elapsed time increments every second
- [ ] Estimated time remaining displays correctly
- [ ] Phase transitions work (initializing → uploading → processing → finalizing → completed)
- [ ] Completed state shows success message and output count
- [ ] Failed state shows error message and suggestions
- [ ] Retry logic works after connection errors
- [ ] Rate limiting is handled gracefully
- [ ] Long-running generation notice appears after 2 minutes
- [ ] Cancel button works (if onCancel provided)
- [ ] Component cleans up on unmount (no console errors)

### Unit Test Example

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import SeedreamGenerationProgress from './SeedreamGenerationProgress';

// Mock fetch
global.fetch = jest.fn();

test('polls status endpoint every 3 seconds', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      jobId: 'test-job-id',
      status: 'processing',
      progress: 50,
      estimatedTimeRemaining: '30 seconds',
    }),
  });

  render(<SeedreamGenerationProgress jobId="test-job-id" />);

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/seedream/status/test-job-id',
      expect.any(Object)
    );
  });

  // Wait for second poll
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledTimes(2);
  }, { timeout: 4000 });
});
```

## Troubleshooting

### Component not polling

- Check that `jobId` is a valid UUID
- Verify the status API endpoint is accessible
- Check browser console for errors

### Progress not updating

- Verify the API is returning updated progress values
- Check that the job status is being updated in the database
- Ensure webhook handler is working correctly

### Rate limit errors

- Reduce `pollInterval` if needed
- Check API rate limiting configuration
- Verify rate limit headers in API response

## Related Components

- `SeedreamUploadZone`: Upload images for generation
- `SeedreamCustomizationUI`: Customize generation options
- `SeedreamStyleSelector`: Select background style
- `TrainingStatusPoller`: Similar polling component for training jobs

## API Dependencies

- `GET /api/seedream/status/{jobId}`: Status polling endpoint
- Must be authenticated via Supabase
- Respects rate limiting (max 1 request per 2 seconds per job)

## Future Enhancements

- [ ] Server-Sent Events (SSE) for real-time updates instead of polling
- [ ] WebSocket support for instant status updates
- [ ] Progress animation improvements
- [ ] Sound notification on completion
- [ ] Browser notification API integration
- [ ] Pause/resume polling capability
- [ ] Export generation logs
