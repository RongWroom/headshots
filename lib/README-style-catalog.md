# Style Catalog

This module provides a centralized catalog of professional headshot styles for the Seedream integration.

## Overview

The style catalog defines consistent style configurations that ensure background consistency across all users. Each style uses a **fixed seed** to guarantee that different users selecting the same style will receive headshots with visually identical backgrounds.

## Features

- **5 Professional Styles**: Corporate Blue, Warm Studio, Professional Gray, Creative Teal, Executive Charcoal
- **Fixed Seeds**: Each style has a unique, fixed seed for background consistency
- **Customization Support**: Build custom negative prompts based on user preferences
- **Category Organization**: Styles are organized by category (corporate, creative, casual)
- **Type-Safe**: Full TypeScript support with exported interfaces

## Usage

### Import the catalog

```typescript
import {
  STYLE_CATALOG,
  getStyleById,
  getStylesByCategory,
  buildNegativePrompt,
  type Style,
} from '@/lib/style-catalog';
```

### Get a specific style

```typescript
const style = getStyleById('corporate-blue');
if (style) {
  console.log(style.name); // "Corporate Blue"
  console.log(style.seed); // 42
  console.log(style.prompt); // "professional corporate headshot..."
}
```

### Get styles by category

```typescript
const corporateStyles = getStylesByCategory('corporate');
const creativeStyles = getStylesByCategory('creative');
```

### Build custom negative prompts

```typescript
const style = getStyleById('corporate-blue');
const negativePrompt = buildNegativePrompt(style, {
  removeJewelry: true,
  removeGlasses: true,
  removePiercings: false,
  cleanBackground: true,
});
```

### Validate style IDs

```typescript
if (isValidStyleId(userSelectedStyleId)) {
  // Proceed with generation
}
```

## Available Styles

### Corporate Blue (corporate-blue)
- **Seed**: 42
- **Description**: Professional blue gradient background perfect for LinkedIn and corporate profiles
- **Category**: Corporate

### Warm Studio (warm-studio)
- **Seed**: 123
- **Description**: Warm-toned studio background with soft lighting for an approachable look
- **Category**: Corporate

### Professional Gray (professional-gray)
- **Seed**: 256
- **Description**: Classic neutral gray background for timeless professional portraits
- **Category**: Corporate

### Creative Teal (creative-teal)
- **Seed**: 789
- **Description**: Modern teal gradient for creative professionals and artists
- **Category**: Creative

### Executive Charcoal (executive-charcoal)
- **Seed**: 512
- **Description**: Sophisticated dark charcoal background for executive profiles
- **Category**: Corporate

## Style Interface

```typescript
interface Style {
  id: string;                    // Unique identifier (kebab-case)
  name: string;                  // Display name
  description: string;           // User-facing description
  prompt: string;                // Positive prompt for generation
  negativePrompt: string;        // Base negative prompt
  seed: number;                  // Fixed seed for consistency
  previewImage: string;          // Path to preview image
  category: 'corporate' | 'creative' | 'casual';
}
```

## Customization Options

The `buildNegativePrompt` function supports the following customizations:

- **removeJewelry**: Removes jewelry, earrings, necklaces, rings, bracelets, watches
- **removeGlasses**: Removes glasses, eyeglasses, sunglasses, spectacles
- **removePiercings**: Removes piercings, nose rings, lip rings, eyebrow rings
- **cleanBackground**: Removes cluttered, messy, distracting elements

## Preview Images

Style preview images are located in `/public/styles/` and are SVG placeholders showing the gradient colors for each style. These can be replaced with actual generated headshot examples.

## Validation

To validate the style catalog, run:

```bash
npx tsx lib/validate-style-catalog.ts
```

This will check:
- Minimum 3 styles exist
- Required styles (Corporate Blue, Warm Studio, Professional Gray) are present
- All style IDs are unique
- All seeds are unique
- All required fields are present
- Helper functions work correctly

## Adding New Styles

To add a new style:

1. Add a new entry to the `STYLE_CATALOG` array
2. Ensure the seed is unique
3. Create a preview image in `/public/styles/`
4. Run validation to ensure everything works
5. Update this README with the new style details

## Requirements Satisfied

This implementation satisfies the following requirements:

- **3.1**: Style catalog with style_name, prompt, negative_prompt, seed
- **3.2**: Corporate Blue style with consistent blue gradient
- **3.3**: Warm Studio style with consistent warm-toned background
- **3.4**: Fixed seed values per style for background consistency
