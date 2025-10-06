# Seedream Style Selector - Quick Reference

## Component Location
`components/SeedreamStyleSelector.tsx`

## Quick Import
```tsx
import SeedreamStyleSelector from '@/components/SeedreamStyleSelector';
```

## Basic Usage
```tsx
const [styleId, setStyleId] = useState<string | null>(null);

<SeedreamStyleSelector
  selectedStyleId={styleId}
  onStyleSelect={setStyleId}
/>
```

## Props
- `selectedStyleId`: Current selected style ID (string | null)
- `onStyleSelect`: Callback when style is selected (styleId: string) => void
- `disabled`: Optional boolean to disable selection

## Features
✅ Grid layout with responsive columns (1/2/3)
✅ Preview images with hover effects
✅ Category badges (Corporate/Creative/Casual)
✅ Full-size preview dialog
✅ Selected state indicator
✅ Selected style summary section

## Available Styles (from catalog)
1. **Corporate Blue** - Blue gradient, professional
2. **Warm Studio** - Warm beige, approachable
3. **Professional Gray** - Neutral gray, timeless
4. **Creative Teal** - Teal gradient, modern
5. **Executive Charcoal** - Dark charcoal, sophisticated

## Style Categories
- **Corporate**: Blue, Gray, Charcoal (professional business)
- **Creative**: Teal (modern creative professionals)
- **Casual**: (future expansion)

## UI Elements
- **Style Card**: Preview image + name + description + category badge
- **Preview Button**: Hover overlay with "Preview" button
- **Preview Dialog**: Full-size view with select button
- **Selected Indicator**: Checkmark badge on selected card
- **Summary Section**: Shows selected style with thumbnail

## Integration Example
```tsx
// Complete generation flow
const [uploadId, setUploadId] = useState<string | null>(null);
const [styleId, setStyleId] = useState<string | null>(null);
const [customizations, setCustomizations] = useState({...});

// 1. Upload images (SeedreamUploadZone)
// 2. Select style (SeedreamStyleSelector)
<SeedreamStyleSelector
  selectedStyleId={styleId}
  onStyleSelect={setStyleId}
/>

// 3. Customize (SeedreamCustomizationUI)
// 4. Generate
const handleGenerate = async () => {
  const response = await fetch('/api/seedream/generate', {
    method: 'POST',
    body: JSON.stringify({ uploadId, styleId, customizations }),
  });
};
```

## Styling Notes
- Uses Tailwind CSS for responsive design
- Supports dark mode automatically
- Hover effects: scale, shadow, border color
- Active state: scale down on click
- Selected state: primary border + ring + shadow

## Accessibility
- Keyboard navigable
- Screen reader friendly
- Focus indicators
- Semantic HTML (button elements)

## Requirements Satisfied
- ✅ Display style cards with preview images
- ✅ Show style names and descriptions
- ✅ Highlight selected style
- ✅ Allow style preview before generation
- ✅ Responsive design
- ✅ Category organization

## Dependencies
- `@/components/ui/card`
- `@/components/ui/badge`
- `@/components/ui/button`
- `@/components/ui/dialog`
- `@/lib/style-catalog`
- `next/image`
- `lucide-react` (Check, Eye, Palette icons)

## Preview Images
Place preview images in: `/public/styles/`
- `corporate-blue.svg`
- `warm-studio.svg`
- `professional-gray.svg`
- `creative-teal.svg`
- `executive-charcoal.svg`
