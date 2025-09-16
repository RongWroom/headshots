#!/bin/bash

# High-end FLUX Dev training container build and deploy script

set -e

echo "🚀 Building high-end FLUX Dev training container..."

# Configuration
DOCKER_USERNAME="rongwroom"  # Replace with your Docker Hub username
IMAGE_NAME="flux-headshot-trainer"
TAG="latest"
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}:${TAG}"

# Build the Docker image
echo "🔨 Building Docker image: ${FULL_IMAGE_NAME}"
docker build --no-cache -t ${FULL_IMAGE_NAME} .

# Test the image locally (optional)
echo "🧪 Testing image locally..."
docker run --rm ${FULL_IMAGE_NAME} python -c "
import torch
import diffusers
import peft
print('✅ All dependencies loaded successfully')
print(f'PyTorch version: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
print(f'Diffusers version: {diffusers.__version__}')
print(f'PEFT version: {peft.__version__}')
"

# Push to Docker Hub
echo "📤 Pushing to Docker Hub..."
docker push ${FULL_IMAGE_NAME}

echo "✅ Build and push completed!"
echo ""
echo "📋 Next steps:"
echo "1. Go to RunPod console: https://www.runpod.io/console/serverless"
echo "2. Create new endpoint with image: ${FULL_IMAGE_NAME}"
echo "3. Configure with these settings:"
echo "   - GPU: A100 (recommended) or RTX 4090"
echo "   - Memory: 24GB+"
echo "   - Container Disk: 50GB+"
echo "   - Max Workers: 1-3"
echo "   - Idle Timeout: 5 seconds"
echo "   - Max Execution Time: 3600 seconds (1 hour)"
echo ""
echo "4. Update your .env.local with:"
echo "   RUNPOD_API_KEY=your_runpod_api_key"
echo "   RUNPOD_TRAINING_ENDPOINT=https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync"
echo ""
echo "🎯 Your high-end training endpoint will be ready!"