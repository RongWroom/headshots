# SeedreamCustomizationUI Component

## Overview

The `SeedreamCustomizationUI` component provides a user-friendly interface for customizing professional headshot generation. It allows users to select various options that will be applied during the AI generation process to refine the output.

## Features

- **Four customization options:**
  - Remove jewelry (earrings, necklaces, rings, bracelets)
  - Remove glasses (eyeglasses and sunglasses)
  - Remove piercings (nose rings, lip rings, eyebrow rings)
  - Clean background (remove distracting elements)

- **Interactive tooltips** explaining each option
- **Visual feedback** with checkboxes and hover effects
- **Summary display** showing selected customizations
- **Accessible** with proper ARIA labels and keyboard navigation
- **Responsive design** that works on all screen sizes

## Usage

### Basic Example

```tsx
import { useState } from 'react';
import SeedreamCustomizationUI from '@/components/SeedreamCustomizationUI';
import { SeedreamCustomizations } from '@/types/seedream';

function MyComponent() {
  const [customizations, setCustomizations] = useState<SeedreamCustomizations>({
    removeJewelry: false,
    removeGlasses: false,
    removePiercings: false,
    cleanBackground: false,
  });

  return (
    <SeedreamCustomizationUI
      customizations={customizations}
      onCustomizationsChange={setCustomizations}
    />
  );
}
```

### With Disabled State

```tsx
<SeedreamCustomizationUI
  customizations={customizations}
  onCustomizationsChange={setCustomizations}
  disabled={isGenerating}
/>
```

### Complete Workflow Example

```tsx
'use client';

import { useState } from 'react';
import SeedreamUploadZone from '@/components/SeedreamUploadZone';
import SeedreamCustomizationUI from '@/components/SeedreamCustomizationUI';
import { Button } from '@/components/ui/button';
import { SeedreamCustomizations, UploadedImage } from '@/types/seedream';

export default function HeadshotGenerator() {
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [customizations, setCustomizations] = useState<SeedreamCustomizations>({
    removeJewelry: false,
    removeGlasses: false,
    removePiercings: false,
    cleanBackground: false,
  });

  const handleUploadComplete = (id: string, images: UploadedImage[]) => {
    setUploadId(id);
  };

  const handleGenerate = async () => {
    if (!uploadId) return;

    const response = await fetch('/api/seedream/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        styleId: 'corporate-blue',
        customizations,
      }),
    });

    const result = await response.json();
    console.log('Generation started:', result);
  };

  return (
    <div className="space-y-6">
      <SeedreamUploadZone
        onUploadComplete={handleUploadComplete}
        maxFiles={5}
        minFiles={1}
      />

      {uploadId && (
        <>
          <SeedreamCustomizationUI
            customizations={customizations}
            onCustomizationsChange={setCustomizations}
          />

          <Button onClick={handleGenerate} size="lg" className="w-full">
            Generate Professional Headshots
          </Button>
        </>
      )}
    </div>
  );
}
```

## Props

### `SeedreamCustomizationUIProps`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `customizations` | `SeedreamCustomizations` | Yes | - | Current customization state |
| `onCustomizationsChange` | `(customizations: SeedreamCustomizations) => void` | Yes | - | Callback when customizations change |
| `disabled` | `boolean` | No | `false` | Disables all checkboxes |

### `SeedreamCustomizations` Type

```typescript
interface SeedreamCustomizations {
  removeJewelry?: boolean;
  removeGlasses?: boolean;
  removePiercings?: boolean;
  cleanBackground?: boolean;
}
```

## Customization Options

### Remove Jewelry
- **Label:** "Remove jewelry"
- **Description:** "Earrings, necklaces, rings, bracelets"
- **Tooltip:** "The AI will generate headshots without visible jewelry like earrings, necklaces, rings, or bracelets for a clean professional look."
- **Effect:** Adds negative prompt: `"jewelry, earrings, necklace, rings, bracelet"`

### Remove Glasses
- **Label:** "Remove glasses"
- **Description:** "Eyeglasses and sunglasses"
- **Tooltip:** "The AI will generate headshots without glasses or sunglasses, showing your eyes clearly."
- **Effect:** Adds negative prompt: `"glasses, eyeglasses, sunglasses"`

