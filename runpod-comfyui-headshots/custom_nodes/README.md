# Custom ComfyUI Nodes for Headshot Generation

This directory contains custom ComfyUI nodes implementing the complete headshot generation workflow as specified in task 6 of the implementation plan.

## Nodes Overview

### 1. LoadImageBatch
**File:** `load_images_batch.py`  
**Task:** 6.1 - Configure Load Images node

**Purpose:** Loads 5-10 reference images from URLs (Vercel Blob Storage)

**Features:**
- Downloads images from URLs
- Validates image formats (JPEG, PNG)
- Validates image count (5-10)
- Resizes images for optimization
- Outputs image tensors for ComfyUI processing

**Inputs:**
- `image_urls` (STRING): Newline-separated list of image URLs
- `max_size` (INT, optional): Maximum dimension for resizing (default: 2048)

**Outputs:**
- `IMAGE`: Batch of image tensors
- `COUNT`: Number of images loaded

---

### 2. RMBG Configuration
**File:** `rmbg_node.py`  
**Task:** 6.2 - Configure RMBG background removal node

**Purpose:** Configuration and documentation for RMBG background removal

**Features:**
- Uses RMBG-1.4 or BiRefNet model
- Removes backgrounds from all images
- Outputs transparent PNG images
- Sends webhook at 20% progress

**Note:** This is a configuration file. The actual RMBG node must be installed separately in ComfyUI.

**Installation:**
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Acly/comfyui-tooling-nodes
# OR
git clone https://github.com/ZHO-ZHO-ZHO/ComfyUI-BRIA-RMBG
```

---

### 3. CLIPInterrogator
**File:** `clip_interrogator_node.py`  
**Task:** 6.3 - Configure CLIP Interrogator node

**Purpose:** Analyzes facial features from background-removed images

**Features:**
- Detects: gender, skin tone, hair color, hair style, eye color, age range
- Aggregates features across multiple images (uses most common)
- Outputs feature dictionary for prompt building
- Sends webhook at 40% progress

**Inputs:**
- `image` (IMAGE): Background-removed images
- `model` (STRING, optional): CLIP model to use
- `mode` (STRING, optional): Analysis mode (best/fast/classic)

**Outputs:**
- `TEXT`: Text description of features
- `FEATURES`: Dictionary of detected features

**Production Note:** Current implementation is simplified. For production, integrate with:
- CLIP Interrogator library
- DeepFace for facial attributes
- Custom trained models

---

### 4. PromptBuilder
**File:** `prompt_builder.py`  
**Task:** 6.4 - Build custom Prompt Builder node

**Purpose:** Combines detected features with DanDan style template

**Features:**
- Uses DanDan photography style template
- Inserts detected features into template
- Includes professional photography keywords
- Supports custom templates and additional keywords

**Template:**
```
A professional headshot portrait of a {gender} with {skin_tone} skin, 
{hair_color} hair, {age_range} years old, in dandan style. 
Cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8, 
muted tones (brown, gray, green, blue), soft directional lighting, 
professional serious expression, looking directly at camera, 
body angled 45 degrees, face toward camera, photorealistic skin textures, 
sharp eyes, natural hair color, subtle shadows, contemplative mood
```

**Inputs:**
- `features` (DICT): Detected features from CLIPInterrogator
- `template` (STRING, optional): Custom template
- `use_custom_template` (BOOLEAN, optional): Use custom template
- `additional_keywords` (STRING, optional): Additional style keywords

**Outputs:**
- `PROMPT`: Final prompt string

---

### 5. SeedreamNode
**File:** `seedream_node.py`  
**Task:** 6.5 - Configure Seedream 4.0 node

**Purpose:** Generates professional headshots using Seedream 4.0

**Features:**
- Uses multiple reference images for face consistency
- Generates 4 high-resolution variations
- Supports Replicate API integration
- Sends webhook at 50-70% progress

**Inputs:**
- `image_input` (IMAGE): Background-removed reference images
- `prompt` (STRING): Generated prompt from PromptBuilder
- `model` (STRING, optional): Seedream model version
- `size` (STRING, optional): Output size preset (2K/4K/1K)
- `width` (INT, optional): Output width (default: 1728)
- `height` (INT, optional): Output height (default: 2304)
- `aspect_ratio` (STRING, optional): Output aspect ratio (default: 3:4)
- `max_images` (INT, optional): Number of variations (default: 4)
- `prompt_strength` (FLOAT, optional): Prompt strength (default: 0.85)
- `seed` (INT, optional): Random seed

**Outputs:**
- `IMAGE`: Batch of generated headshots

**Production Setup:**
```bash
# Install Replicate SDK
pip install replicate

