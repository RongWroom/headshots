#!/bin/bash

# Build and Deploy Script for ComfyUI Headshot Generation on RunPod
# This script builds the Docker image and optionally pushes it to a registry

set -e  # Exit on error

# Configuration
IMAGE_NAME="comfyui-headshot-generator"
IMAGE_TAG="latest"
REGISTRY=""  # Set to your Docker registry (e.g., "username" for Docker Hub)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== ComfyUI Headshot Generator - Build Script ===${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Parse command line arguments
BUILD_ONLY=false
PUSH=false
DANDAN_LORA_URL=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --registry)
            REGISTRY="$2"
            shift 2
            ;;
        --lora-url)
            DANDAN_LORA_URL="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --build-only       Only build the image, don't push"
            echo "  --push             Push the image to registry after building"
            echo "  --registry NAME    Docker registry to push to (e.g., 'username' for Docker Hub)"
            echo "  --lora-url URL     URL to download DanDan LoRA model"
            echo "  --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --build-only"
            echo "  $0 --push --registry myusername"
            echo "  $0 --push --registry myusername --lora-url https://example.com/lora.safetensors"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Construct full image name
if [ -n "$REGISTRY" ]; then
    FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
else
    FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
fi

echo -e "${YELLOW}Building Docker image: ${FULL_IMAGE_NAME}${NC}"
echo ""

# Build arguments
BUILD_ARGS=""
if [ -n "$DANDAN_LORA_URL" ]; then
    echo -e "${YELLOW}Including DanDan LoRA from: ${DANDAN_LORA_URL}${NC}"
    BUILD_ARGS="--build-arg DANDAN_LORA_URL=${DANDAN_LORA_URL}"
fi

# Build the Docker image
echo -e "${GREEN}Step 1: Building Docker image...${NC}"
docker build ${BUILD_ARGS} -t ${FULL_IMAGE_NAME} .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Docker image built successfully${NC}"
    echo ""
else
    echo -e "${RED}✗ Docker build failed${NC}"
    exit 1
fi

# Show image size
IMAGE_SIZE=$(docker images ${FULL_IMAGE_NAME} --format "{{.Size}}")
echo -e "${GREEN}Image size: ${IMAGE_SIZE}${NC}"
echo ""

# Push to registry if requested
if [ "$PUSH" = true ]; then
    if [ -z "$REGISTRY" ]; then
        echo -e "${RED}Error: --registry must be specified when using --push${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Step 2: Pushing image to registry...${NC}"
    docker push ${FULL_IMAGE_NAME}
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Image pushed successfully${NC}"
        echo ""
        echo -e "${GREEN}Image available at: ${FULL_IMAGE_NAME}${NC}"
    else
        echo -e "${RED}✗ Docker push failed${NC}"
        exit 1
    fi
fi

# Print next steps
echo ""
echo -e "${GREEN}=== Build Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Test the image locally:"
echo "   docker run -p 8188:8188 ${FULL_IMAGE_NAME}"
echo ""
echo "2. Deploy to RunPod:"
echo "   - Go to RunPod Serverless dashboard"
echo "   - Create new endpoint"
echo "   - Use image: ${FULL_IMAGE_NAME}"
echo "   - Configure GPU: NVIDIA A40"
echo "   - Set min_workers: 0, max_workers: 3"
echo "   - Set idle_timeout: 300"
echo ""
echo "3. Set environment variables in RunPod:"
echo "   - WEBHOOK_SECRET: your-secret-key"
if [ -z "$DANDAN_LORA_URL" ]; then
    echo "   - DANDAN_LORA_URL: https://your-lora-url.com/model.safetensors"
fi
echo ""