### Remove Piercings
- **Label:** "Remove piercings"
- **Description:** "Nose rings, lip rings, eyebrow rings"
- **Tooltip:** "The AI will generate headshots without visible piercings like nose rings, lip rings, or eyebrow rings."
- **Effect:** Adds negative prompt: `"piercings, nose ring, lip ring, eyebrow ring"`

### Clean Background
- **Label:** "Clean background"
- **Description:** "Remove distracting elements"
- **Tooltip:** "The AI will ensure a clean, professional background by removing any cluttered or distracting elements."
- **Effect:** Adds negative prompt: `"cluttered, messy, distracting elements"`

## Styling

The component uses Tailwind CSS and shadcn/ui components for consistent styling:

- **Card container** with header and content sections
- **Hover effects** on option rows
- **Accent colors** for selected state
- **Muted colors** for descriptions
- **Primary colors** for active elements

### Customizing Styles

You can customize the appearance by modifying the Tailwind classes:

```tsx
// Example: Custom border color
<div className="rounded-lg border border-blue-500 p-4">
  {/* ... */}
</div>
```

## Accessibility

The component follows accessibility best practices:

- ✅ Proper ARIA labels on all interactive elements
- ✅ Keyboard navigation support
- ✅ Screen reader friendly
- ✅ Focus indicators
- ✅ Semantic HTML structure
- ✅ Descriptive tooltips

## Integration with API

The customizations are sent to the `/api/seedream/generate` endpoint:

```typescript
const response = await fetch('/api/seedream/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    uploadId: 'uuid-here',
    styleId: 'corporate-blue',
    customizations: {
      removeJewelry: true,
      removeGlasses: false,
      removePiercings: false,
      cleanBackground: true,
    },
  }),
});
```

The API will build a custom negative prompt based on the selected options:

```typescript
const negativePrompts = [style.negativePrompt];

if (customizations?.removeJewelry) {
  negativePrompts.push("jewelry, earrings, necklace, rings, bracelet");
}
if (customizations?.removeGlasses) {
  negativePrompts.push("glasses, eyeglasses, sunglasses");
}
if (customizations?.removePiercings) {
  negativePrompts.push("piercings, nose ring, lip ring, eyebrow ring");
}
if (customizations?.cleanBackground) {
  negativePrompts.push("cluttered, messy, distracting elements");
}

const finalNegativePrompt = negativePrompts.join(", ");
```

## Testing

### Manual Testing

1. Navigate to `/seedream-test` page
2. Upload 1-5 images
3. Toggle each customization option
4. Verify tooltips appear on hover
5. Check that selected options are displayed in the summary
6. Verify the JSON output shows correct values

### Unit Testing Example

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import SeedreamCustomizationUI from '@/components/SeedreamCustomizationUI';

test('toggles customization options', () => {
  const mockOnChange = jest.fn();
  const customizations = {
    removeJewelry: false,
    removeGlasses: false,
    removePiercings: false,
    cleanBackground: false,
  };

  render(
    <SeedreamCustomizationUI
      customizations={customizations}
      onCustomizationsChange={mockOnChange}
    />
  );

  const jewelryCheckbox = screen.getByLabelText('Remove jewelry');
  fireEvent.click(jewelryCheckbox);

  expect(mockOnChange).toHaveBeenCalledWith({
    ...customizations,
    removeJewelry: true,
  });
});
```

## Dependencies

- `@radix-ui/react-checkbox` - Accessible checkbox primitive
- `@radix-ui/react-label` - Label component
- `@radix-ui/react-tooltip` - Tooltip component
- `lucide-react` - Icons
- `tailwindcss` - Styling

## Related Components

- **SeedreamUploadZone** - Upload images for processing
- **SeedreamStyleSelector** - Select headshot style (Task 13)
- **SeedreamProgressUI** - Show generation progress (Task 14)
- **SeedreamResultsGallery** - Display generated headshots (Task 15)

## Requirements Satisfied

This component satisfies the following requirements from the spec:

- ✅ **Requirement 9.3:** Customization checkboxes after upload completes
- ✅ **Requirement 9.4:** Customizations added to negative prompt

## Future Enhancements

Potential improvements for future iterations:

- Add preview of how customizations affect the output
- Allow custom text input for additional negative prompts
- Add presets (e.g., "Ultra Professional", "Natural Look")
- Show before/after examples for each option
- Add intensity sliders for each option
- Save user preferences for future sessions
