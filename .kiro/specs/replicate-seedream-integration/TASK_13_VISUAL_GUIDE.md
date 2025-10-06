# Task 13 Visual Guide: Style Selection UI

## Component Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🎨 Choose Your Style                                           │
│  Select a professional background style for your headshots      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│  │ [Image]  │  │ [Image]  │  │ [Image]  │                     │
│  │  ✓       │  │          │  │          │                     │
│  │          │  │          │  │          │                     │
│  ├──────────┤  ├──────────┤  ├──────────┤                     │
│  │Corporate │  │Warm      │  │Prof.     │                     │
│  │Blue      │  │Studio    │  │Gray      │                     │
│  │[Corp]    │  │[Corp]    │  │[Corp]    │                     │
│  └──────────┘  └──────────┘  └──────────┘                     │
│                                                                 │
│  ┌──────────┐  ┌──────────┐                                   │
│  │ [Image]  │  │ [Image]  │                                   │
│  │          │  │          │                                   │
│  │          │  │          │                                   │
│  ├──────────┤  ├──────────┤                                   │
│  │Creative  │  │Executive │                                   │
│  │Teal      │  │Charcoal  │                                   │
│  │[Creative]│  │[Corp]    │                                   │
│  └──────────┘  └──────────┘                                   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Selected style:                                           │ │
│  │ ┌────┐                                                    │ │
│  │ │img │  Corporate Blue                                    │ │
│  │ └────┘  Professional blue gradient background...         │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Style Card States

### Default State
```
┌──────────────────┐
│                  │
│   [Preview Img]  │
│                  │
├──────────────────┤
│ Style Name       │
│ [Category Badge] │
│ Description...   │
└──────────────────┘
```

### Hover State
```
┌──────────────────┐
│       ✓          │  ← Selected indicator (if selected)
│   [Preview Img]  │
│   [👁 Preview]   │  ← Preview button appears
│                  │
├──────────────────┤
│ Style Name       │
│ [Category Badge] │
│ Description...   │
└──────────────────┘
  ↑ Border highlights
  ↑ Card scales up slightly
```

### Selected State
```
┌══════════════════┐  ← Primary border + ring
│       ✓          │  ← Checkmark badge
│   [Preview Img]  │
│                  │
│                  │
├══════════════════┤
│ Style Name       │
│ [Category Badge] │
│ Description...   │
└══════════════════┘
```

## Preview Dialog

```
┌─────────────────────────────────────────────────────┐
│  Corporate Blue [Corporate]                      [X]│
│  Professional blue gradient background perfect...   │
├─────────────────────────────────────────────────────┤
│                                                     │
│                                                     │
│            [Large Preview Image]                    │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Style Details                                      │
│  This style uses consistent lighting and            │
│  background settings to ensure all users...         │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │        Select This Style                    │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Category Badge Colors

```
┌──────────────┐
│  Corporate   │  ← Blue background
└──────────────┘

┌──────────────┐
│  Creative    │  ← Purple background
└──────────────┘

┌──────────────┐
│  Casual      │  ← Green background
└──────────────┘
```

## Responsive Breakpoints

### Mobile (< 768px)
```
┌─────────────┐
│  [Style 1]  │
├─────────────┤
│  [Style 2]  │
├─────────────┤
│  [Style 3]  │
├─────────────┤
│  [Style 4]  │
├─────────────┤
│  [Style 5]  │
└─────────────┘
```

### Tablet (768px - 1200px)
```
┌─────────────┬─────────────┐
│  [Style 1]  │  [Style 2]  │
├─────────────┼─────────────┤
│  [Style 3]  │  [Style 4]  │
├─────────────┼─────────────┤
│  [Style 5]  │             │
└─────────────┴─────────────┘
```

### Desktop (> 1200px)
```
┌─────────────┬─────────────┬─────────────┐
│  [Style 1]  │  [Style 2]  │  [Style 3]  │
├─────────────┼─────────────┼─────────────┤
│  [Style 4]  │  [Style 5]  │             │
└─────────────┴─────────────┴─────────────┘
```

## Selected Style Summary

```
┌───────────────────────────────────────────────────┐
│  Selected style:                                  │
│  ┌────────┐                                       │
│  │        │  Corporate Blue                       │
│  │ [img]  │  Professional blue gradient           │
│  │        │  background perfect for LinkedIn...   │
│  └────────┘                                       │
└───────────────────────────────────────────────────┘
```

## Interaction Flow

```
User Flow:
1. View style cards in grid
   ↓
