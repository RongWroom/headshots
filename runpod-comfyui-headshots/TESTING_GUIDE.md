# ComfyUI Workflow Testing Guide

## Overview

This guide provides step-by-step instructions for testing the ComfyUI headshot generation workflow locally before deploying to RunPod.

## Prerequisites

### System Requirements

- **OS**: Linux, macOS, or Windows with WSL2
- **GPU**: NVIDIA GPU with 16GB+ VRAM (recommended: A40, A100, RTX 4090)
- **RAM**: 32GB+ system RAM
- **Storage**: 50GB+ free space for models
- **Python**: 3.10 or 3.11

### Software Requirements

- Git
- Python 3.10/3.11
- CUDA 11.8+ (for GPU support)
- pip or conda

## Installation Steps

### 1. Install ComfyUI

```bash
# Clone ComfyUI repository
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install additional dependencies for custom nodes
pip install opencv-python pillow requests
```

### 2. Install Required Custom Nodes

```bash
cd custom_nodes

# RMBG - Background Removal
git clone https://github.com/Acly/comfyui-rmbg.git
cd comfyui-rmbg
pip install -r requirements.txt
cd ..

# CLIP Interrogator - Face Analysis
git clone https://github.com/talesofai/comfyui-clip-interrogator.git
cd comfyui-clip-interrogator
pip install -r requirements.txt
cd ..

# Return to ComfyUI root
cd ..
```

### 3. Download Required Models

```bash
# Create model directories
mkdir -p models/loras
mkdir -p models/checkpoints
mkdir -p models/rmbg
mkdir -p models/clip

# RMBG model (auto-downloads on first use)
# CLIP model (auto-downloads on first use)

# Download base checkpoint (for LoRA refinement)
# Option 1: Realistic Vision v5.1
wget -P models/checkpoints/ \
  "https://civitai.com/api/download/models/130072" \
  -O models/checkpoints/realisticVision_v51.safetensors

# Option 2: Or use any other realistic checkpoint you prefer
```

### 4. Add DanDan LoRA

```bash
# Place your trained DanDan-Actor LoRA in the loras directory
# If you have it from Replicate training:
cp /path/to/dandan-actor.safetensors models/loras/

# Or download from your storage
# wget -O models/loras/dandan-actor.safetensors "YOUR_LORA_URL"
```

## Workflow Setup

### 1. Copy Workflow File

```bash
# Copy the workflow JSON to ComfyUI directory
cp /path/to/runpod-comfyui-headshots/workflow.json \
   /path/to/ComfyUI/workflows/headshot_generation.json
```

### 2. Start ComfyUI

```bash
# From ComfyUI root directory
python main.py

# Or with low VRAM mode if needed
python main.py --lowvram

# Or with CPU mode for testing (slow)
python main.py --cpu
```

### 3. Access ComfyUI Interface

Open your browser and navigate to:
```
http://localhost:8188
```

### 4. Load Workflow

1. In ComfyUI interface, click "Load" button
2. Navigate to `workflows/headshot_generation.json`
3. Click "Open"
4. Workflow should load with all nodes visible

## Testing Procedure

### Test 1: Workflow Structure Validation

**Objective**: Verify workflow loads without errors

**Steps**:
1. Load workflow in ComfyUI
2. Check that all nodes are present
3. Verify no red error indicators on nodes
4. Check that all connections are intact

**Expected Result**: 
- All 15 nodes visible
- No error messages
- All links properly connected

**Troubleshooting**:
- If nodes are missing: Install required custom nodes
- If models not found: Download required models
- If red errors: Check node configuration

### Test 2: Background Removal

**Objective**: Test RMBG background removal

**Steps**:
1. Replace LoadImageBatch node with LoadImage node
2. Upload a test portrait photo
3. Connect to RMBG node
4. Queue prompt
5. View output

**Expected Result**:
- Background cleanly removed
- Face and body preserved
- Transparent PNG output

