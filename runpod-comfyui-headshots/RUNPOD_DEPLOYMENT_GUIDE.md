# RunPod Deployment Guide - Step by Step

**Goal:** Deploy the ComfyUI headshot generation system to RunPod and generate your first images.

**Time Required:** 30-45 minutes (mostly waiting for model downloads)

---

## Prerequisites

- ✅ RunPod account (you have this!)
- ✅ Credit card added to RunPod for GPU billing
- ✅ This codebase ready to deploy

---

## Step 1: Create a RunPod Serverless Endpoint

### 1.1 Go to RunPod Serverless
1. Log into [RunPod](https://www.runpod.io/)
2. Click **"Serverless"** in the left sidebar
3. Click **"+ New Endpoint"**

### 1.2 Choose Template
**Option A: Use Official ComfyUI Template (Recommended)**
1. Search for "ComfyUI" in templates
2. Select **"RunPod ComfyUI"** or **"ComfyUI Serverless"**
3. This comes with ComfyUI pre-installed

**Option B: Start from Scratch**
1. Select **"Start from Scratch"**
2. Choose base image: `runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel`

### 1.3 Configure Endpoint
```
Name: comfyui-headshots
Min Workers: 0 (scales to zero when not in use)
Max Workers: 3 (adjust based on expected traffic)
GPU Type: RTX 4090 or A40 (recommended for Seedream 4.0)
Idle Timeout: 5 seconds
```

### 1.4 Advanced Settings
```
Container Disk: 20 GB (for models)
Volume Disk: 50 GB (for persistent storage)
Environment Variables:
  - COMFYUI_PORT=8188
```

---

## Step 2: Prepare Your Deployment Package

### 2.1 Create Dockerfile
Create `runpod-comfyui-headshots/Dockerfile`:

```dockerfile
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install ComfyUI
WORKDIR /workspace
RUN git clone https://github.com/comfyanonymous/ComfyUI.git
WORKDIR /workspace/ComfyUI

# Install ComfyUI dependencies
RUN pip install -r requirements.txt

# Install additional dependencies for our custom nodes
RUN pip install \
    runpod \
    transformers \
    open_clip_torch \
    rembg \
    pillow \
    requests

# Copy our custom nodes
COPY custom_nodes /workspace/ComfyUI/custom_nodes/headshot_generation
COPY custom_nodes/__init__.py /workspace/ComfyUI/custom_nodes/headshot_generation/__init__.py

# Copy workflow and handler
COPY workflow.json /workspace/workflows/headshot_generation.json
COPY handler.py /workspace/handler.py

# Download models (this happens during build)
RUN mkdir -p /workspace/ComfyUI/models/checkpoints
RUN mkdir -p /workspace/ComfyUI/models/loras
RUN mkdir -p /workspace/ComfyUI/models/clip

# Set working directory
WORKDIR /workspace

# Expose ComfyUI port
EXPOSE 8188

# Start handler
CMD ["python", "handler.py"]
```

### 2.2 Create .dockerignore
```
.git
.gitignore
*.md
test_*.py
__pycache__
*.pyc
.DS_Store
```

---

## Step 3: Build and Push Docker Image

### 3.1 Build Docker Image
```bash
cd runpod-comfyui-headshots

# Build the image
docker build -t your-dockerhub-username/comfyui-headshots:latest .
```

### 3.2 Push to Docker Hub
```bash
# Login to Docker Hub
docker login

# Push the image
docker push your-dockerhub-username/comfyui-headshots:latest
```

**Alternative: Use RunPod's Container Registry**
RunPod also has its own container registry you can use.

---

## Step 4: Configure RunPod Endpoint

### 4.1 Set Docker Image
In your RunPod endpoint settings:
```
Docker Image: your-dockerhub-username/comfyui-headshots:latest
```

### 4.2 Set Environment Variables
```
COMFYUI_URL=http://127.0.0.1:8188
RUNPOD_WEBHOOK_URL=https://your-app.com/api/webhooks/headshots
```

### 4.3 Configure Handler
RunPod will automatically call your `handler.py` when requests come in.

---

## Step 5: Download Models (First Run)

Models will download automatically on first run, but you can pre-download them:

### 5.1 Connect to RunPod Pod
1. In RunPod, click **"My Pods"**
2. Start a GPU pod (RTX 4090 recommended)
3. Click **"Connect"** → **"Start Web Terminal"**

### 5.2 Download Models
```bash
cd /workspace/ComfyUI/models

# Download Seedream 4.0 (if available)
# Note: Seedream 4.0 may require special access
# Check https://huggingface.co/bytedance/seedream-4

# Download RMBG model
mkdir -p rembg
cd rembg
wget https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx

# Download CLIP model (auto-downloads on first use)
# This happens automatically via transformers library

# Download DanDan LoRA (if you have it)
cd /workspace/ComfyUI/models/loras
# Upload your dandan-actor.safetensors file here
```

---

## Step 6: Test Your Endpoint

### 6.1 Get Your Endpoint URL
In RunPod Serverless:
1. Click on your endpoint
2. Copy the **Endpoint URL**
3. Copy your **API Key**

### 6.2 Test with cURL
```bash
curl -X POST https://api.runpod.ai/v2/YOUR-ENDPOINT-ID/runsync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-API-KEY" \
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
      "webhook_url": "https://webhook.site/your-unique-url",
      "job_id": "test-123"
    }
  }'
```

### 6.3 Expected Response
```json
{
  "status": "success",
  "images": [
    "base64_encoded_image_1",
    "base64_encoded_image_2",
    "base64_encoded_image_3",
    "base64_encoded_image_4"
  ],
  "metadata": {
    "num_images": 4,
    "num_reference_images": 5
  }
}
```

---

## Step 7: Monitor and Debug

### 7.1 Check Logs
In RunPod:
1. Go to your endpoint
2. Click **"Logs"**
3. Watch for errors or model download progress

### 7.2 Common Issues

**Issue: "Model not found"**
```
Solution: Models need to be downloaded first
- Connect to a pod
- Download models manually
- Or wait for first run (auto-download)
```

**Issue: "Out of memory"**
```
Solution: Use a larger GPU
- Upgrade to RTX 4090 or A40
- Reduce batch size in workflow
```

**Issue: "Custom node not found"**
```
Solution: Verify custom nodes are copied
- Check Dockerfile COPY commands
- Rebuild Docker image
```

---

## Step 8: Connect to Your Frontend

### 8.1 Save Endpoint Details
```javascript
// In your frontend .env file
RUNPOD_ENDPOINT_ID=your-endpoint-id
RUNPOD_API_KEY=your-api-key
RUNPOD_ENDPOINT_URL=https://api.runpod.ai/v2/your-endpoint-id
```

### 8.2 Make API Calls
```javascript
async function generateHeadshots(imageUrls) {
  const response = await fetch(
    `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/runsync`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`
      },
      body: JSON.stringify({
        input: {
          reference_images: imageUrls,
          num_outputs: 4,
          style_intensity: 0.8,
          webhook_url: 'https://your-app.com/api/webhooks',
          job_id: generateJobId()
        }
      })
    }
  );
  
  return await response.json();
}
```

---

## Pricing Estimate

**GPU Costs (RunPod):**
- RTX 4090: ~$0.69/hour
- A40: ~$0.79/hour
- Average generation time: 2-3 minutes
- Cost per generation: ~$0.02-0.04

**With Serverless (scales to zero):**
- Only pay when generating
- No idle costs
- Perfect for variable traffic

---

## Quick Start Commands

```bash
# 1. Build Docker image
cd runpod-comfyui-headshots
docker build -t your-username/comfyui-headshots:latest .

