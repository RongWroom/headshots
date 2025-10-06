# SeedreamUploadZone Component

## Overview

The `SeedreamUploadZone` component provides a drag-and-drop interface for uploading images to the Seedream headshot generation service. It handles client-side validation, progress tracking, and error handling.

## Features

- **Drag & Drop Interface**: Intuitive drag-and-drop zone for easy file selection
- **Client-Side Validation**: Validates file types (JPEG, PNG, WebP) and sizes (max 10MB) before upload
- **Upload Progress**: Visual progress indicators for each file
- **Error Handling**: Graceful error handling with user-friendly messages
- **Image Previews**: Shows thumbnail previews of uploaded images
- **File Management**: Remove individual files before final submission
- **Status Indicators**: Visual feedback for pending, uploading, uploaded, and error states

## Usage

### Basic Example

```tsx
import SeedreamUploadZone from '@/components/SeedreamUploadZone';

export default function MyPage() {
  const handleUploadComplete = (uploadId: string, images: UploadedImage[]) => {
    console.log('Upload complete:', { uploadId, images });
    // Proceed to next step (style selection, customization, etc.)
  };

  return (
    <SeedreamUploadZone
      onUploadComplete={handleUploadComplete}
      maxFiles={5}
      minFiles={1}
    />
  );
}
```

### With Custom Limits

```tsx
<SeedreamUploadZone
  onUploadComplete={handleUploadComplete}
  maxFiles={10}
  minFiles={3}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onUploadComplete` | `(uploadId: string, images: UploadedImage[]) => void` | `undefined` | Callback fired when upload completes successfully |
| `maxFiles` | `number` | `5` | Maximum number of files allowed |
| `minFiles` | `number` | `1` | Minimum number of files required |

## File Validation

The component validates files on the client side before uploading:

### Allowed File Types
- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- WebP (`.webp`)

### File Size Limits
- Maximum: 10MB per file
- Minimum: No minimum (but files should be valid images)

### Validation Errors

The component will show error messages for:
- Invalid file types
- Files exceeding size limit
- Too many files selected
- Duplicate files

## Upload Flow

1. **File Selection**: User drags files or clicks to select
2. **Client Validation**: Files are validated for type and size
3. **Preview Generation**: Thumbnails are created for valid files
4. **Upload**: Files are sent to `/api/seedream/upload` endpoint
5. **Status Updates**: Visual feedback shows upload progress
6. **Completion**: `onUploadComplete` callback is fired with upload ID and image metadata

## API Integration

The component sends files to the `/api/seedream/upload` endpoint using `multipart/form-data`:

```typescript
POST /api/seedream/upload
Content-Type: multipart/form-data

FormData {
  files: File[]
}
```

Expected response:

```typescript
{
  success: true,
  uploadId: string,
  images: UploadedImage[],
  expiresAt: string,
  message: string
}
```

## State Management

The component manages the following internal state:

- `uploadedFiles`: Array of files with status and metadata
- `isUploading`: Boolean indicating upload in progress
- `uploadProgress`: Number (0-100) for progress bar

## File Status States

Each uploaded file can be in one of four states:

1. **pending**: File selected but not yet uploaded
2. **uploading**: File currently being uploaded
3. **uploaded**: File successfully uploaded
4. **error**: Upload failed with error message

## Error Handling

The component handles errors gracefully:

- **Network Errors**: Shows "Upload failed" message
- **Validation Errors**: Shows specific validation error per file
- **API Errors**: Displays error message from API response
- **Duplicate Files**: Prevents uploading same file twice

## Styling

The component uses Tailwind CSS and shadcn/ui components:

- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- `Button`
- `Progress`
- Lucide icons: `Upload`, `X`, `CheckCircle`, `AlertCircle`, `Image`

## Accessibility

- Keyboard navigation support via react-dropzone
- Screen reader friendly status messages
- Clear visual indicators for all states
- Descriptive error messages

## Dependencies

- `react-dropzone`: Drag-and-drop functionality
- `@/components/ui/*`: shadcn/ui components
- `@/types/seedream`: TypeScript types
- `lucide-react`: Icons

## Testing

To test the component:

1. Navigate to `/seedream-test` page
2. Try uploading valid images (JPEG, PNG, WebP)
3. Try uploading invalid files (PDF, etc.)
4. Try uploading files > 10MB
5. Try uploading more than max files
6. Verify error messages appear correctly
7. Verify upload progress shows
8. Verify callback fires with correct data

## Integration with Seedream Flow

This component is the first step in the Seedream headshot generation flow:

1. **Upload** (this component) → 
2. **Customization** (checkboxes for jewelry, glasses, etc.) → 
3. **Style Selection** (choose background style) → 
4. **Generation** (start job) → 
5. **Progress** (poll status) → 
6. **Results** (view/download headshots)

## Example Integration

```tsx
'use client';

import { useState } from 'react';
import SeedreamUploadZone from '@/components/SeedreamUploadZone';
import { UploadedImage } from '@/types/seedream';

export default function SeedreamGeneratePage() {
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [step, setStep] = useState<'upload' | 'customize' | 'generate'>('upload');

  const handleUploadComplete = (id: string, imgs: UploadedImage[]) => {
    setUploadId(id);
    setImages(imgs);
    setStep('customize');
  };

  return (
    <div>
      {step === 'upload' && (
        <SeedreamUploadZone
          onUploadComplete={handleUploadComplete}
          maxFiles={5}
          minFiles={1}
        />
      )}
      
      {step === 'customize' && (
        <div>
          {/* Customization UI */}
        </div>
      )}
      
      {step === 'generate' && (
        <div>
          {/* Generation UI */}
        </div>
      )}
    </div>
  );
}
```

## Performance Considerations

- Preview URLs are created using `URL.createObjectURL()` and properly cleaned up
- Files are uploaded in a single batch request
- Progress updates are throttled to avoid excessive re-renders
- Large files are validated before upload to save bandwidth

## Future Enhancements

Potential improvements for future versions:

- Image compression before upload
- Parallel uploads for multiple files
- Resume capability for failed uploads
- Image cropping/editing before upload
- Webcam capture support
- Cloud storage integration (beyond Vercel Blob)

## Troubleshooting

### Upload fails silently
- Check browser console for errors
- Verify `/api/seedream/upload` endpoint is working
- Check network tab for failed requests

### Files not showing previews
- Verify files are valid images
- Check browser supports `URL.createObjectURL()`
- Ensure file type is in allowed list

### Drag & drop not working
- Verify react-dropzone is installed
- Check for conflicting drag event handlers
- Test in different browsers

## Related Components

- `SeedreamCustomizationForm`: Next step after upload
- `SeedreamStyleSelector`: Style selection UI
- `SeedreamProgressTracker`: Generation progress
- `SeedreamResultsGallery`: View generated headshots

## License

MIT License - See project LICENSE file for details