**Sample Test Images**:
- Use 5-10 portrait photos with clear faces
- Various backgrounds (indoor, outdoor, solid)
- Different lighting conditions

### Test 3: Face Analysis

**Objective**: Test CLIP Interrogator feature detection

**Steps**:
1. Use background-removed images from Test 2
2. Connect to CLIPInterrogator node
3. Queue prompt
4. Check console output for detected features

**Expected Result**:
```json
{
  "gender": "male" or "female",
  "skin_tone": "light", "medium", "dark",
  "hair_color": "brown", "black", "blonde", etc.,
  "hair_style": "short", "long", "curly", etc.,
  "age_range": "20-30", "30-40", etc.,
  "eye_color": "brown", "blue", "green", etc.
}
```

**Validation**:
- Features should match visual inspection
- Consistent results across similar images
- No crashes or errors

### Test 4: Prompt Generation

**Objective**: Test PromptBuilder node

**Steps**:
1. Use features from Test 3
2. Connect to PromptBuilder node
3. Queue prompt
4. Check generated prompt text

**Expected Result**:
```
A professional headshot portrait of a [gender] with [skin_tone] skin, 
[hair_color] hair, [age_range] years old, in dandan style. 
Cinematic lighting, shallow depth of field, Canon R6, 
Canon 70-200mm F2.8, muted tones (brown, gray, green, blue), 
soft directional lighting, professional serious expression, 
looking directly at camera, body angled 45 degrees, 
face toward camera, photorealistic skin textures, sharp eyes, 
natural hair color, subtle shadows, contemplative mood
```

**Validation**:
- Prompt includes detected features
- DanDan style keywords present
- Professional photography terms included

### Test 5: Seedream Generation (Simulated)

**Objective**: Test Seedream node configuration

**Note**: Seedream 4.0 requires API access or custom integration. For local testing, you can:

**Option A - Mock Testing**:
1. Replace SeedreamNode with a standard KSampler
2. Use base checkpoint for generation
3. Verify parameters are correctly set

**Option B - API Integration**:
1. Set up Replicate API key
2. Configure Seedream API calls
3. Test with actual Seedream 4.0 model

**Expected Parameters**:
- Size: 2K
- Width: 1728
- Height: 2304
- Aspect Ratio: 3:4
- Max Images: 4
- Prompt Strength: 0.85

### Test 6: LoRA Refinement (Optional)

**Objective**: Test optional LoRA refinement path

**Steps**:
1. Enable LoRA nodes (change mode from 4 to 0)
2. Ensure DanDan LoRA is loaded
3. Set denoise to 0.4
4. Queue prompt
5. Compare with/without LoRA

**Expected Result**:
- Subtle style enhancement
- Face preserved (no major changes)
- Photography aesthetic improved
- Muted tones, soft lighting

**Validation**:
- LoRA strength: 0.35 (not too strong)
- Denoise: 0.4 (preserves face)
- Output quality improved

### Test 7: Complete End-to-End

**Objective**: Test full workflow with all stages

**Steps**:
1. Prepare 5-10 test portrait photos
2. Load workflow
3. Configure all nodes
4. Queue prompt
5. Monitor progress
6. Review outputs

**Expected Timeline**:
- Load Images: 5 seconds
- Background Removal: 10 seconds
- Face Analysis: 15 seconds
- Prompt Building: 1 second
- Generation: 40-60 seconds (or API call time)
- LoRA Refinement: 20-30 seconds (if enabled)
- Total: 90-120 seconds

**Expected Output**:
- 4 high-resolution images (1728x2304)
- Professional headshot style
- Face matches input photos
- DanDan aesthetic (muted tones, soft lighting)

### Test 8: Error Handling

**Objective**: Test workflow resilience

**Test Cases**:

1. **Invalid Images**:
   - Upload non-face images
   - Expected: Graceful error or skip

2. **Missing Models**:
   - Remove LoRA file temporarily
   - Expected: Error message, workflow stops

