# RunPod FLUX Dev Headshot Generation Plan

## 🎯 Goal
User uploads photos → AI generates professional headshots → User gets custom headshots

## 🏗️ Architecture Overview

```
Your Website (Next.js)
    ↓
RunPod Training Endpoint (FLUX Dev LoRA)
    ↓
RunPod Generation Endpoint (FLUX Dev + LoRA)
    ↓
Generated Headshots Back to User
```

## 📋 Complete Implementation Plan

### Phase 1: RunPod Training Setup

#### 1.1 Create Training Docker Container
```dockerfile
# Dockerfile.training
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Install FLUX Dev training dependencies
RUN pip install diffusers transformers accelerate peft datasets pillow requests

# Copy training script
COPY train_flux_lora.py /app/
COPY handler_training.py /app/

WORKDIR /app
CMD python -u handler_training.py
```

#### 1.2 Training Handler Script
```python
# handler_training.py
import runpod
import requests
from train_flux_lora import train_lora_model

def handler(event):
    try:
        input_data = event["input"]
        
        # Download images from URLs
        image_urls = input_data["image_urls"]
        images = []
        for url in image_urls:
            response = requests.get(url)
            images.append(response.content)
        
        # Train LoRA model
        model_path = train_lora_model(
            images=images,
            trigger_word=input_data["trigger_word"],
            style_prompt=input_data.get("style_prompt", "professional headshot"),
            training_steps=input_data.get("training_steps", 1000)
        )
        
        # Upload trained model to cloud storage
        model_url = upload_to_storage(model_path)
        
        return {
            "status": "success",
            "model_url": model_url,
            "trigger_word": input_data["trigger_word"],
            "training_completed": True
        }
        
    except Exception as e:
        return {"error": str(e)}

runpod.serverless.start({"handler": handler})
```

#### 1.3 FLUX Dev LoRA Training Script
```python
# train_flux_lora.py
from diffusers import FluxPipeline
from peft import LoraConfig, get_peft_model
import torch
from PIL import Image
import io

def train_lora_model(images, trigger_word, style_prompt, training_steps=1000):
    # Load FLUX Dev model
    pipe = FluxPipeline.from_pretrained(
        "black-forest-labs/FLUX.1-dev",
        torch_dtype=torch.bfloat16
    )
    
    # Configure LoRA
    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["to_k", "to_q", "to_v", "to_out.0"],
        lora_dropout=0.1,
    )
    
    # Convert images to PIL
    pil_images = []
    for img_bytes in images:
        pil_images.append(Image.open(io.BytesIO(img_bytes)))
    
    # Create training prompts
    prompts = [f"{style_prompt} of {trigger_word}" for _ in pil_images]
    
    # Train LoRA (simplified - you'd use a proper training loop)
    # This is where the actual LoRA training happens
    trained_model = train_lora_on_images(pipe, pil_images, prompts, training_steps)
    
    # Save model
    model_path = f"/tmp/{trigger_word}_lora.safetensors"
    trained_model.save_pretrained(model_path)
    
    return model_path

def train_lora_on_images(pipe, images, prompts, steps):
    # Actual LoRA training implementation
    # This would be the core training loop
    pass
```

### Phase 2: RunPod Generation Setup

#### 2.1 Create Generation Docker Container
```dockerfile
# Dockerfile.generation
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Install FLUX Dev generation dependencies
RUN pip install diffusers transformers accelerate peft pillow requests

# Copy generation script
COPY generate_headshots.py /app/
COPY handler_generation.py /app/

WORKDIR /app
CMD python -u handler_generation.py
```

#### 2.2 Generation Handler Script
```python
# handler_generation.py
import runpod
import requests
from generate_headshots import generate_with_lora

def handler(event):
    try:
        input_data = event["input"]
        
        # Download trained LoRA model
        model_url = input_data["model_url"]
        lora_path = download_model(model_url)
        
        # Generate headshots
        images = generate_with_lora(
            lora_path=lora_path,
            prompt=input_data["prompt"],
            trigger_word=input_data["trigger_word"],
            num_images=input_data.get("num_images", 4),
            style=input_data.get("style", "professional")
        )
        
        # Upload generated images
        image_urls = upload_images_to_storage(images)
        
        return {
            "status": "success",
            "images": image_urls,
            "count": len(image_urls)
        }
        
    except Exception as e:
        return {"error": str(e)}

runpod.serverless.start({"handler": handler})
```

