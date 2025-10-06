# Seedream Model Issue - IMPORTANT

## The Problem

**Error:** `Invalid version or not permitted` from Replicate API

**Root Cause:** The `bytedance/seedream` model either:
1. Doesn't exist on Replicate
2. Isn't publicly available
3. Requires special access/permissions
4. Was used as a placeholder name

## The Reality

**Seedream by ByteDance** is a research model that may not be publicly available on Replicate's platform. The spec was likely written assuming this model would be available, but it's not currently accessible.

## Solutions

You have **3 options**:

### Option 1: Use an Alternative Headshot Model (Recommended)

Replace Seedream with a working headshot/portrait generation model from Replicate:

#### A. FLUX Dev with LoRA
```bash
# Add to .env.local
SEEDREAM_MODEL_VERSION="lucataco/flux-dev-lora:a22c463f11808638ad5e2ebd582e07a469031f48dd567366fb4c6fdab91d614d"
```

**Pros:**
- Publicly available
- Good quality portraits
- Supports LoRA for style consistency
- Fast generation

**Cons:**
- Different input parameters than Seedream
- May need to adjust prompts

#### B. Stable Diffusion XL
```bash
# Add to .env.local
SEEDREAM_MODEL_VERSION="stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"
```

**Pros:**
- Very popular and reliable
- Great for portraits
- Well-documented

**Cons:**
- Slower than FLUX
- Different parameters

#### C. Other Portrait Models

Visit https://replicate.com/explore and search for:
- "headshot"
- "portrait"
- "professional photo"
- "face generation"

### Option 2: Get Seedream Access (If Available)

If Seedream is available through special access:

1. **Check if you have access:**
   - Visit https://replicate.com/bytedance/seedream
   - See if the model exists and you can access it

2. **Get the version hash:**
   - Click on the model
   - Find the version hash (looks like: `abc123def456...`)
   - Copy the full hash

3. **Add to environment:**
   ```bash
   # Add to .env.local
   SEEDREAM_MODEL_VERSION="bytedance/seedream:abc123def456..."
   ```

### Option 3: Build Your Own Model

If you want the exact Seedream functionality:

1. Train your own model using Replicate's training API
2. Deploy it as a custom model
3. Use your custom model version

## Quick Fix (For Testing)

To get the workflow working immediately, use FLUX Dev LoRA:

### Step 1: Add Environment Variable

Add to your `.env.local`:

```bash
# Replicate Model for Headshot Generation
# Using FLUX Dev LoRA as Seedream alternative
SEEDREAM_MODEL_VERSION="lucataco/flux-dev-lora:a22c463f11808638ad5e2ebd582e07a469031f48dd567366fb4c6fdab91d614d"
```

### Step 2: Restart Dev Server

```bash
# Stop the server (Ctrl+C)
# Start it again
npm run dev
```

### Step 3: Test Again

Go to http://localhost:3000/seedream-demo and try generating headshots!

## Important Notes

### Input Parameter Differences

Different models have different input parameters. You may need to adjust the `seedreamService.createPrediction()` call.

**Seedream (hypothetical):**
```typescript
{
  image: string[],
  prompt: string,
  negative_prompt: string,
  num_outputs: number,
  seed: number,
  guidance_scale: number,
  num_inference_steps: number
}
```

**FLUX Dev LoRA:**
```typescript
{
  prompt: string,
  lora_urls: string[], // Your reference images as LoRA
  num_outputs: number,
  guidance_scale: number,
  num_inference_steps: number
}
```

You may need to adapt the service to match the chosen model's parameters.

### Style Consistency

The original Seedream design used **fixed seeds per style** to ensure consistent backgrounds. With alternative models, you might need to:

1. **Use LoRA training** - Train a LoRA for each style
2. **Use consistent prompts** - Carefully craft prompts for each style
3. **Use img2img** - Generate base images and refine them

## Recommended Approach

For a production-ready solution:

### Phase 1: Use FLUX Dev LoRA (Now)
- Get the workflow working
- Test the UI/UX
- Validate the flow

### Phase 2: Optimize Model Choice (Later)
- Research best headshot models
- Test quality and speed
- Consider training custom models

### Phase 3: Fine-tune (Production)
- Train style-specific LoRAs
- Optimize prompts
- Implement quality checks

## Updated Code

I've already updated `lib/seedream-service.ts` to:
1. Read model version from environment variable
2. Show helpful error if not configured
3. Provide guidance on finding models

## Next Steps

1. **Choose a model** from Option 1 above
2. **Add environment variable** to `.env.local`
3. **Restart dev server**
4. **Test the workflow**
5. **Adjust parameters** if needed

## Testing Different Models

To test different models easily:

```bash
# In .env.local, try different models:

# Option A: FLUX Dev LoRA
SEEDREAM_MODEL_VERSION="lucataco/flux-dev-lora:a22c463f11808638ad5e2ebd582e07a469031f48dd567366fb4c6fdab91d614d"

# Option B: SDXL
SEEDREAM_MODEL_VERSION="stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"

# Option C: Your custom model
SEEDREAM_MODEL_VERSION="your-username/your-model:version-hash"
```

Restart the server after each change and test!

## Resources

- **Replicate Models:** https://replicate.com/explore
- **Replicate Docs:** https://replicate.com/docs
- **FLUX Dev LoRA:** https://replicate.com/lucataco/flux-dev-lora
- **SDXL:** https://replicate.com/stability-ai/sdxl

## Summary

The Seedream model isn't available, but you can:
1. ✅ Use FLUX Dev LoRA as a drop-in replacement
2. ✅ Use SDXL for reliable portrait generation
3. ✅ Search Replicate for other headshot models
4. ✅ Train your own custom model

**Quick fix:** Add `SEEDREAM_MODEL_VERSION` to `.env.local` with a working model version hash!
