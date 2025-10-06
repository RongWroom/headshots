# Task 11 Visual Guide: Upload Component

## Component Structure

```
┌─────────────────────────────────────────────────────────┐
│  SeedreamUploadZone                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  📤 Upload Photos                                 │ │
│  │  Upload 1-5 casual photos (JPEG, PNG, or WebP)   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │                                                   │ │
│  │              🖼️  Drag & Drop Zone                │ │
│  │                                                   │ │
│  │         Drag & drop images here                   │ │
│  │         or click to select files                  │ │
│  │                                                   │ │
│  │         [Select Images]                           │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Progress Bar (when uploading)                    │ │
│  │  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░ 40%     │ │
│  │  Uploading images...                              │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Uploaded Images (3/5)                        ✓   │ │
│  ├───────────────────────────────────────────────────┤ │
│  │                                                   │ │
│  │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐   │ │
│  │  │ ✓   │  │ ✓   │  │ ✓   │  │     │  │     │   │ │
│  │  │ 🖼️  │  │ 🖼️  │  │ 🖼️  │  │     │  │     │   │ │
│  │  │     │  │     │  │     │  │     │  │     │   │ │
│  │  │  X  │  │  X  │  │  X  │  │     │  │     │   │ │
│  │  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘   │ │
│  │  img1.jpg img2.jpg img3.jpg                      │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## File Status Indicators

### Pending (🟡)
```
┌─────────┐
│         │
│   🖼️    │  ← Preview image
│         │
└─────────┘
  file.jpg
```

### Uploading (🔵)
```
┌─────────┐
│  ⏳     │  ← Spinner icon
│   🖼️    │
│         │
└─────────┘
  file.jpg
```

### Uploaded (🟢)
```
┌─────────┐
│  ✓      │  ← Check icon
│   🖼️    │
│    X    │  ← Remove button (on hover)
└─────────┘
  file.jpg
```

### Error (🔴)
```
┌─────────┐
│  ⚠️     │  ← Alert icon
│   🖼️    │
│    X    │  ← Remove button
└─────────┘
  file.jpg
  Error: File too large
```

## User Interaction Flow

```
┌─────────────────┐
│  User arrives   │
│   at page       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Sees empty     │
│  dropzone       │
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────────┐  ┌─────────────────┐
│  Drags files    │  │  Clicks to      │
│  over zone      │  │  select files   │
└────────┬────────┘  └────────┬────────┘
         │                    │
         └──────────┬─────────┘
                    │
                    ▼
         ┌─────────────────┐
         │  Files selected │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Client-side    │
         │  validation     │
         └────────┬────────┘
                  │
         ┌────────┴────────┐
         │                 │
    Valid│                 │Invalid
         ▼                 ▼
┌─────────────────┐  ┌─────────────────┐
│  Show previews  │  │  Show error     │
│  Start upload   │  │  message        │
└────────┬────────┘  └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Upload to API  │
│  Show progress  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Upload         │
│  complete       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Fire callback  │
│  with uploadId  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Parent handles │
│  next step      │
└─────────────────┘
```

## Validation Flow

```
File Selected
     │
     ▼
┌─────────────────┐
│  Check file     │
│  type           │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
Valid│         │Invalid
    ▼         ▼
    │    ┌─────────────────┐
    │    │  Show error:    │
    │    │  "Invalid type" │
    │    └─────────────────┘
    │
    ▼
┌─────────────────┐
│  Check file     │
│  size           │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
Valid│         │Too large
    ▼         ▼
    │    ┌─────────────────┐
    │    │  Show error:    │
    │    │  "File too      │
    │    │   large"        │
    │    └─────────────────┘
    │
    ▼
┌─────────────────┐
│  Check for      │
│  duplicates     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
Unique│       │Duplicate
    ▼         ▼
    │    ┌─────────────────┐
    │    │  Show error:    │
    │    │  "Duplicate"    │
    │    └─────────────────┘
    │
    ▼
┌─────────────────┐
│  Check max      │
│  files limit    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
 OK │         │Exceeded
    ▼         ▼
    │    ┌─────────────────┐
    │    │  Show error:    │
    │    │  "Too many      │
    │    │   files"        │
    │    └─────────────────┘
    │
    ▼
┌─────────────────┐
│  File is valid  │
│  Add to list    │
└─────────────────┘
```

## State Transitions

```
File State Machine:

    ┌─────────┐
    │ pending │ ← Initial state
    └────┬────┘
         │
         │ Upload starts
         ▼
    ┌──────────┐
    │uploading │
    └────┬─────┘
         │
    ┌────┴────┐
    │         │
Success│       │Failure
    ▼         ▼
┌─────────┐ ┌───────┐
│uploaded │ │ error │
└─────────┘ └───────┘
    │           │
    │           │ User removes
    │           ▼
    │       [Removed]
    │
    │ User removes
    ▼
[Removed]
```

## Component Props Flow

```
Parent Component
       │
       │ Props
       ▼
┌──────────────────────────────┐
│  SeedreamUploadZone          │
│                              │
│  Props:                      │
│  • onUploadComplete          │
│  • maxFiles = 5              │
│  • minFiles = 1              │
└──────────────┬───────────────┘
               │
               │ On upload complete
               ▼
