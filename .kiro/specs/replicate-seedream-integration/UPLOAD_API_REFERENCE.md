# Seedream Upload API Reference

## Endpoint

```
POST /api/seedream/upload
```

## Authentication

Requires authenticated Supabase session. Include session cookies in the request.

## Request Format

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file` - One or more image files (1-5 files)

## File Requirements

- **Formats:** JPEG, PNG, WebP
- **Size:** Maximum 10MB per file
- **Count:** 1-5 files per request
- **MIME Types:** `image/jpeg`, `image/jpg`, `image/png`, `image/webp`

## Success Response (200)

```json
{
  "success": true,
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "images": [
    {
      "filename": "photo1.jpg",
      "blobUrl": "https://blob.vercel-storage.com/seedream-uploads/user-id/upload-id/timestamp-0-photo1.jpg",
      "size": 1234567
    },
    {
      "filename": "photo2.jpg",
      "blobUrl": "https://blob.vercel-storage.com/seedream-uploads/user-id/upload-id/timestamp-1-photo2.jpg",
      "size": 2345678
    }
  ],
  "expiresAt": "2025-06-11T12:00:00.000Z",
  "message": "Successfully uploaded 2 image(s)"
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Authentication failed",
  "message": "Please sign in to upload images",
  "code": "UNAUTHORIZED",
  "timestamp": "2025-06-10T12:00:00.000Z",
  "requestId": "seedream_upload_api_1234567890_abc123",
  "suggestions": [
    "Sign in to your account",
    "Check if your session has expired"
  ]
}
```

### 400 Invalid File Count
```json
{
  "error": "Invalid file count",
  "message": "Please upload between 1 and 5 images",
  "code": "INVALID_FILE_COUNT",
  "timestamp": "2025-06-10T12:00:00.000Z",
  "requestId": "seedream_upload_api_1234567890_abc123",
  "details": {
    "fileCount": 0,
    "minFiles": 1,
    "maxFiles": 5
  },
  "suggestions": [
    "Upload at least 1 image(s)",
    "Upload no more than 5 images"
  ]
}
```

### 400 Invalid File
```json
{
  "error": "File validation failed",
  "message": "File \"document.pdf\" has invalid type \"application/pdf\". Allowed types: image/jpeg, image/jpg, image/png, image/webp",
  "code": "INVALID_FILE",
  "timestamp": "2025-06-10T12:00:00.000Z",
  "requestId": "seedream_upload_api_1234567890_abc123",
  "details": {
    "filename": "document.pdf",
    "size": 1234567,
    "type": "application/pdf"
  },
  "suggestions": [
    "Ensure all files are images (JPEG, PNG, or WebP)",
    "Ensure each file is under 10MB",
    "Remove any corrupted or invalid files"
  ]
}
```

### 500 Blob Upload Error
```json
{
  "error": "Upload failed",
  "message": "One or more files failed to upload",
  "code": "BLOB_UPLOAD_ERROR",
  "timestamp": "2025-06-10T12:00:00.000Z",
  "requestId": "seedream_upload_api_1234567890_abc123",
  "details": {
    "uploadErrors": ["Failed to upload photo1.jpg: Network error"],
    "successfulUploads": 1,
    "failedUploads": 1
  },
  "suggestions": [
    "Try uploading fewer files",
    "Check your internet connection",
    "Ensure all files are valid images",
    "Try again in a few moments"
  ]
}
```

## Usage Examples

### JavaScript (Browser)

```javascript
async function uploadImages(files) {
  const formData = new FormData();
  
  // Add files to form data
  files.forEach(file => {
    formData.append('file', file);
  });
  
  try {
    const response = await fetch('/api/seedream/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include' // Include auth cookies
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('Upload successful!', data);
      return data;
    } else {
      console.error('Upload failed:', data);
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

// Usage with file input
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  
  if (files.length < 1 || files.length > 5) {
    alert('Please select 1-5 images');
    return;
  }
  
  try {
    const result = await uploadImages(files);
    console.log('Upload ID:', result.uploadId);
    console.log('Image URLs:', result.images.map(img => img.blobUrl));
  } catch (error) {
    alert('Upload failed: ' + error.message);
  }
});
```

### React Component

```jsx
import { useState } from 'react';

function ImageUploader() {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async (files) => {
    setUploading(true);
    setError(null);
    
    const formData = new FormData();
    files.forEach(file => formData.append('file', file));
    
    try {
      const response = await fetch('/api/seedream/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setUploadResult(data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => handleUpload(Array.from(e.target.files))}
        disabled={uploading}
      />
      
      {uploading && <p>Uploading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {uploadResult && (
        <div>
          <p>Upload successful! ID: {uploadResult.uploadId}</p>
          <p>Uploaded {uploadResult.images.length} image(s)</p>
        </div>
      )}
    </div>
  );
}
```

### Node.js (Testing)

```javascript
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function uploadImages(imagePaths, authCookie) {
  const formData = new FormData();
  
  imagePaths.forEach(imagePath => {
    const fileStream = fs.createReadStream(imagePath);
    const filename = path.basename(imagePath);
    formData.append('file', fileStream, filename);
  });
  
  const response = await fetch('http://localhost:3000/api/seedream/upload', {
    method: 'POST',
    body: formData,
    headers: {
      ...formData.getHeaders(),
      'Cookie': authCookie // Include auth cookie
    }
  });
  
  return await response.json();
}

// Usage
const result = await uploadImages(
  ['photo1.jpg', 'photo2.jpg', 'photo3.jpg'],
  'sb-access-token=...; sb-refresh-token=...'
);
console.log(result);
```

## Database Schema

Uploads are stored in the `seedream_uploads` table:

```sql
CREATE TABLE seedream_uploads (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  images JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);
```

**RLS Policies:**
- Users can only view/create/delete their own uploads
- Service role has full access for webhook operations

## Blob Storage Structure

Files are stored in Vercel Blob with the following path structure:

```
seedream-uploads/
  {user_id}/
    {upload_id}/
      {timestamp}-{index}-{sanitized_filename}
```

Example:
```
seedream-uploads/
  550e8400-e29b-41d4-a716-446655440000/
    660f9511-f39c-52e5-b827-557766551111/
      1717761234567-0-photo1.jpg
      1717761234567-1-photo2.jpg
      1717761234567-2-photo3.jpg
```

## Expiration

- Uploads expire after **24 hours**
- The `expires_at` timestamp is automatically set
- A cleanup cron job should delete expired uploads (Task 17)

## Rate Limiting

Currently no rate limiting is implemented. Consider adding:
- Max 10 uploads per hour per user
- Max 50 files per hour per user

## Next Steps

After uploading images, use the `uploadId` to:
1. Create a generation job via `/api/seedream/generate`
2. Select a style from the style catalog
3. Configure customization options
4. Start the headshot generation process

## Related Endpoints

- `POST /api/seedream/generate` - Start generation with uploaded images
- `GET /api/seedream/status/:jobId` - Check generation status
- `POST /api/seedream/webhook` - Receive Replicate completion webhook

## Troubleshooting

### "Authentication failed"
- Ensure user is signed in
- Check that session cookies are included in the request
- Verify Supabase configuration

### "File validation failed"
- Check file format (must be JPEG, PNG, or WebP)
- Check file size (must be under 10MB)
- Ensure file is not corrupted

### "Blob storage not configured"
- Verify `BLOB_READ_WRITE_TOKEN` environment variable is set
- Check Vercel Blob storage is enabled for the project

### "Database error"
- Verify Supabase connection
- Check that `seedream_uploads` table exists
- Verify RLS policies are configured correctly