# Set API token
export REPLICATE_API_TOKEN=your_token_here
```

---

### 6. LoRA Refinement Configuration
**File:** `lora_refinement_node.py`  
**Task:** 6.6 - Configure optional LoRA refinement node

**Purpose:** Optional DanDan style enhancement via LoRA

**Features:**
- Only activates if styleIntensity > 0.5
- Applies DanDan-Actor LoRA at low strength (0.3-0.4)
- Uses img2img with low denoise (0.4) to preserve face
- Sends webhook at 80% progress

**Configuration:**
- LoRA model: `dandan-actor.safetensors`
- Model strength: 0.35
- CLIP strength: 0.35
- Denoise: 0.4
- Steps: 15
- CFG Scale: 3.5
- Sampler: euler_ancestral

**Workflow Nodes:**
- LoRALoader (id: 6)
- VAEEncode (id: 7)
- KSampler (id: 8)
- VAEDecode (id: 9)
- CLIPTextEncode positive (id: 10)
- CLIPTextEncode negative (id: 11)

**Activation:**
All LoRA nodes have `mode: 4` (disabled) by default. They activate dynamically when `styleIntensity > 0.5`.

---

### 7. SaveImageWebhook
**File:** `save_image_webhook.py`  
**Task:** 6.7 - Configure Save Images node

**Purpose:** Converts images to base64 and sends completion webhook

**Features:**
- Converts images to base64 strings
- Sends webhook with images at 100% progress
- Supports PNG, JPEG, WEBP formats
- Retry logic with exponential backoff

**Inputs:**
- `images` (IMAGE): Generated headshots
- `webhook_url` (STRING): Webhook endpoint URL
- `job_id` (STRING): Job identifier
- `format` (STRING, optional): Output format (base64/url/both)
- `image_format` (STRING, optional): Image file format (PNG/JPEG/WEBP)
- `jpeg_quality` (INT, optional): JPEG quality (default: 90)
- `send_webhook` (BOOLEAN, optional): Whether to send webhook

**Outputs:**
- `RESULT`: JSON string with results

**Webhook Payload:**
```json
{
  "job_id": "uuid",
  "status": "completed",
  "progress": 100,
  "message": "Complete!",
  "images": ["base64_1", "base64_2", "base64_3", "base64_4"],
  "metadata": {
    "num_images": 4,
    "format": "PNG",
    "sizes": [[1728, 2304], ...]
  }
}
```

---

### 8. ImageSelector
**File:** `save_image_webhook.py`  
**Purpose:** Selects between Seedream output and LoRA-refined output

**Features:**
- Routes images based on whether LoRA refinement was applied
- Supports multiple selection modes

**Inputs:**
- `images_seedream` (IMAGE): Images from Seedream
- `images_refined` (IMAGE, optional): Images from LoRA refinement
- `mode` (STRING, optional): Selection mode

**Outputs:**
- `IMAGE`: Selected images

---

### 9. WebhookProgress
**File:** `webhook_progress.py`  
**Purpose:** Tracks and sends progress updates throughout workflow

**Features:**
- Initializes progress tracking
- Provides utility functions for sending progress updates
- Defines progress stages

**Progress Stages:**
- 10%: Loading reference images
- 20%: Removing backgrounds
- 40%: Analyzing facial features
- 50%: Generating professional headshots
- 80%: Refining photography style (optional)
- 100%: Complete

---

## Installation

1. Copy this entire `custom_nodes` directory to your ComfyUI installation:
```bash
cp -r custom_nodes /path/to/ComfyUI/custom_nodes/headshot_generation
```

2. Install required dependencies:
```bash
pip install torch numpy pillow requests replicate
```

3. Install RMBG node separately (see RMBG Configuration section)

4. Download DanDan-Actor LoRA model:
```bash
# Place in: ComfyUI/models/loras/dandan-actor.safetensors
```

5. Restart ComfyUI

---

## Usage in Workflow

The nodes are designed to work together in sequence:

```
LoadImageBatch → RMBG → CLIPInterrogator → PromptBuilder → SeedreamNode
                                                                ↓
                                                          ImageSelector
                                                                ↓
                                                        SaveImageWebhook
```

Optional LoRA refinement path:
```
SeedreamNode → VAEEncode → KSampler → VAEDecode → ImageSelector
                    ↑           ↑
                LoRALoader  CLIPTextEncode
```

---

## Testing

Test individual nodes:
```python
# Test LoadImageBatch
node = LoadImageBatch()
images, count = node.load_images(
    image_urls="https://example.com/img1.jpg\nhttps://example.com/img2.jpg"
)

# Test PromptBuilder
node = PromptBuilder()
prompt = node.build_prompt(
    features={
        'gender': 'person',
        'skin_tone': 'medium',
        'hair_color': 'brown',
        'age_range': '30-40'
    }
)
```

---

## Requirements Mapping

- **Requirement 1.1, 1.3**: LoadImageBatch
- **Requirement 1.2, 1.3**: RMBG Configuration
- **Requirement 2.1, 2.2, 2.3**: CLIPInterrogator
- **Requirement 2.3, 2.4, 2.5**: PromptBuilder
- **Requirement 4.1, 4.2, 4.3, 4.4, 4.5**: SeedreamNode
- **Requirement 4.6**: LoRA Refinement Configuration
- **Requirement 4.7, 5.4**: SaveImageWebhook

---

## Production Considerations

1. **CLIP Interrogator**: Replace simplified implementation with proper CLIP Interrogator library or face analysis API

2. **Seedream Integration**: Set up Replicate API token or deploy local Seedream instance

3. **Error Handling**: Add comprehensive error handling and logging

4. **Performance**: Optimize image processing and webhook delivery

5. **Security**: Validate webhook signatures, sanitize inputs

6. **Monitoring**: Track node execution times, success rates, errors

---

## Support

For issues or questions about these custom nodes, refer to:
- Main README: `runpod-comfyui-headshots/README.md`
- Implementation Summary: `runpod-comfyui-headshots/IMPLEMENTATION_SUMMARY.md`
- Workflow Guide: `runpod-comfyui-headshots/WORKFLOW_GUIDE.md`
