# ComfyUI Workflow Guide

## Overview

This document explains the ComfyUI workflow JSON structure for the DanDan professional headshot generation system.

## Workflow Architecture

The workflow consists of 7 main phases:

### Phase 1: Image Loading (Node 1)
- **Node Type**: LoadImageBatch
- **Purpose**: Loads 5-10 reference images from URLs
- **Progress**: 10%
- **Output**: IMAGE tensor array

### Phase 2: Background Removal (Node 2)
- **Node Type**: RMBG
- **Purpose**: Removes backgrounds using RMBG-1.4 model
- **Progress**: 20%
- **Input**: Original images
- **Output**: Transparent PNG images with backgrounds removed

### Phase 3: Face Analysis (Node 3)
- **Node Type**: CLIPInterrogator
- **Purpose**: Analyzes facial features (gender, skin tone, hair, eyes, age)
- **Progress**: 40%
- **Input**: Background-removed images
- **Output**: 
  - TEXT: Feature description string
  - FEATURES: Dictionary of detected features

### Phase 4: Prompt Building (Node 4)
- **Node Type**: PromptBuilder (Custom)
- **Purpose**: Combines detected features with DanDan style template
- **Template**: 
  ```
  A professional headshot portrait of a {gender} with {skin_tone} skin, 
  {hair_color} hair, {age_range} years old, in dandan style. 
  Cinematic lighting, shallow depth of field, Canon R6, 
  Canon 70-200mm F2.8, muted tones (brown, gray, green, blue), 
  soft directional lighting, professional serious expression, 
  looking directly at camera, body angled 45 degrees, 
  face toward camera, photorealistic skin textures, sharp eyes, 
  natural hair color, subtle shadows, contemplative mood
  ```
- **Output**: Final prompt string

### Phase 5: Seedream Generation (Node 5)
- **Node Type**: SeedreamNode
- **Purpose**: Generates 4 high-resolution headshots with face consistency
- **Progress**: 50-70%
- **Parameters**:
  - Model: bytedance/seedream-4
  - Size: 2K (1728x2304)
  - Aspect Ratio: 3:4
  - Max Images: 4
  - Prompt Strength: 0.85
- **Input**: 
  - Background-removed images (for face learning)
  - Generated prompt
- **Output**: 4 high-res headshot images

### Phase 6: Optional LoRA Refinement (Nodes 6-11)
- **Activation**: Only when styleIntensity > 0.5
- **Progress**: 80%
- **Nodes**:
  - Node 6: LoRALoader (loads DanDan-Actor LoRA at 0.35 strength)
  - Node 7: VAEEncode (encodes Seedream output to latent)
  - Node 8: KSampler (applies LoRA refinement at 0.4 denoise)
  - Node 9: VAEDecode (decodes back to image)
  - Node 10: CLIPTextEncode (positive prompt)
  - Node 11: CLIPTextEncode (negative prompt)
- **Purpose**: Enhances photography aesthetic without losing face
- **Mode**: Disabled by default (mode: 4)

### Phase 7: Save & Webhook (Nodes 12-13)
- **Node 12**: ImageSelector - Chooses refined images if available, otherwise Seedream output
- **Node 13**: SaveImageWebhook - Converts to base64 and sends webhook
- **Progress**: 100%

## Webhook Progress Updates

The workflow sends progress updates at these stages:

| Stage | Progress | Message |
|-------|----------|---------|
| Load Images | 10% | "Loading reference images..." |
| Background Removal | 20% | "Removing backgrounds..." |
| Face Analysis | 40% | "Analyzing facial features..." |
| Seedream Generation | 50% | "Generating professional headshots..." |
| LoRA Refinement | 80% | "Refining photography style..." |
| Complete | 100% | "Complete!" |

## Node Configuration

### Required Custom Nodes

1. **RMBG** - Background removal
   - Install: `cd custom_nodes && git clone https://github.com/Acly/comfyui-rmbg`
   
2. **CLIPInterrogator** - Face analysis
   - Install: `cd custom_nodes && git clone https://github.com/talesofai/comfyui-clip-interrogator`
   
3. **Seedream Integration** - Image generation
   - Requires Seedream 4.0 API integration or custom node
   
4. **Webhook Nodes** - Progress updates
   - Custom implementation required (see handler.py)

### Model Requirements

1. **RMBG-1.4 Model**
   - Location: `models/rmbg/RMBG-1.4.pth`
   - Download: Auto-downloaded by RMBG node

2. **CLIP Model**
   - Location: `models/clip/ViT-L-14-openai.pt`
   - Download: Auto-downloaded by CLIP Interrogator

