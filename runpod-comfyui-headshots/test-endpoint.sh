#!/bin/bash

# Test RunPod Endpoint Script
# This script tests the deployed ComfyUI headshot generator endpoint

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=== RunPod Endpoint Test Script ===${NC}"
echo ""

# Configuration
RUNPOD_ENDPOINT_ID=""
RUNPOD_API_KEY=""
TEST_IMAGE_URLS=(
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400"
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400"
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400"
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400"
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400"
)

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --endpoint-id)
            RUNPOD_ENDPOINT_ID="$2"
            shift 2
            ;;
        --api-key)
            RUNPOD_API_KEY="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --endpoint-id ID    RunPod endpoint ID (required)"
            echo "  --api-key KEY       RunPod API key (required)"
            echo "  --help              Show this help message"
            echo ""
            echo "Example:"
            echo "  $0 --endpoint-id abc123xyz --api-key your-api-key"
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
if [ -z "$RUNPOD_ENDPOINT_ID" ]; then
    echo -e "${RED}Error: --endpoint-id is required${NC}"
    exit 1
fi

if [ -z "$RUNPOD_API_KEY" ]; then
    echo -e "${RED}Error: --api-key is required${NC}"
    exit 1
fi

RUNPOD_URL="https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}"

echo -e "${BLUE}Testing endpoint: ${RUNPOD_ENDPOINT_ID}${NC}"
echo ""

# Test 1: Health check
echo -e "${YELLOW}Test 1: Health Check${NC}"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${RUNPOD_URL}/health" \
    -H "Authorization: Bearer ${RUNPOD_API_KEY}")

HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "Response: ${RESPONSE_BODY}"
else
    echo -e "${YELLOW}⚠ Health check returned ${HTTP_CODE}${NC}"
    echo "This is normal if the endpoint is cold-starting"
fi
echo ""

# Test 2: Submit generation job
echo -e "${YELLOW}Test 2: Submit Generation Job${NC}"

# Build JSON payload
IMAGE_URLS_JSON=$(printf '%s\n' "${TEST_IMAGE_URLS[@]}" | jq -R . | jq -s .)

PAYLOAD=$(cat <<EOF
{
  "input": {
    "reference_images": ${IMAGE_URLS_JSON},
    "num_outputs": 4,
    "style_intensity": 0.8,
    "webhook_url": "https://webhook.site/unique-id",
    "job_id": "test-$(date +%s)"
  }
}
EOF
)

echo "Submitting job..."
echo ""

RUN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${RUNPOD_URL}/run" \
    -H "Authorization: Bearer ${RUNPOD_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "${PAYLOAD}")

HTTP_CODE=$(echo "$RUN_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RUN_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Job submitted successfully${NC}"
    echo ""
    
    # Extract request ID
    REQUEST_ID=$(echo "$RESPONSE_BODY" | jq -r '.id // empty')
    
    if [ -n "$REQUEST_ID" ]; then
        echo "Request ID: ${REQUEST_ID}"
        echo "Status: $(echo "$RESPONSE_BODY" | jq -r '.status // "unknown"')"
        echo ""
        
        # Test 3: Poll for status
        echo -e "${YELLOW}Test 3: Poll Job Status${NC}"
        echo "Polling for status (this may take 1-2 minutes for cold start)..."
        echo ""
        
        MAX_POLLS=60
        POLL_COUNT=0
        
        while [ $POLL_COUNT -lt $MAX_POLLS ]; do
            sleep 5
            POLL_COUNT=$((POLL_COUNT + 1))
            
            STATUS_RESPONSE=$(curl -s "${RUNPOD_URL}/status/${REQUEST_ID}" \
                -H "Authorization: Bearer ${RUNPOD_API_KEY}")
            
            STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // "unknown"')
            
            echo "Poll ${POLL_COUNT}/${MAX_POLLS}: Status = ${STATUS}"
            
            if [ "$STATUS" = "COMPLETED" ]; then
                echo ""
                echo -e "${GREEN}✓ Job completed successfully!${NC}"
                echo ""
                echo "Full response:"
                echo "$STATUS_RESPONSE" | jq '.'
                break
            elif [ "$STATUS" = "FAILED" ]; then
                echo ""
                echo -e "${RED}✗ Job failed${NC}"
                echo ""
                echo "Error details:"
                echo "$STATUS_RESPONSE" | jq '.error // "No error details"'
                exit 1
            elif [ "$STATUS" = "IN_PROGRESS" ]; then
                # Continue polling
                continue
            elif [ "$STATUS" = "IN_QUEUE" ]; then
                # Continue polling
                continue
            else
                echo "Unknown status: ${STATUS}"
            fi
        done
        
        if [ $POLL_COUNT -eq $MAX_POLLS ]; then
            echo ""
            echo -e "${YELLOW}⚠ Polling timeout reached${NC}"
            echo "Job may still be processing. Check RunPod dashboard for details."
        fi
    else
        echo -e "${YELLOW}⚠ Could not extract request ID from response${NC}"
        echo "Response: ${RESPONSE_BODY}"
    fi
else
    echo -e "${RED}✗ Job submission failed (HTTP ${HTTP_CODE})${NC}"
    echo ""
    echo "Response: ${RESPONSE_BODY}"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Test Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Review the test results above"
echo "2. Check RunPod dashboard for detailed logs"
echo "3. If successful, integrate with your application"
echo "4. Monitor costs and performance"
echo ""