# 2. Push to Docker Hub
docker push your-username/comfyui-headshots:latest

# 3. Create endpoint in RunPod UI
# (follow Step 1 above)

# 4. Test endpoint
curl -X POST https://api.runpod.ai/v2/YOUR-ENDPOINT-ID/runsync \
  -H "Authorization: Bearer YOUR-API-KEY" \
  -H "Content-Type: application/json" \
  -d @test_request.json
```

---

## Next Steps After Deployment

1. ✅ Test with sample images
2. ✅ Verify webhook delivery
3. ✅ Check image quality
4. ✅ Monitor costs
5. ✅ Connect to frontend
6. ⚠️ Add NSFW filtering (before production)
7. 📋 Set up monitoring/alerts
8. 📋 Configure auto-scaling

---

## Support

**RunPod Issues:**
- RunPod Discord: https://discord.gg/runpod
- RunPod Docs: https://docs.runpod.io/

**ComfyUI Issues:**
- ComfyUI GitHub: https://github.com/comfyanonymous/ComfyUI
- ComfyUI Discord: https://discord.gg/comfyui

**Our Custom Nodes:**
- Check logs in RunPod
- Review `custom_nodes/README.md`
- Run local tests first

---

## Troubleshooting Checklist

- [ ] Docker image built successfully
- [ ] Docker image pushed to registry
- [ ] RunPod endpoint created
- [ ] Environment variables set
- [ ] Models downloaded (or downloading)
- [ ] Custom nodes installed
- [ ] Handler.py configured
- [ ] Test request successful
- [ ] Webhook receiving updates
- [ ] Images generating correctly

---

**Ready to deploy? Let's do this! 🚀**