┌──────────────────────────────┐
│  Callback fired with:        │
│  • uploadId: string          │
│  • images: UploadedImage[]   │
└──────────────┬───────────────┘
               │
               ▼
       Parent Component
       (handles next step)
```

## API Communication

```
Component                    API Endpoint
    │                            │
    │  POST /api/seedream/upload │
    │  FormData { files }        │
    ├───────────────────────────>│
    │                            │
    │                       ┌────┴────┐
    │                       │ Validate│
    │                       │  files  │
    │                       └────┬────┘
    │                            │
    │                       ┌────┴────┐
    │                       │ Upload  │
    │                       │to Blob  │
    │                       └────┬────┘
    │                            │
    │                       ┌────┴────┐
    │                       │  Save   │
    │                       │to DB    │
    │                       └────┬────┘
    │                            │
    │  Response:                 │
    │  {                         │
    │    success: true,          │
    │    uploadId: "...",        │
    │    images: [...],          │
    │    expiresAt: "..."        │
    │  }                         │
    │<───────────────────────────┤
    │                            │
    ▼                            ▼
Update UI                   Complete
Fire callback
```

## Responsive Layout

### Desktop (lg+)
```
┌─────┬─────┬─────┬─────┬─────┐
│ 🖼️  │ 🖼️  │ 🖼️  │ 🖼️  │ 🖼️  │
└─────┴─────┴─────┴─────┴─────┘
        5 columns
```

### Tablet (md)
```
┌─────┬─────┬─────┐
│ 🖼️  │ 🖼️  │ 🖼️  │
├─────┼─────┼─────┤
│ 🖼️  │ 🖼️  │     │
└─────┴─────┴─────┘
    3 columns
```

### Mobile (sm)
```
┌─────┬─────┐
│ 🖼️  │ 🖼️  │
├─────┼─────┤
│ 🖼️  │ 🖼️  │
├─────┼─────┤
│ 🖼️  │     │
└─────┴─────┘
  2 columns
```

## Error States

### Invalid File Type
```
┌─────────────────────────────────┐
│  ⚠️  File Upload Error          │
│                                 │
│  File "document.pdf" has an     │
│  invalid format. Only JPEG,     │
│  PNG, and WebP are allowed.     │
└─────────────────────────────────┘
```

### File Too Large
```
┌─────────────────────────────────┐
│  ⚠️  File Upload Error          │
│                                 │
│  File "large-image.jpg" is too  │
│  large. Maximum size is 10MB.   │
└─────────────────────────────────┘
```

### Too Many Files
```
┌─────────────────────────────────┐
│  ⚠️  Too many files             │
│                                 │
│  You can upload up to 5 images. │
│  Currently have 3.              │
└─────────────────────────────────┘
```

### Upload Failed
```
┌─────────────────────────────────┐
│  ⚠️  Upload Failed              │
│                                 │
│  Failed to upload images to     │
│  server. Please try again.      │
└─────────────────────────────────┘
```

## Success State

```
┌─────────────────────────────────┐
│  ✓  Upload Complete             │
│                                 │
│  Successfully uploaded 5        │
│  image(s).                      │
└─────────────────────────────────┘
```

## Integration Example

```tsx
// Parent component structure

┌────────────────────────────────────┐
│  SeedreamGeneratePage              │
├────────────────────────────────────┤
│                                    │
│  State:                            │
│  • step: 'upload' | 'customize'    │
│  • uploadId: string | null         │
│  • images: UploadedImage[]         │
│                                    │
│  ┌──────────────────────────────┐ │
│  │  {step === 'upload' && (     │ │
│  │    <SeedreamUploadZone       │ │
│  │      onUploadComplete={...}  │ │
│  │    />                        │ │
│  │  )}                          │ │
│  └──────────────────────────────┘ │
│                                    │
│  ┌──────────────────────────────┐ │
│  │  {step === 'customize' && (  │ │
│  │    <CustomizationForm        │ │
│  │      uploadId={uploadId}     │ │
│  │    />                        │ │
│  │  )}                          │ │
│  └──────────────────────────────┘ │
│                                    │
└────────────────────────────────────┘
```

## File Structure

```
components/
  └── SeedreamUploadZone.tsx     ← Main component
  └── README-SeedreamUploadZone.md ← Documentation

app/
  └── seedream-test/
      └── page.tsx                ← Test page

types/
  └── seedream.ts                 ← TypeScript types

.kiro/specs/replicate-seedream-integration/
  ├── TASK_11_COMPLETION.md       ← Completion summary
  ├── UPLOAD_COMPONENT_QUICK_REFERENCE.md
  └── TASK_11_VISUAL_GUIDE.md     ← This file
```

## Testing Scenarios

### ✅ Happy Path
1. User drags 3 valid images
2. Previews appear
3. Upload starts automatically
4. Progress bar shows
5. All files upload successfully
6. Callback fires with uploadId
7. Parent component proceeds to next step

### ⚠️ Error Paths
1. User drags PDF file → Error message
2. User drags 15MB image → Error message
3. User drags 10 images (max 5) → Error message
4. Network fails during upload → Error message
5. API returns error → Error message

### 🔄 Edge Cases
1. User removes file before upload → File removed
2. User adds duplicate file → Prevented
3. User adds files one by one → Each validated
4. Upload interrupted → Error state shown
5. User navigates away → Cleanup handled
