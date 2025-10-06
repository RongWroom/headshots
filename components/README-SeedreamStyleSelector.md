# SeedreamStyleSelector Component

## Overview

The `SeedreamStyleSelector` component provides a visual interface for users to select professional headshot background styles. It displays style cards with preview images, descriptions, and category badges, allowing users to preview and select their preferred style before generation.

## Features

- **Visual Style Cards**: Grid layout displaying all available styles with preview images
- **Category Badges**: Color-coded badges indicating style categories (Corporate, Creative, Casual)
- **Style Preview**: Modal dialog for full-size style preview before selection
- **Selected State**: Visual indication of the currently selected style
- **Responsive Design**: Adapts to different screen sizes (1 column on mobile, 2 on tablet, 3 on desktop)
- **Hover Effects**: Interactive hover states with scale animations and preview button
- **Selected Summary**: Shows the currently selected style with thumbnail and description

## Usage

```tsx
import SeedreamStyleSelector from '@/components/SeedreamStyleSelector';

function MyComponent() {
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);

  return (
    <SeedreamStyleSelector
      selectedStyleId={selectedStyleId}
      onStyleSelect={setSelectedStyleId}
      disabled={false}
    />
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selectedStyleId` | `string \| null` | Yes | - | The ID of the currently selected style |
| `onStyleSelect` | `(styleId: string) => void` | Yes | - | Callback function when a style is selected |
| `disabled` | `boolean` | No | `false` | Disables style selection when true |

## Component Structure

### Style Card

Each style card includes:
- **Preview Image**: Aspect ratio 16:9 image showing the background style
- **Selected Indicator**: Checkmark badge in top-right corner when selected
- **Preview Button**: Appears on hover, opens full-size preview dialog
- **Style Name**: Bold title of the style
- **Category Badge**: Color-coded badge (Corporate/Creative/Casual)
- **Description**: Brief description of the style

### Preview Dialog

The preview dialog shows:
- **Full-size Preview**: Larger view of the style background
- **Style Details**: Extended description and information
- **Select Button**: Quick selection from the preview dialog

### Selected Summary

When a style is selected, a summary section displays:
- **Thumbnail**: Small preview of the selected style
- **Style Name**: Name of the selected style
- **Description**: Full description of the selected style

## Styling

The component uses:
- **Tailwind CSS**: For responsive design and utility classes
- **shadcn/ui**: Card, Badge, Button, Dialog components
- **Lucide Icons**: Check, Eye, and Palette icons
- **Next.js Image**: Optimized image loading

### Category Colors

- **Corporate**: Blue (bg-blue-100/text-blue-800)
- **Creative**: Purple (bg-purple-100/text-purple-800)
- **Casual**: Green (bg-green-100/text-green-800)

## Accessibility

- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **ARIA Labels**: Proper labeling for screen readers
- **Focus States**: Visible focus indicators for keyboard navigation
- **Semantic HTML**: Uses button elements for clickable cards

## Integration with Style Catalog

The component automatically loads all styles from `@/lib/style-catalog`:

```typescript
import { STYLE_CATALOG, Style } from '@/lib/style-catalog';
```

Each style includes:
- `id`: Unique identifier
- `name`: Display name
- `description`: User-facing description
- `category`: Corporate, Creative, or Casual
- `previewImage`: Path to preview image
- `prompt`: AI generation prompt (not displayed)
- `negativePrompt`: AI negative prompt (not displayed)
- `seed`: Fixed seed for consistency (not displayed)

## Requirements Satisfied

This component satisfies the following requirements from the spec:

- **Requirement 9.5**: Display style cards with preview images
- **Requirement 9.6**: Allow style preview before generation
- Shows style names and descriptions
- Highlights selected style
- Provides visual feedback for user interactions

## Example Integration

```tsx
'use client';

import { useState } from 'react';
import SeedreamStyleSelector from '@/components/SeedreamStyleSelector';
import SeedreamCustomizationUI from '@/components/SeedreamCustomizationUI';
import { SeedreamCustomizations } from '@/types/seedream';

export default function HeadshotGenerationPage() {
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [customizations, setCustomizations] = useState<SeedreamCustomizations>({
    removeJewelry: false,
    removeGlasses: false,
    removePiercings: false,
    cleanBackground: false,
  });

  const handleGenerate = async () => {
    if (!selectedStyleId) {
      alert('Please select a style');
      return;
    }

    // Call generation API
    const response = await fetch('/api/seedream/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId: 'your-upload-id',
        styleId: selectedStyleId,
        customizations,
      }),
    });

    // Handle response...
  };

  return (
    <div className="space-y-6">
      <SeedreamStyleSelector
        selectedStyleId={selectedStyleId}
        onStyleSelect={setSelectedStyleId}
      />
      
      <SeedreamCustomizationUI
        customizations={customizations}
        onCustomizationsChange={setCustomizations}
      />

      <button onClick={handleGenerate}>
        Generate Headshots
      </button>
    </div>
  );
}
```

## Notes

- Preview images should be placed in `/public/styles/` directory
- Images are optimized using Next.js Image component
- The component is client-side only (uses 'use client' directive)
- Supports both light and dark themes via Tailwind dark mode classes
