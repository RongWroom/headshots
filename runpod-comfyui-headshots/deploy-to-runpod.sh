#!/bin/bash

# Deploy to RunPod Script
# This script automates the deployment of ComfyUI headshot generator to RunPod

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== RunPod Deployment Script ===${NC}"
echo ""

# Check if required tools are installed
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Error: Docker is not installed${NC}"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo -e "${RED}Error: curl is not installed${NC}"; exit 1; }

# Configuration
DOCKER_REGISTRY=""
RUNPOD_API_KEY=""
DANDAN_LORA_URL=""
WEBHOOK_SECRET=""
ENDPOINT_NAME="comfyui-headshot-generator"
IMAGE_NAME="comfyui-headshot-generator"
IMAGE_TAG="latest"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --registry)
            DOCKER_REGISTRY="$2"
            shift 2
            ;;
        --runpod-api-key)
            RUNPOD_API_KEY="$2"
            shift 2
            ;;
        --lora-url)
            DANDAN_LORA_URL="$2"
            shift 2
            ;;
        --webhook-secret)
            WEBHOOK_SECRET="$2"
            shift 2
            ;;
        --endpoint-name)
            ENDPOINT_NAME="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --registry NAME          Docker registry username (required)"
            echo "  --runpod-api-key KEY     RunPod API key (required)"
            echo "  --lora-url URL           DanDan LoRA model URL (required)"
            echo "  --webhook-secret SECRET  Webhook secret (optional, will generate if not provided)"
            echo "  --endpoint-name NAME     RunPod endpoint name (default: comfyui-headshot-generator)"
            echo "  --help                   Show this help message"
            echo ""
            echo "Example:"
            echo "  $0 --registry myusername --runpod-api-key abc123 --lora-url https://example.com/lora.safetensors"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$DOCKER_REGISTRY" ]; then
    echo -e "${RED}Error: --registry is required${NC}"
    exit 1
fi

if [ -z "$RUNPOD_API_KEY" ]; then
    echo -e "${RED}Error: --runpod-api-key is required${NC}"
    exit 1
fi

if [ -z "$DANDAN_LORA_URL" ]; then
    echo -e "${RED}Error: --lora-url is required${NC}"
    exit 1
fi

# Generate webhook secret if not provided
if [ -z "$WEBHOOK_SECRET" ]; then
    if command -v openssl >/dev/null 2>&1; then
        WEBHOOK_SECRET=$(openssl rand -hex 32)
        echo -e "${YELLOW}Generated webhook secret: ${WEBHOOK_SECRET}${NC}"
    else
        echo -e "${RED}Error: openssl not found and --webhook-secret not provided${NC}"
        exit 1
    fi
fi

FULL_IMAGE_NAME="${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

echo -e "${BLUE}Configuration:${NC}"
echo "  Docker Image: ${FULL_IMAGE_NAME}"
echo "  Endpoint Name: ${ENDPOINT_NAME}"
echo "  LoRA URL: ${DANDAN_LORA_URL}"
echo ""

