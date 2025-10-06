/**
 * Style Catalog for Seedream Headshot Generation
 * 
 * This module defines consistent style configurations for professional headshot generation.
 * Each style uses a fixed seed to ensure background consistency across all users.
 */

export interface Style {
  id: string;
  name: string;
  description: string;
  prompt: string;
  negativePrompt: string;
  seed: number; // Fixed seed for background consistency
  previewImage: string;
  category: 'corporate' | 'creative' | 'casual';
}

/**
 * Style catalog with predefined professional headshot styles.
 * Each style is designed to produce consistent backgrounds across different users.
 */
export const STYLE_CATALOG: Style[] = [
  {
    id: 'corporate-blue',
    name: 'Corporate Blue',
    description: 'Professional blue gradient background perfect for LinkedIn and corporate profiles',
    prompt: 'professional corporate headshot, blue gradient background, studio lighting, sharp focus, high quality, 8k, professional attire, confident expression',
    negativePrompt: 'casual, outdoor, messy, blurry, low quality, amateur, unprofessional, harsh shadows, overexposed',
    seed: 42,
    previewImage: '/styles/corporate-blue.svg',
    category: 'corporate',
  },
  {
    id: 'warm-studio',
    name: 'Warm Studio',
    description: 'Warm-toned studio background with soft lighting for an approachable look',
    prompt: 'professional headshot, warm beige background, soft studio lighting, natural look, high quality, 8k, friendly expression, professional appearance',
    negativePrompt: 'cold, harsh lighting, outdoor, casual, low quality, blurry, amateur, dark shadows',
    seed: 123,
    previewImage: '/styles/warm-studio.svg',
    category: 'corporate',
  },
  {
    id: 'professional-gray',
    name: 'Professional Gray',
    description: 'Classic neutral gray background for timeless professional portraits',
    prompt: 'professional headshot, neutral gray background, balanced studio lighting, sharp focus, high quality, 8k, professional demeanor, clean composition',
    negativePrompt: 'casual, outdoor, colorful, messy, blurry, low quality, amateur, distracting elements',
    seed: 256,
    previewImage: '/styles/professional-gray.svg',
    category: 'corporate',
  },
  {
    id: 'creative-teal',
    name: 'Creative Teal',
    description: 'Modern teal gradient for creative professionals and artists',
    prompt: 'professional headshot, teal gradient background, modern studio lighting, creative look, high quality, 8k, confident expression, contemporary style',
    negativePrompt: 'traditional, boring, outdoor, messy, blurry, low quality, amateur, harsh lighting',
    seed: 789,
    previewImage: '/styles/creative-teal.svg',
    category: 'creative',
  },
  {
    id: 'executive-charcoal',
    name: 'Executive Charcoal',
    description: 'Sophisticated dark charcoal background for executive profiles',
    prompt: 'professional executive headshot, dark charcoal background, dramatic studio lighting, authoritative presence, high quality, 8k, executive attire, confident demeanor',
    negativePrompt: 'casual, bright, outdoor, messy, blurry, low quality, amateur, overexposed, unprofessional',
    seed: 512,
    previewImage: '/styles/executive-charcoal.svg',
    category: 'corporate',
  },
];

/**
 * Get a style by its ID
 * @param styleId - The unique identifier for the style
 * @returns The style configuration or undefined if not found
 */
export function getStyleById(styleId: string): Style | undefined {
  return STYLE_CATALOG.find(style => style.id === styleId);
}

/**
 * Get all styles in a specific category
 * @param category - The category to filter by
 * @returns Array of styles in the specified category
 */
export function getStylesByCategory(category: Style['category']): Style[] {
  return STYLE_CATALOG.filter(style => style.category === category);
}

/**
 * Get all available style IDs
 * @returns Array of all style IDs
 */
export function getAllStyleIds(): string[] {
  return STYLE_CATALOG.map(style => style.id);
}

/**
 * Validate if a style ID exists in the catalog
 * @param styleId - The style ID to validate
 * @returns True if the style exists, false otherwise
 */
export function isValidStyleId(styleId: string): boolean {
  return STYLE_CATALOG.some(style => style.id === styleId);
}

/**
 * Get the default style (Corporate Blue)
 * @returns The default style configuration
 */
export function getDefaultStyle(): Style {
  return STYLE_CATALOG[0]; // Corporate Blue
}

/**
 * Build a custom negative prompt by combining style negative prompt with user customizations
 * @param style - The base style configuration
 * @param customizations - User-selected customization options
 * @returns Combined negative prompt string
 */
export function buildNegativePrompt(
  style: Style,
  customizations?: {
    removeJewelry?: boolean;
    removeGlasses?: boolean;
    removePiercings?: boolean;
    cleanBackground?: boolean;
  }
): string {
  const negativePrompts = [style.negativePrompt];

  if (customizations?.removeJewelry) {
    negativePrompts.push('jewelry, earrings, necklace, rings, bracelet, watch');
  }

  if (customizations?.removeGlasses) {
    negativePrompts.push('glasses, eyeglasses, sunglasses, spectacles');
  }

  if (customizations?.removePiercings) {
    negativePrompts.push('piercings, nose ring, lip ring, eyebrow ring, facial piercings');
  }

  if (customizations?.cleanBackground) {
    negativePrompts.push('cluttered, messy, distracting elements, busy background, objects in background');
  }

  return negativePrompts.join(', ');
}