3. **DanDan-Actor LoRA**
   - Location: `models/loras/dandan-actor.safetensors`
   - Source: Trained LoRA from Replicate

4. **Base Checkpoint** (for LoRA refinement)
   - Location: `models/checkpoints/`
   - Recommended: Realistic Vision or similar

## Testing the Workflow

### Local Testing in ComfyUI

1. **Install ComfyUI**:
   ```bash
   git clone https://github.com/comfyanonymous/ComfyUI
   cd ComfyUI
   pip install -r requirements.txt
   ```

2. **Install Required Custom Nodes**:
   ```bash
   cd custom_nodes
   git clone https://github.com/Acly/comfyui-rmbg
   git clone https://github.com/talesofai/comfyui-clip-interrogator
   cd ..
   ```

3. **Download Models**:
   - RMBG and CLIP models will auto-download
   - Place DanDan LoRA in `models/loras/`

4. **Load Workflow**:
   - Start ComfyUI: `python main.py`
   - Open browser: `http://localhost:8188`
   - Load workflow: Drag `workflow.json` into ComfyUI

5. **Test with Sample Images**:
   - Replace `LoadImageBatch` node with local image paths
   - Set webhook URLs to test endpoints
   - Click "Queue Prompt"
   - Monitor progress in console

### Testing Checklist

- [ ] Workflow loads without errors
- [ ] All nodes are properly connected
- [ ] Background removal produces clean results
- [ ] CLIP Interrogator detects facial features accurately
- [ ] Prompt builder generates proper DanDan-style prompts
- [ ] Seedream generates 4 high-quality images
- [ ] Generated faces match input photos
- [ ] Optional LoRA refinement activates correctly
- [ ] Webhook progress updates are sent
- [ ] Final images are saved/returned properly

## Dynamic Configuration

The workflow accepts these runtime parameters:

```json
{
  "reference_images": ["url1", "url2", ...],  // 5-10 URLs
  "num_outputs": 4,                           // Number of images to generate
  "style_intensity": 0.8,                     // 0-1, controls LoRA activation
  "webhook_url": "https://...",               // Progress webhook endpoint
  "job_id": "uuid"                            // Job identifier
}
```

### LoRA Activation Logic

```python
if style_intensity > 0.5:
    # Enable LoRA refinement nodes (6-11)
    # Set node mode to 0 (active)
    enable_lora_nodes()
else:
    # Keep LoRA nodes disabled (mode: 4)
    # Use Seedream output directly
    pass
```

## Troubleshooting

### Common Issues

1. **Missing Custom Nodes**
   - Error: "Unknown node type: RMBG"
   - Solution: Install required custom nodes

2. **Model Not Found**
   - Error: "Could not find model: dandan-actor.safetensors"
   - Solution: Download and place LoRA in correct directory

3. **Webhook Failures**
   - Error: Webhook timeout or connection refused
   - Solution: Verify webhook URL is accessible from RunPod

4. **Memory Issues**
   - Error: CUDA out of memory
   - Solution: Reduce batch size or use smaller GPU

5. **Face Consistency Issues**
   - Problem: Generated faces don't match input
   - Solution: Ensure 5-10 clear face photos, adjust Seedream prompt_strength

## Performance Optimization

### GPU Memory Usage

- **Minimum**: 16GB VRAM (A40, A100)
- **Recommended**: 24GB+ VRAM
- **Optimization**: 
  - Use `--lowvram` flag if needed
  - Process images in smaller batches
  - Unload models between stages

### Generation Time

- **Expected**: 60-120 seconds per 4-image batch
- **Breakdown**:
  - Load Images: 5s
  - Background Removal: 10s
  - Face Analysis: 15s
  - Seedream Generation: 40-60s
  - LoRA Refinement: 20-30s (if enabled)
  - Save/Webhook: 5s

## Integration with RunPod

The workflow is designed to run on RunPod serverless endpoints. See `handler.py` for the Python wrapper that:

1. Receives job requests via HTTP
2. Downloads reference images
3. Executes ComfyUI workflow
4. Sends progress webhooks
5. Returns generated images

## Next Steps

After testing the workflow locally:

1. Build Docker image with workflow and models
2. Deploy to RunPod serverless endpoint
3. Test end-to-end with API integration
4. Monitor performance and costs
5. Optimize based on real-world usage

## References

- ComfyUI Documentation: https://github.com/comfyanonymous/ComfyUI
- RMBG Node: https://github.com/Acly/comfyui-rmbg
- CLIP Interrogator: https://github.com/talesofai/comfyui-clip-interrogator
- Seedream 4.0: https://replicate.com/bytedance/seedream-4
- RunPod Docs: https://docs.runpod.io/