#### 2.3 FLUX Dev Generation Script
```python
# generate_headshots.py
from diffusers import FluxPipeline
from peft import PeftModel
import torch

def generate_with_lora(lora_path, prompt, trigger_word, num_images=4, style="professional"):
    # Load base FLUX Dev model
    pipe = FluxPipeline.from_pretrained(
        "black-forest-labs/FLUX.1-dev",
        torch_dtype=torch.bfloat16
    )
    
    # Load trained LoRA
    pipe.unet = PeftModel.from_pretrained(pipe.unet, lora_path)
    
    # Style prompts
    style_prompts = {
        "professional": "professional corporate headshot, clean background, business attire",
        "actor": "professional actor headshot, dramatic lighting, cinematic",
        "casual": "casual portrait, natural lighting, friendly expression"
    }
    
    # Generate images
    full_prompt = f"{style_prompts[style]} of {trigger_word}, {prompt}"
    
    images = []
    for i in range(num_images):
        image = pipe(
            prompt=full_prompt,
            num_inference_steps=28,
            guidance_scale=3.5,
            width=1024,
            height=1024
        ).images[0]
        images.append(image)
    
    return images
```

### Phase 3: Update Your Website API

#### 3.1 New Training API Route
```typescript
// app/api/runpod/train/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { imageUrls, modelName, packSlug } = await req.json();
        
        // Style configuration
        const styleConfig = {
            "actor-headshots": "professional actor headshot, dramatic lighting, cinematic",
            "corporate-headshots": "professional corporate headshot, clean background, business attire"
        }[packSlug] || "professional headshot";
        
        // Send to RunPod training endpoint
        const response = await fetch(process.env.RUNPOD_TRAINING_ENDPOINT!, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: {
                    image_urls: imageUrls,
                    trigger_word: `sks${modelName}`,
                    style_prompt: styleConfig,
                    training_steps: 1000
                }
            })
        });
        
        const result = await response.json();
        
        return NextResponse.json({
            success: true,
            trainingId: result.id,
            status: 'training_started'
        });
        
    } catch (error) {
        return NextResponse.json(
            { error: 'Training failed', details: error.message },
            { status: 500 }
        );
    }
}
```

#### 3.2 New Generation API Route
```typescript
// app/api/runpod/generate/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { modelUrl, triggerWord, style, prompt, numImages } = await req.json();
        
        // Send to RunPod generation endpoint
        const response = await fetch(process.env.RUNPOD_GENERATION_ENDPOINT!, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: {
                    model_url: modelUrl,
                    trigger_word: triggerWord,
                    prompt: prompt || "high quality portrait",
                    style: style || "professional",
                    num_images: numImages || 4
                }
            })
        });
        
        const result = await response.json();
        
        return NextResponse.json({
            success: true,
            images: result.images,
            count: result.count
        });
        
    } catch (error) {
        return NextResponse.json(
            { error: 'Generation failed', details: error.message },
            { status: 500 }
        );
    }
}
```

## 🚀 Deployment Steps

### Step 1: Build and Deploy Training Endpoint
```bash
# Build training container
docker build -f Dockerfile.training -t your-username/flux-training .

# Push to Docker Hub
docker push your-username/flux-training

# Create RunPod endpoint with this image
```

### Step 2: Build and Deploy Generation Endpoint
```bash
# Build generation container
docker build -f Dockerfile.generation -t your-username/flux-generation .

# Push to Docker Hub
docker push your-username/flux-generation

# Create RunPod endpoint with this image
```

### Step 3: Update Environment Variables
```bash
# .env.local
RUNPOD_API_KEY=your_runpod_api_key
RUNPOD_TRAINING_ENDPOINT=https://api.runpod.ai/v2/your-training-endpoint/runsync
RUNPOD_GENERATION_ENDPOINT=https://api.runpod.ai/v2/your-generation-endpoint/runsync
```

## 💰 Cost Estimate
- **Training**: ~$2-4 per model (20-30 minutes on A100)
- **Generation**: ~$0.10-0.20 per batch of 4 images
- **Total per user**: ~$2-5

## 🎯 User Flow
1. User uploads 10-20 photos
2. Your site calls `/api/runpod/train` → RunPod trains model (20-30 min)
3. User requests headshots → Your site calls `/api/runpod/generate` → RunPod generates images (30-60 sec)
4. User gets their custom AI headshots

This plan uses FLUX Dev (the best model for this) and gives you complete control over the training and generation process!

Would you like me to start implementing any of these components?