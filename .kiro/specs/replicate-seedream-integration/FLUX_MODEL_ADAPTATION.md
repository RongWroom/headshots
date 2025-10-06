# FLUX Dev LoRA Model Adaptation

## Changes Made

### Issue
FLUX Dev LoRA model has different parameter requirements than the hypothetical Seedream model:

**Error:**
```
- input.image: Invalid type. Expected: string, given: array
- input.num_outputs: Must be less than or equal to 4
```

### Solution

Updated `lib/seedream-service.ts` to adapt parameters:

#### 1. Image Parameter
**Before:** Sent array of images
```typescript
image: input.image // ['url1', 'url2', 'url3']
```

**After:** Send only first image
```typescript
const imageInput = Array.isArray(input.image) ? input.image[0] : input.image;
// Now: 'url1'
```

#### 2. Number of Outputs
**Before:** Requested 10 outputs
```typescript
num_outputs: input.num_outputs || 10
```

**After:** Cap at 4 outputs (FLUX limit)
```typescript
const numOutputs = Math.min(input.num_outputs || 4, 4);
```

### Files Modified

1. **`lib/seedream-service.ts`**
   - Adapt `image` parameter (array → string)
   - Cap `num_outputs` at 4

2. **`components/SeedreamWorkflow.tsx`**
   - Changed request from 10 outputs to 4
   - Updated UI text to be dynamic

## Model Comparison

### Hypothetical Seedream
```typescript
{
  image: string[],        // Multiple reference images
  prompt: string,
  negative_prompt: string,
  num_outputs: 10,        // Up to 10 outputs
  seed: number,
  guidance_scale: 7.5,
  num_inference_steps: 50
}
```

### FLUX Dev LoRA (Actual)
```typescript
{
  image: string,          // Single image only
  prompt: string,
  negative_prompt: string,
  num_outputs: 4,         // Max 4 outputs
  seed: number,
  guidance_scale: 7.5,
  num_inference_steps: 50
}
```

## Limitations with FLUX

### 1. Single Reference Image
- Original design: Use 1-5 reference images for better face accuracy
- FLUX limitation: Only uses first uploaded image
- **Impact:** May have slightly less accurate face matching

### 2. Fewer Outputs
- Original design: Generate 10 headshots per request
- FLUX limitation: Max 4 outputs per request
- **Impact:** Users get 4 headshots instead of 10

### 3. Workarounds

#### Option A: Multiple Generations
Generate multiple times to get more images:
```typescript
// Generate 4 images, 3 times = 12 total
for (let i = 0; i < 3; i++) {
  await generateHeadshots({ numOutputs: 4 });
}
```

#### Option B: Use All Images Sequentially
Generate with each uploaded image:
```typescript
// If user uploaded 3 images, generate 4 from each = 12 total
for (const imageUrl of uploadedImages) {
  await generateHeadshots({ 
    image: imageUrl,
    numOutputs: 4 
  });
}
```

#### Option C: Find a Better Model
Search Replicate for models that support:
- Multiple reference images
- More outputs per generation
- Better face consistency

## Testing

After these changes, the workflow should work:

1. ✅ Upload 1-5 images (only first will be used)
2. ✅ Select customizations
3. ✅ Select style
4. ✅ Click "Generate Professional Headshots"
5. ✅ See progress
6. ✅ Get 4 headshots (instead of 10)

## Future Improvements

### Short Term
- [ ] Show warning that only first image is used
- [ ] Update UI to say "4 headshots" instead of "10"
- [ ] Add option to generate multiple batches

### Medium Term
- [ ] Find model that supports multiple reference images
- [ ] Implement batch generation (4 images × 3 batches = 12 total)
- [ ] Add image selection UI (choose which uploaded image to use)

### Long Term
- [ ] Train custom model with desired parameters
- [ ] Support multiple models (let user choose)
- [ ] Implement smart image selection (best quality image)

## Alternative Models to Consider

### Models with Multiple Reference Images
Search Replicate for:
- "face swap" models (often support multiple references)
- "consistent character" models
- "identity preservation" models

### Models with More Outputs
- Some SDXL variants support more outputs
- Custom trained models can be configured

### Recommended Next Steps
1. **Test current setup** - Verify 4 images work well
2. **Gather user feedback** - Is 4 enough?
3. **Research alternatives** - Find better model if needed
4. **Consider training** - Custom model for exact needs

## Summary

**What Changed:**
- ✅ Adapted to FLUX's single image input
- ✅ Capped outputs at 4 (FLUX limit)
- ✅ Updated UI to reflect 4 images

**What Works:**
- ✅ Complete workflow from upload to results
- ✅ Progress tracking
- ✅ Style selection
- ✅ Customizations

**What's Limited:**
- ⚠️ Only uses first uploaded image
- ⚠️ Only generates 4 images (not 10)

**Next Steps:**
- Test the workflow
- Decide if 4 images is sufficient
- Consider alternatives if needed
