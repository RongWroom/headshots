# ComfyUI Headshot Generator - RunPod Docker Image

This Docker image provides a complete ComfyUI-based headshot generation system for deployment on RunPod serverless infrastructure.

## Features

- **Base Image**: `runpod/comfyui:latest` with pre-configured ComfyUI
- **Custom Nodes**:
  - RMBG (Background Removal) - Removes backgrounds from reference photos
  - CLIP Interrogator - Analyzes facial features for prompt generation
  - ComfyUI Inspire Pack - Additional utilities for image processing
  - ComfyUI Essentials - Core utilities
- **DanDan LoRA**: Pre-loaded photography style LoRA model
- **Workflow**: Professional headshot generation pipeline

## Directory Structure

```
runpod-comfyui-headshots/
├── Dockerfile              # Docker image definition
├── handler.py              # RunPod serverless handler
├── workflow.json           # ComfyUI workflow definition
├── requirements.txt        # Python dependencies
├── build-and-deploy.sh     # Build and deployment script
└── README.md              # This file
```

## Building the Image

### Prerequisites

- Docker installed and running
- Docker Hub account (for pushing to registry)
- DanDan LoRA model URL (optional, can be set via environment variable)

### Build Commands

**Build only (for local testing):**
```bash
./build-and-deploy.sh --build-only
```

**Build and push to Docker Hub:**
```bash
./build-and-deploy.sh --push --registry your-dockerhub-username
```

**Build with DanDan LoRA included:**
```bash
./build-and-deploy.sh --build-only --lora-url https://your-storage.com/dandan-lora.safetensors
```

### Manual Build

```bash
docker build -t comfyui-headshot-generator:latest .

# With LoRA URL
docker build --build-arg DANDAN_LORA_URL=https://your-url.com/lora.safetensors \
  -t comfyui-headshot-generator:latest .
```

## Testing Locally

Run the container locally to test:

```bash
docker run -p 8188:8188 comfyui-headshot-generator:latest
```

Access ComfyUI interface at: http://localhost:8188

## Deploying to RunPod

### 1. Push Image to Registry

```bash
docker tag comfyui-headshot-generator:latest your-username/comfyui-headshot-generator:latest
docker push your-username/comfyui-headshot-generator:latest
```

### 2. Create RunPod Endpoint

