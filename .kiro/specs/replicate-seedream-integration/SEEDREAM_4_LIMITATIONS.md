# Seedream-4 API Limitations

## Important Discovery

Seedream-4 has a **completely different API** than expected. It's designed for **image generation**, not specifically for headshots with customizations.

## Parameter Differences

### What We Expected (Generic Headshot Model)
```typescript
{
  image: string[],           // Multiple reference images
  prompt: string,
  negative_prompt: string,   // Remove jewelry, glasses, etc.
  num_outputs: 10,
  seed: number,              // For consistency
  guidance_scale: 7.5,
  num_inference_steps: 50
}
```

### What Seedream-4 Actually Uses
```typescript
{
  image_input: string[],     // ✅ Different parameter name
  prompt: string,            // ✅ Supported
  max_images: 4,             // ✅ Max 4 (not 10)
  size: "1K" | "2K",         // ✅ New parameter
  aspect_ratio: "1:1" | "4:3" | "16:9", // ✅ New parameter
  // ❌ NO negative_prompt
  // ❌ NO seed
  // ❌ NO guidance_scale
  // ❌ NO num_inference_steps
}
```

## Key Limitations

### 1. ❌ No Negative Prompts
**Impact:** Cannot remove jewelry, glasses, piercings, etc. via negative prompts

**Workaround:** Must include removal instructions in the main prompt:
```typescript
prompt: "professional headshot without jewelry, glasses, or piercings, ..."
```

### 2. ❌ No Seed Control
**Impact:** Cannot guarantee consistent backgrounds across users

**Workaround:** Use very specific prompts for each style

### 3. ❌ Max 4 Outputs
**Impact:** Can only generate 4 images per request (not 10)

**Workaround:** Make multiple requests or accept 4 images

### 4. ❌ No Guidance Scale
**Impact:** Cannot control how closely it follows the prompt

**Workaround:** Use clear, specific prompts

## What This Means for Our Design

### Original Design Goals
1. ✅ Multiple reference images → **Supported** (image_input array)
2. ❌ Remove jewelry/glasses via negative prompts → **Not supported**
3. ❌ Consistent backgrounds via seeds → **Not supported**
4. ❌ 10 outputs per generation → **Only 4 max**

### Adjusted Approach

#### For Customizations (Remove Jewelry, etc.)
Instead of negative prompts, we need to include in the main prompt:

```typescript
// Before (doesn't work with Seedream-4)
{
  prompt: "professional headshot, corporate background",
  negative_prompt: "jewelry, glasses, piercings"
}

// After (works with Seedream-4)
{
  prompt: "professional headshot without jewelry, glasses, or piercings, corporate background"
}
```

#### For Style Consistency
Instead of fixed seeds, use very specific prompts:

```typescript
{
  prompt: "professional headshot, solid navy blue background, studio lighting, centered composition, business attire"
}
```

#### For Multiple Outputs
Either:
- Accept 4 images per generation
- Make multiple requests (4 × 3 = 12 images)
- Let user generate multiple times

## Updated Code

I've updated:
1. ✅ `lib/seedream-service.ts` - Maps parameters to Seedream-4 format
2. ✅ `components/SeedreamWorkflow.tsx` - Requests 4 outputs (not 10)

## What Needs to Change

### 1. Style Catalog Prompts
Update `lib/style-catalog.ts` to include removal instructions in prompts:

```typescript
{
  id: 'corporate-blue',
  prompt: 'professional business headshot without jewelry or glasses, solid navy blue background, studio lighting, centered, business attire',
  // No negativePrompt - not supported by Seedream-4
}
```

### 2. Customization Handling
Update `lib/style-catalog.ts` `buildNegativePrompt()` function to build into main prompt instead:

```typescript
// Instead of building negative prompt
// Build enhanced positive prompt
export function buildEnhancedPrompt(style: Style, customizations?: SeedreamCustomizations): string {
  let prompt = style.prompt;
  
  const removals: string[] = [];
  if (customizations?.removeJewelry) removals.push('without jewelry');
  if (customizations?.removeGlasses) removals.push('without glasses');
  if (customizations?.removePiercings) removals.push('without piercings');
  
  if (removals.length > 0) {
    prompt = prompt + ', ' + removals.join(', ');
  }
  
  if (customizations?.cleanBackground) {
    prompt = prompt + ', clean professional background';
  }
  
  return prompt;
}
```

### 3. UI Expectations
Update UI to reflect 4 images:
- Change "10 professional headshots" to "4 professional headshots"
- Or add option to generate multiple batches

## Testing Now

After these changes:
1. ✅ Images will be sent correctly (image_input parameter)
2. ✅ Will generate 4 images (max_images parameter)
3. ⚠️ Customizations won't work yet (need to update prompt building)
4. ⚠️ Style consistency may vary (no seed control)

## Next Steps

1. **Test current changes** - Verify images are used correctly
2. **Update style catalog** - Include removal instructions in prompts
3. **Update prompt building** - Merge customizations into main prompt
4. **Test results** - Verify quality and consistency

## Alternative: Different Model?

If Seedream-4's limitations are too restrictive, consider:
- Finding a different headshot model with more control
- Using FLUX Dev LoRA with proper configuration
- Training a custom model with desired parameters

## Summary

**What Works:**
- ✅ Multiple reference images
- ✅ Custom prompts
- ✅ 4 outputs per generation

**What Doesn't Work:**
- ❌ Negative prompts (no removal via negative)
- ❌ Seed control (no consistency guarantee)
- ❌ 10 outputs (max 4)
- ❌ Guidance scale control

**Workaround:**
- Include removal instructions in main prompt
- Use very specific style prompts
- Accept 4 images or make multiple requests