3. **Memory Overflow**:
   - Use very large images
   - Expected: Resize or error message

4. **Network Issues** (for API calls):
   - Disconnect internet
   - Expected: Timeout error, retry logic

## Validation Checklist

Use this checklist to verify workflow readiness:

### Workflow Structure
- [ ] All 15 nodes present
- [ ] All connections intact
- [ ] No error indicators
- [ ] Groups properly organized

### Node Configuration
- [ ] LoadImageBatch accepts 5-10 images
- [ ] RMBG uses RMBG-1.4 model
- [ ] CLIPInterrogator uses ViT-L-14
- [ ] PromptBuilder has correct template
- [ ] Seedream parameters match spec
- [ ] LoRA nodes disabled by default (mode: 4)
- [ ] LoRA strength set to 0.35
- [ ] Denoise set to 0.4

### Progress Tracking
- [ ] Webhook node configured
- [ ] Progress stages defined (10%, 20%, 40%, 50%, 80%, 100%)
- [ ] Messages descriptive

### Output Quality
- [ ] Background removal clean
- [ ] Face features detected accurately
- [ ] Prompts well-formatted
- [ ] Generated images high quality
- [ ] Face consistency maintained
- [ ] Style matches DanDan aesthetic

### Performance
- [ ] Total time < 2 minutes
- [ ] Memory usage acceptable
- [ ] No crashes or hangs
- [ ] Reproducible results

## Common Issues and Solutions

### Issue 1: Custom Node Not Found

**Error**: `Unknown node type: RMBG`

**Solution**:
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Acly/comfyui-rmbg.git
cd comfyui-rmbg
pip install -r requirements.txt
# Restart ComfyUI
```

### Issue 2: Model Not Found

**Error**: `Could not find model: dandan-actor.safetensors`

**Solution**:
```bash
# Check model location
ls ComfyUI/models/loras/

# Copy model to correct location
cp /path/to/dandan-actor.safetensors ComfyUI/models/loras/
```

### Issue 3: CUDA Out of Memory

**Error**: `RuntimeError: CUDA out of memory`

**Solutions**:
1. Use `--lowvram` flag when starting ComfyUI
2. Reduce batch size
3. Use smaller images
4. Close other GPU applications

### Issue 4: Slow Generation

**Problem**: Generation takes > 5 minutes

**Solutions**:
1. Check GPU is being used (not CPU)
2. Update GPU drivers
3. Use faster GPU
4. Optimize workflow (remove unnecessary nodes)

### Issue 5: Poor Face Consistency

**Problem**: Generated faces don't match input

**Solutions**:
1. Use more reference images (8-10 instead of 5)
2. Ensure reference images show face clearly
3. Increase Seedream prompt_strength (0.85 → 0.90)
4. Use higher quality reference images

## Next Steps After Testing

Once all tests pass:

1. **Document Results**:
   - Screenshot successful outputs
   - Note generation times
   - Record any issues encountered

2. **Optimize Workflow**:
   - Adjust parameters based on results
   - Fine-tune LoRA strength if needed
   - Optimize for speed vs quality

3. **Prepare for Deployment**:
   - Build Docker image with workflow
   - Test in Docker container locally
   - Deploy to RunPod serverless endpoint

4. **Integration Testing**:
   - Test with API wrapper (handler.py)
   - Test webhook functionality
   - Test with production image URLs

## Support and Resources

- **ComfyUI Discord**: https://discord.gg/comfyui
- **ComfyUI GitHub**: https://github.com/comfyanonymous/ComfyUI
- **RMBG Node**: https://github.com/Acly/comfyui-rmbg
- **CLIP Interrogator**: https://github.com/talesofai/comfyui-clip-interrogator
- **RunPod Docs**: https://docs.runpod.io/

## Conclusion

This testing guide ensures the ComfyUI workflow is production-ready before deployment. Complete all tests and validation checks before proceeding to RunPod deployment.

For deployment instructions, see `DEPLOYMENT_GUIDE.md`.