1. Go to [RunPod Serverless Dashboard](https://www.runpod.io/console/serverless)
2. Click "New Endpoint"
3. Configure:
   - **Name**: `comfyui-headshot-generator`
   - **Docker Image**: `your-username/comfyui-headshot-generator:latest`
   - **GPU Type**: NVIDIA A40 (recommended)
   - **Min Workers**: 0 (cost-effective)
   - **Max Workers**: 3 (adjust based on load)
   - **Idle Timeout**: 300 seconds
   - **Container Disk**: 20 GB

### 3. Set Environment Variables

In RunPod endpoint settings, add:

```
WEBHOOK_SECRET=your-secret-key-here
DANDAN_LORA_URL=https://your-storage.com/dandan-lora.safetensors
COMFYUI_PATH=/workspace/ComfyUI
```

### 4. Test the Endpoint

Use the RunPod API to test:

```bash
curl -X POST https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/run \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "reference_images": [
        "https://example.com/photo1.jpg",
        "https://example.com/photo2.jpg",
        "https://example.com/photo3.jpg",
        "https://example.com/photo4.jpg",
        "https://example.com/photo5.jpg"
      ],
      "num_outputs": 4,
      "style_intensity": 0.8,
      "webhook_url": "https://yourapp.com/api/headshots/webhook",
      "job_id": "test-job-123"
    }
  }'
```

## Handler API

### Input Format

```json
{
  "reference_images": ["url1", "url2", ...],  // 5-10 image URLs
  "num_outputs": 4,                           // Number of headshots to generate
  "style_intensity": 0.8,                     // 0-1, controls LoRA strength
  "webhook_url": "https://yourapp.com/webhook", // Optional webhook for progress
  "job_id": "unique-job-id"                   // Job identifier
}
```

### Output Format

**Success:**
```json
{
  "status": "success",
  "images": ["base64_image1", "base64_image2", ...],
  "metadata": {
    "num_images": 4,
    "num_reference_images": 5
  }
}
```

**Error:**
```json
{
  "status": "failed",
  "error": "Error message here"
}
```

### Webhook Progress Updates

The handler sends progress updates to the webhook URL:

```json
{
  "job_id": "unique-job-id",
  "status": "processing",
  "progress": 50,
  "message": "Generating professional headshots..."
}
```

Progress stages:
- 10%: Loading reference images
- 20%: Removing backgrounds
- 40%: Analyzing facial features
- 50%: Generating headshots
- 80%: Refining style
- 100%: Complete

## Custom Nodes Included

### 1. RMBG (Background Removal)
- Repository: https://github.com/Jcd1230/rembg-comfyui-node
- Purpose: Remove backgrounds from reference photos
- Models: RMBG-v1.4, BiRefNet

### 2. CLIP Interrogator (via Inspire Pack)
- Repository: https://github.com/ltdrdata/ComfyUI-Inspire-Pack
- Purpose: Analyze facial features and generate descriptions
- Detects: gender, skin tone, hair color, age, etc.

### 3. ComfyUI Essentials
- Repository: https://github.com/cubiq/ComfyUI_essentials
- Purpose: Core utilities for image processing

## Workflow Overview

The ComfyUI workflow executes these steps:

1. **Load Images**: Download reference photos from URLs
2. **RMBG**: Remove backgrounds from each photo
3. **CLIP Interrogator**: Analyze facial features
4. **Prompt Builder**: Generate DanDan-style prompt
5. **Seedream 4.0**: Generate professional headshots
6. **LoRA Refinement** (optional): Apply DanDan style
7. **Save Images**: Return generated headshots

## Cost Estimation

**Per Generation (4 images):**
- GPU Time: ~90 seconds on A40
- Cost: ~$0.02 per generation
- Storage: ~8MB (4 images × 2MB)

**Monthly Costs:**
- 100 generations: ~$2
- 1,000 generations: ~$20
- 10,000 generations: ~$200

## Troubleshooting

### Image Build Fails

**Issue**: Custom node installation fails
```bash
# Check logs
docker build --no-cache -t comfyui-headshot-generator:latest .
```

**Solution**: Ensure git and pip are working in the container

### Handler Timeout

**Issue**: Workflow takes too long
- Increase `idle_timeout` in RunPod settings
- Optimize workflow (reduce image sizes)
- Use faster GPU (A100 instead of A40)

### Out of Memory

**Issue**: GPU runs out of memory
- Reduce batch size
- Lower image resolution
- Use GPU with more VRAM

### LoRA Not Loading

**Issue**: DanDan LoRA not found
- Verify `DANDAN_LORA_URL` environment variable
- Check LoRA file is in `/workspace/models/loras/`
- Ensure LoRA file format is `.safetensors`

## Development

### Local Testing

1. Build the image:
```bash
./build-and-deploy.sh --build-only
```

2. Run with volume mounts for development:
```bash
docker run -it \
  -p 8188:8188 \
  -v $(pwd)/handler.py:/workspace/handler.py \
  -v $(pwd)/workflow.json:/workspace/workflows/headshot_generation.json \
  comfyui-headshot-generator:latest
```

3. Test the handler:
```bash
python test_handler.py
```

### Updating Custom Nodes

To update custom nodes, modify the Dockerfile:

```dockerfile
RUN cd /workspace/ComfyUI/custom_nodes/rembg-comfyui-node && \
    git pull && \
    pip install -r requirements.txt
```

Then rebuild the image.

## Support

For issues or questions:
- Check RunPod documentation: https://docs.runpod.io
- ComfyUI documentation: https://github.com/comfyanonymous/ComfyUI
- Open an issue in the project repository

## License

This Docker image configuration is part of the headshots application.
Individual components (ComfyUI, custom nodes) have their own licenses.
