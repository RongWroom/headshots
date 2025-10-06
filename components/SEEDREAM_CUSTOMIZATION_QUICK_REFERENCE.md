# Seedream Customization UI - Quick Reference

## Quick Start

```tsx
import SeedreamCustomizationUI from '@/components/SeedreamCustomizationUI';
import { SeedreamCustomizations } from '@/types/seedream';

const [customizations, setCustomizations] = useState<SeedreamCustomizations>({
  removeJewelry: false,
  removeGlasses: false,
  removePiercings: false,
  cleanBackground: false,
});

<SeedreamCustomizationUI
  customizations={customizations}
  onCustomizationsChange={setCustomizations}
/>
```

## Customization Options

| Option | Negative Prompt Added |
|--------|----------------------|
| Remove jewelry | `jewelry, earrings, necklace, rings, bracelet` |
| Remove glasses | `glasses, eyeglasses, sunglasses` |
| Remove piercings | `piercings, nose ring, lip ring, eyebrow ring` |
| Clean background | `cluttered, messy, distracting elements` |

## API Integration

```typescript
// Send to generation API
const response = await fetch('/api/seedream/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    uploadId: 'uuid',
    styleId: 'corporate-blue',
    customizations: customizations, // Pass the state directly
  }),
});
```

## Component Features

✅ Four customization checkboxes  
✅ Tooltips with detailed explanations  
✅ Visual summary of selected options  
✅ Hover effects and transitions  
✅ Disabled state support  
✅ Fully accessible (ARIA, keyboard navigation)  
✅ Responsive design  

## Files Created

- `components/ui/checkbox.tsx` - Reusable checkbox component
- `components/SeedreamCustomizationUI.tsx` - Main customization UI
- `components/README-SeedreamCustomizationUI.md` - Full documentation
- `components/SEEDREAM_CUSTOMIZATION_QUICK_REFERENCE.md` - This file

## Test Page

Visit `/seedream-test` to see the component in action with the upload flow.

## Requirements Satisfied

✅ Task 12: Build frontend customization UI  
✅ Requirement 9.3: Customization checkboxes  
✅ Requirement 9.4: Customizations added to negative prompt  
