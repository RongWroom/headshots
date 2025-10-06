# Finding the Correct Seedream Model

## The Issue

You want to use the **actual Seedream model by ByteDance**, not a replacement like FLUX.

## How to Find the Correct Model Version

### Step 1: Check Replicate

Visit: https://replicate.com/bytedance/seedream

**If the model exists:**
- You'll see the model page
- Look for the version hash (long string like `abc123def456...`)
- Copy the full version hash

**If you get a 404:**
- The model might not be publicly available yet
- It might be under a different name
- It might require special access

### Step 2: Search Replicate

Try searching for:
- "seedream" - https://replicate.com/search?query=seedream
- "bytedance" - https://replicate.com/bytedance
- "headshot generation"
- "portrait generation"

### Step 3: Check ByteDance's Official Channels

- **GitHub:** https://github.com/bytedance
- **Research Paper:** Search for "Seedream ByteDance" on Google Scholar
- **Replicate Collections:** Check if ByteDance has a collection

## What We Know About Seedream

Based on the spec, Seedream should support:

```typescript
{
  image: string[],        // Multiple reference images (1-5)
  prompt: string,         // Style prompt
  negative_prompt: string, // What to avoid
  num_outputs: 10,        // Number of images to generate
  seed: number,           // For consistency
  guidance_scale: 7.5,
  num_inference_steps: 50
}
```

## Possible Scenarios

### Scenario A: Model Exists with Different Name

Seedream might be published under a different name:
- `bytedance/seedream-v1`
- `bytedance/headshot-generator`
- `bytedance/portrait-ai`

**Action:** Search Replicate for ByteDance models

### Scenario B: Model Requires Access

Some models on Replicate require:
- API key with special permissions
- Paid subscription
- Beta access request

**Action:** Check if you need to request access

### Scenario C: Model Not Yet Public

Seedream might be:
- Still in research phase
- Not yet released on Replicate
- Available through different platform

**Action:** Contact ByteDance or wait for public release

### Scenario D: Model Under Different Owner

The model might be published by:
- A community member who replicated it
- A different organization with license
- Under a fork or variant name

**Action:** Search for "seedream" on Replicate

## How to Get the Correct Version Hash

Once you find the model:

### Method 1: From Model Page

1. Go to the model page (e.g., `replicate.com/bytedance/seedream`)
2. Look for "Versions" or "API" tab
3. Find the version hash (looks like: `a1b2c3d4e5f6...`)
4. Copy the full hash

### Method 2: From API Tab

1. Click "API" on the model page
2. Look at the example code
3. Find the version parameter
4. Copy the hash

### Method 3: Using Replicate CLI

```bash
# Install Replicate CLI
npm install -g replicate

# List model versions
replicate models versions bytedance/seedream

# Get latest version
replicate models get bytedance/seedream:latest
```

## Setting Up Once You Have the Version

### Option 1: Full Version Hash (Recommended)

```bash
# In .env.local
SEEDREAM_MODEL_VERSION=bytedance/seedream:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
```

### Option 2: Latest Tag

```bash
# In .env.local
SEEDREAM_MODEL_VERSION=bytedance/seedream:latest
```

**Note:** Using `:latest` is not recommended for production as the model might change.

## If Seedream Doesn't Exist on Replicate

You have a few options:

### Option 1: Contact ByteDance

- Ask if/when Seedream will be available on Replicate
- Request access if it's in beta
- Check their official channels for updates

### Option 2: Use Alternative (Temporary)

While waiting for Seedream:
- Use FLUX Dev LoRA for testing the workflow
- Use SDXL for portrait generation
- Find similar headshot models

### Option 3: Deploy Your Own

If you have access to Seedream weights:
1. Deploy to Replicate using Cog
2. Use your own deployment
3. Update `SEEDREAM_MODEL_VERSION` to your model

## Current Status Check

Let me help you check if Seedream exists:

### Quick Test

Try visiting these URLs:
1. https://replicate.com/bytedance/seedream
2. https://replicate.com/search?query=seedream
3. https://replicate.com/bytedance

**What do you see?**
- ✅ Model page → Great! Copy the version hash
- ❌ 404 error → Model not available yet
- ⚠️ Access required → Need to request access

## Next Steps

### If Model Exists:
1. Copy the version hash
2. Add to `.env.local`:
   ```bash
   SEEDREAM_MODEL_VERSION=bytedance/seedream:VERSION_HASH_HERE
   ```
3. Restart server
4. Test workflow

### If Model Doesn't Exist:
1. **Short term:** Use FLUX or SDXL to test workflow
2. **Medium term:** Monitor for Seedream release
3. **Long term:** Consider alternatives or custom deployment

## Help Me Help You

**Can you check:**
1. Visit https://replicate.com/bytedance/seedream
2. What do you see?
   - Model page with details?
   - 404 error?
   - Access required message?

3. Do you have:
   - Special access to Seedream?
   - Beta access credentials?
   - Direct contact with ByteDance?

**Let me know what you find and I can help you configure it correctly!**

## Alternative: Check Your Replicate Account

Maybe Seedream is available but requires authentication:

```bash
# Set your Replicate token
export REPLICATE_API_TOKEN=r8_your_token_here

# Try to list the model
curl -H "Authorization: Token $REPLICATE_API_TOKEN" \
  https://api.replicate.com/v1/models/bytedance/seedream
```

If this returns model details, you have access! Copy the version hash from the response.
