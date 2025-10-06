# SeedreamUploadZone Quick Reference

## Import

```tsx
import SeedreamUploadZone from '@/components/SeedreamUploadZone';
import { UploadedImage } from '@/types/seedream';
```

## Basic Usage

```tsx
const [uploadId, setUploadId] = useState<string | null>(null);

<SeedreamUploadZone
  onUploadComplete={(id, images) => {
    setUploadId(id);
    // Proceed to next step
  }}
  maxFiles={5}
  minFiles={1}
/>
```

## Props

| Prop | Type | Default | Required |
|------|------|---------|----------|
| `onUploadComplete` | `(uploadId: string, images: UploadedImage[]) => void` | - | No |
| `maxFiles` | `number` | `5` | No |
| `minFiles` | `number` | `1` | No |

## File Constraints

- **Types**: JPEG, PNG, WebP
- **Max Size**: 10MB per file
- **Max Files**: Configurable (default 5)
- **Min Files**: Configurable (default 1)

## Features

✅ Drag & drop interface
✅ Click to select files
✅ Client-side validation
✅ Upload progress tracking
✅ Image previews
✅ Remove files
✅ Error handling
✅ Duplicate detection

## API Integration

Uploads to: `POST /api/seedream/upload`

Response:
```typescript
{
  success: true,
  uploadId: string,
  images: UploadedImage[],
  expiresAt: string,
  message: string
}
```

## File States

- 🟡 **pending**: Selected, not uploaded
- 🔵 **uploading**: Currently uploading
- 🟢 **uploaded**: Successfully uploaded
- 🔴 **error**: Upload failed

## Test Page

Navigate to `/seedream-test` to test the component

## Example Integration

```tsx
'use client';

import { useState } from 'react';
import SeedreamUploadZone from '@/components/SeedreamUploadZone';

export default function GeneratePage() {
  const [step, setStep] = useState<'upload' | 'customize'>('upload');
  const [uploadId, setUploadId] = useState<string | null>(null);

  return (
    <div>
      {step === 'upload' && (
        <SeedreamUploadZone
          onUploadComplete={(id, images) => {
            setUploadId(id);
            setStep('customize');
          }}
        />
      )}
      
      {step === 'customize' && (
        <div>Next step: Customization UI</div>
      )}
    </div>
  );
}
```

## Common Patterns

### With Loading State
```tsx
const [isProcessing, setIsProcessing] = useState(false);

<SeedreamUploadZone
  onUploadComplete={async (id, images) => {
    setIsProcessing(true);
    // Process upload
    setIsProcessing(false);
  }}
/>
```

### With Error Handling
```tsx
const [error, setError] = useState<string | null>(null);

<SeedreamUploadZone
  onUploadComplete={(id, images) => {
    if (images.length < 1) {
      setError('No images uploaded');
      return;
    }
    setError(null);
    // Continue
  }}
/>
```

### Multi-Step Form
```tsx
const [formData, setFormData] = useState({
  uploadId: null,
  styleId: null,
  customizations: {}
});

<SeedreamUploadZone
  onUploadComplete={(id, images) => {
    setFormData(prev => ({ ...prev, uploadId: id }));
  }}
/>
```

## Troubleshooting

**Upload fails**
- Check `/api/seedream/upload` endpoint
- Verify Vercel Blob is configured
- Check browser console for errors

**No previews**
- Verify files are valid images
- Check file type is allowed
- Test with different image

**Drag & drop not working**
- Check for conflicting event handlers
- Test in different browser
- Verify react-dropzone is installed

## Related Files

- Component: `components/SeedreamUploadZone.tsx`
- Types: `types/seedream.ts`
- API: `app/api/seedream/upload/route.ts`
- Test: `app/seedream-test/page.tsx`
- Docs: `components/README-SeedreamUploadZone.md`
