# SeedreamWorkflow Component

## Overview

The `SeedreamWorkflow` component orchestrates the complete user journey for generating professional headshots using Seedream. It manages the multi-step process and ensures a logical flow from upload to results.

## The Complete Flow

```
Step 1: Upload Photos
    ↓
Step 2: Customize Options (remove jewelry, glasses, etc.)
    ↓
Step 3: Select Style (corporate, creative, casual)
    ↓
Step 4: Click "Generate Professional Headshots" Button
    ↓
Step 5: Show Generation Progress
    ↓
Step 6: Display Results
```

## Why This Component Exists

**Problem:** The individual components (Upload, Customize, Style, Progress) work independently but don't have a clear flow. Users might be confused about when images are actually sent to Seedream.

**Solution:** This workflow component:
- Manages state across all steps
- Shows clear progress indicators
- Only calls the generation API when user clicks "Generate"
- Provides back/forward navigation
- Handles errors gracefully

## Usage

### Basic Usage

```tsx
import SeedreamWorkflow from '@/components/SeedreamWorkflow';

export default function HeadshotsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1>Generate Professional Headshots</h1>
      <SeedreamWorkflow />
    </div>
  );
}
```

### With Completion Callback

```tsx
<SeedreamWorkflow
  onComplete={(outputs) => {
    console.log('Generated', outputs.length, 'headshots');
    // Track analytics, show celebration, etc.
  }}
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onComplete` | `(outputs: Array<{ url: string; thumbnail: string }>) => void` | No | Callback when generation completes |

## Step-by-Step Breakdown

### Step 1: Upload Photos

**What happens:**
- User drags/drops or selects 1-5 images
- Images are validated (type, size)
- User clicks "Upload X image(s)" button
- Images are uploaded to Vercel Blob storage
- Upload ID is returned

**What does NOT happen yet:**
- ❌ Images are NOT sent to Seedream
- ❌ Generation does NOT start

**User sees:**
- Dropzone for selecting images
- Preview of selected images
- Upload button
- Progress bar during upload

### Step 2: Customize Options

**What happens:**
- User sees uploaded images summary
- User selects customization options:
  - Remove jewelry
  - Remove glasses
  - Remove piercings
  - Clean background
- User clicks "Continue to Style Selection"

**What does NOT happen yet:**
- ❌ Generation does NOT start

**User sees:**
- Checkboxes for customization options
- Tooltips explaining each option
- Back button (to re-upload)
- Continue button

### Step 3: Select Style

**What happens:**
- User browses style options (corporate, creative, casual)
- User clicks on a style to select it
- User clicks "Generate Professional Headshots" button
- **NOW the generation API is called** with:
  - Upload ID
  - Selected style ID
  - Customization options
  - Number of outputs (10)

**User sees:**
- Grid of style cards with previews
- Selected style highlighted
- Back button (to change customizations)
- **Big "Generate Professional Headshots" button**

### Step 4: Generation Progress

**What happens:**
- Generation job starts on Replicate
- Component polls status every 3 seconds
- Progress bar updates (0% → 100%)
- Phases transition (initializing → uploading → processing → finalizing)

**User sees:**
- Progress bar with percentage
- Current phase (with icon and description)
- Elapsed time
- Estimated time remaining

### Step 5: Results

**What happens:**
- Generation completes
- 10 headshots are displayed
- User can download individual images or all as ZIP

**User sees:**
- Grid of generated headshots
- "Generate More Headshots" button (starts over)
- "Download All" button

## State Management

The component manages:

```typescript
// Step tracking
currentStep: 'upload' | 'customize' | 'style' | 'generating' | 'results'

// Upload data
uploadId: string | null
uploadedImages: UploadedImage[]

// Customization data
customizations: {
  removeJewelry: boolean
  removeGlasses: boolean
  removePiercings: boolean
  cleanBackground: boolean
}

// Style data
selectedStyleId: string | null

// Generation data
jobId: string | null
isGenerating: boolean
generationError: string | null

// Results data
outputs: Array<{ url: string; thumbnail: string }>
```

## Progress Indicator

Shows visual progress at the top:

```
[✓] Upload Photos ━━━ [✓] Customize ━━━ [2] Select Style ━━━ [ ] Generate
```

- ✓ = Completed step (green)
- Number = Current step (primary color)
- Gray = Not yet reached

## Navigation