# Step 1: Build Docker image
echo -e "${GREEN}Step 1: Building Docker image...${NC}"
./build-and-deploy.sh --push --registry "${DOCKER_REGISTRY}" --lora-url "${DANDAN_LORA_URL}"

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to build and push Docker image${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker image built and pushed successfully${NC}"
echo ""

# Step 2: Create RunPod endpoint via API
echo -e "${GREEN}Step 2: Creating RunPod endpoint...${NC}"

# Note: RunPod API for creating endpoints programmatically is limited
# This is a placeholder for the API call structure
# In practice, you may need to create the endpoint manually via the dashboard

echo -e "${YELLOW}Note: RunPod endpoint creation via API is limited.${NC}"
echo -e "${YELLOW}Please create the endpoint manually in the RunPod dashboard:${NC}"
echo ""
echo -e "${BLUE}1. Go to: https://www.runpod.io/console/serverless${NC}"
echo -e "${BLUE}2. Click 'New Endpoint'${NC}"
echo -e "${BLUE}3. Configure with these settings:${NC}"
echo ""
echo "   Name: ${ENDPOINT_NAME}"
echo "   Docker Image: ${FULL_IMAGE_NAME}"
echo "   GPU Type: NVIDIA A40"
echo "   Min Workers: 0"
echo "   Max Workers: 3"
echo "   Idle Timeout: 300 seconds"
echo "   Execution Timeout: 600 seconds"
echo "   Container Disk: 20 GB"
echo ""
echo -e "${BLUE}4. Set Environment Variables:${NC}"
echo ""
echo "   WEBHOOK_SECRET=${WEBHOOK_SECRET}"
echo "   DANDAN_LORA_URL=${DANDAN_LORA_URL}"
echo "   COMFYUI_PATH=/workspace/ComfyUI"
echo "   PYTHONPATH=/workspace/ComfyUI"
echo ""

# Save configuration to file
CONFIG_FILE="deployment-config.txt"
cat > "${CONFIG_FILE}" << EOF
RunPod Deployment Configuration
================================

Deployment Date: $(date)
Docker Image: ${FULL_IMAGE_NAME}
Endpoint Name: ${ENDPOINT_NAME}

Environment Variables:
----------------------
WEBHOOK_SECRET=${WEBHOOK_SECRET}
DANDAN_LORA_URL=${DANDAN_LORA_URL}
COMFYUI_PATH=/workspace/ComfyUI
PYTHONPATH=/workspace/ComfyUI

GPU Configuration:
------------------
GPU Type: NVIDIA A40
Min Workers: 0
Max Workers: 3
Idle Timeout: 300 seconds
Execution Timeout: 600 seconds
Container Disk: 20 GB

Next Steps:
-----------
1. Create endpoint in RunPod dashboard with above settings
2. Note the Endpoint ID from the dashboard
3. Test the endpoint with the test script
4. Update your application's .env file with:
   RUNPOD_ENDPOINT_ID=<your-endpoint-id>
   RUNPOD_API_KEY=${RUNPOD_API_KEY}
   RUNPOD_WEBHOOK_SECRET=${WEBHOOK_SECRET}

EOF

echo -e "${GREEN}✓ Configuration saved to ${CONFIG_FILE}${NC}"
echo ""

# Step 3: Provide test command
echo -e "${GREEN}Step 3: Test your endpoint${NC}"
echo ""
echo "After creating the endpoint, test it with:"
echo ""
echo -e "${BLUE}curl -X POST https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/run \\${NC}"
echo -e "${BLUE}  -H \"Authorization: Bearer ${RUNPOD_API_KEY}\" \\${NC}"
echo -e "${BLUE}  -H \"Content-Type: application/json\" \\${NC}"
echo -e "${BLUE}  -d '{${NC}"
echo -e "${BLUE}    \"input\": {${NC}"
echo -e "${BLUE}      \"reference_images\": [${NC}"
echo -e "${BLUE}        \"https://example.com/photo1.jpg\",${NC}"
echo -e "${BLUE}        \"https://example.com/photo2.jpg\",${NC}"
echo -e "${BLUE}        \"https://example.com/photo3.jpg\",${NC}"
echo -e "${BLUE}        \"https://example.com/photo4.jpg\",${NC}"
echo -e "${BLUE}        \"https://example.com/photo5.jpg\"${NC}"
echo -e "${BLUE}      ],${NC}"
echo -e "${BLUE}      \"num_outputs\": 4,${NC}"
echo -e "${BLUE}      \"style_intensity\": 0.8,${NC}"
echo -e "${BLUE}      \"job_id\": \"test-123\"${NC}"
echo -e "${BLUE}    }${NC}"
echo -e "${BLUE}  }'${NC}"
echo ""

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo -e "${YELLOW}Important: Save the webhook secret securely!${NC}"
echo -e "${YELLOW}WEBHOOK_SECRET=${WEBHOOK_SECRET}${NC}"
echo ""