2. Hover over card → See preview button
   ↓
3. Click preview button → Open dialog
   ↓
4. View full-size preview
   ↓
5. Click "Select This Style" or close dialog
   ↓
6. Click card directly to select
   ↓
7. See selected indicator (✓) and summary
   ↓
8. Proceed to generation
```

## Animation Effects

### Card Hover
- Scale: 1.0 → 1.02
- Shadow: sm → lg
- Border: border → primary/50
- Duration: 200ms

### Card Active (Click)
- Scale: 1.02 → 0.98
- Duration: 200ms

### Preview Button
- Opacity: 0 → 100
- Background overlay: transparent → black/40
- Transition: 200ms

### Dialog
- Fade in/out
- Zoom in/out (95% → 100%)
- Slide from center

## Color Scheme

### Light Mode
- Card background: white
- Border: gray-200
- Selected border: primary (blue)
- Text: gray-900
- Description: gray-600

### Dark Mode
- Card background: gray-800
- Border: gray-700
- Selected border: primary (blue)
- Text: gray-100
- Description: gray-400

## Icons Used

- 🎨 `Palette` - Card header icon
- ✓ `Check` - Selected indicator
- 👁 `Eye` - Preview button

## Accessibility Features

```
Keyboard Navigation:
- Tab: Move between cards
- Enter/Space: Select card or open preview
- Escape: Close preview dialog

Screen Reader:
- Card: "Corporate Blue style, Corporate category"
- Selected: "Selected style: Corporate Blue"
- Preview: "Preview Corporate Blue style"
```

## Integration Example

```tsx
// Complete generation page layout
┌─────────────────────────────────────────────────┐
│  1. Upload Images                               │
│  [SeedreamUploadZone]                          │
├─────────────────────────────────────────────────┤
│  2. Choose Your Style                           │
│  [SeedreamStyleSelector] ← THIS COMPONENT      │
├─────────────────────────────────────────────────┤
│  3. Customize Your Headshots                    │
│  [SeedreamCustomizationUI]                     │
├─────────────────────────────────────────────────┤
│  [Generate Headshots Button]                    │
└─────────────────────────────────────────────────┘
```

## Style Catalog Reference

| Style ID | Name | Category | Seed | Color |
|----------|------|----------|------|-------|
| corporate-blue | Corporate Blue | Corporate | 42 | Blue gradient |
| warm-studio | Warm Studio | Corporate | 123 | Warm beige |
| professional-gray | Professional Gray | Corporate | 256 | Neutral gray |
| creative-teal | Creative Teal | Creative | 789 | Teal gradient |
| executive-charcoal | Executive Charcoal | Corporate | 512 | Dark charcoal |

## Component Props Flow

```
Parent Component
    ↓
    selectedStyleId (string | null)
    onStyleSelect (callback)
    disabled (boolean)
    ↓
SeedreamStyleSelector
    ↓
    Renders style cards
    Manages preview dialog state
    Calls onStyleSelect when user clicks
    ↓
Parent Component receives styleId
```

## File Structure

```
components/
├── SeedreamStyleSelector.tsx          ← Main component
├── README-SeedreamStyleSelector.md    ← Full documentation
└── SEEDREAM_STYLE_SELECTOR_QUICK_REFERENCE.md  ← Quick ref

lib/
└── style-catalog.ts                   ← Style definitions

public/
└── styles/
    ├── corporate-blue.svg
    ├── warm-studio.svg
    ├── professional-gray.svg
    ├── creative-teal.svg
    └── executive-charcoal.svg
```