### Forward Navigation
- Step 1 → 2: Automatic after upload completes
- Step 2 → 3: "Continue to Style Selection" button
- Step 3 → 4: "Generate Professional Headshots" button
- Step 4 → 5: Automatic after generation completes

### Backward Navigation
- Step 2 → 1: "Back to Upload" button
- Step 3 → 2: "Back to Customize" button
- Step 5 → 1: "Generate More Headshots" button

## Error Handling

### Upload Errors
- Shown in SeedreamUploadZone component
- User can retry upload

### Generation Start Errors
- Shown in alert at top of workflow
- User can try again

### Generation Progress Errors
- Shown in SeedreamGenerationProgress component
- User can retry or cancel

## Example Page Implementation

```tsx
// app/headshots/seedream/page.tsx
'use client';

import SeedreamWorkflow from '@/components/SeedreamWorkflow';

export default function SeedreamPage() {
  const handleComplete = (outputs) => {
    // Track analytics
    console.log('User generated', outputs.length, 'headshots');
    
    // Could show celebration animation, etc.
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          Generate Professional Headshots
        </h1>
        <p className="text-muted-foreground">
          Upload your photos and get AI-generated professional headshots in minutes
        </p>
      </div>

      <SeedreamWorkflow onComplete={handleComplete} />
    </div>
  );
}
```

## Key Benefits

### For Users
- ✅ Clear step-by-step process
- ✅ Can review and change options before generating
- ✅ Knows exactly when generation starts
- ✅ Can go back to change settings
- ✅ Visual progress indicator

### For Developers
- ✅ Single component to integrate
- ✅ Manages all state internally
- ✅ Handles errors gracefully
- ✅ Easy to customize
- ✅ TypeScript support

## Customization

### Change Number of Outputs

```tsx
// In handleStartGeneration function, change:
numOutputs: 10  // Change to 5, 15, 20, etc.
```

### Add Custom Steps

```tsx
// Add a new step type
type WorkflowStep = 'upload' | 'customize' | 'style' | 'review' | 'generating' | 'results';

// Add step in the flow
{currentStep === 'review' && (
  <ReviewStep
    uploadedImages={uploadedImages}
    customizations={customizations}
    selectedStyle={selectedStyleId}
    onConfirm={() => setCurrentStep('generating')}
    onBack={() => setCurrentStep('style')}
  />
)}
```

### Customize Styling

The component uses Tailwind CSS and shadcn/ui components, so you can:
- Change colors via Tailwind classes
- Modify spacing and layout
- Customize button styles
- Add animations

## Testing

### Manual Testing Checklist

- [ ] Upload 1-5 images successfully
- [ ] See customization options after upload
- [ ] Select/deselect customization options
- [ ] Navigate back to upload from customize
- [ ] See style selector after customize
- [ ] Select a style
- [ ] Navigate back to customize from style
- [ ] Click "Generate Professional Headshots"
- [ ] See progress indicator
- [ ] See results after completion
- [ ] Click "Generate More Headshots" to start over

### Integration Testing

```typescript
// Test that generation API is called with correct data
const mockGenerate = jest.fn();
global.fetch = mockGenerate;

// ... render component, go through steps ...

expect(mockGenerate).toHaveBeenCalledWith('/api/seedream/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    uploadId: 'test-upload-id',
    styleId: 'corporate-blue',
    numOutputs: 10,
    customizations: {
      removeJewelry: true,
      removeGlasses: false,
      removePiercings: false,
      cleanBackground: true,
    },
  }),
});
```

## Related Components

- `SeedreamUploadZone` - Step 1: Upload photos
- `SeedreamCustomizationUI` - Step 2: Customize options
- `SeedreamStyleSelector` - Step 3: Select style
- `SeedreamGenerationProgress` - Step 4: Show progress
- Results gallery - Step 5: Display results (built into workflow)

## API Dependencies

- `POST /api/seedream/upload` - Upload images to Vercel Blob
- `POST /api/seedream/generate` - Start generation job
- `GET /api/seedream/status/{jobId}` - Poll generation status

## Future Enhancements

- [ ] Save draft (persist state to localStorage)
- [ ] Resume from saved draft
- [ ] Share results via link
- [ ] Download all as ZIP
- [ ] Edit individual results
- [ ] Regenerate specific images
- [ ] Add more customization options
- [ ] A/B test different flows
