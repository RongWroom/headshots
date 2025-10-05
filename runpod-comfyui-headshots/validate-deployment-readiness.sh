#!/bin/bash

# Deployment Readiness Validation Script
# This script checks if all prerequisites are met before deploying to RunPod

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=== RunPod Deployment Readiness Check ===${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a file exists
file_exists() {
    [ -f "$1" ]
}

# Check 1: Docker
echo -e "${BLUE}[1/10] Checking Docker...${NC}"
if command_exists docker; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✓ Docker installed: ${DOCKER_VERSION}${NC}"
    
    # Check if Docker is running
    if docker info >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Docker daemon is running${NC}"
    else
        echo -e "${RED}✗ Docker daemon is not running${NC}"
        echo "  Start Docker and try again"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo "  Install Docker from https://www.docker.com/get-started"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 2: Docker login
echo -e "${BLUE}[2/10] Checking Docker registry login...${NC}"
if docker info 2>/dev/null | grep -q "Username:"; then
    USERNAME=$(docker info 2>/dev/null | grep "Username:" | awk '{print $2}')
    echo -e "${GREEN}✓ Logged in to Docker registry as: ${USERNAME}${NC}"
else
    echo -e "${YELLOW}⚠ Not logged in to Docker registry${NC}"
    echo "  Run: docker login"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 3: Required files
echo -e "${BLUE}[3/10] Checking required files...${NC}"
REQUIRED_FILES=(
    "Dockerfile"
    "handler.py"
    "workflow.json"
    "requirements.txt"
    "build-and-deploy.sh"
    "deploy-to-runpod.sh"
    "test-endpoint.sh"
)

for file in "${REQUIRED_FILES[@]}"; do
    if file_exists "$file"; then
        echo -e "${GREEN}✓ ${file}${NC}"
    else
        echo -e "${RED}✗ ${file} not found${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

# Check 4: Script permissions
echo -e "${BLUE}[4/10] Checking script permissions...${NC}"
SCRIPTS=(
    "build-and-deploy.sh"
    "deploy-to-runpod.sh"
    "test-endpoint.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -x "$script" ]; then
        echo -e "${GREEN}✓ ${script} is executable${NC}"
    else
        echo -e "${YELLOW}⚠ ${script} is not executable${NC}"
        echo "  Run: chmod +x ${script}"
        WARNINGS=$((WARNINGS + 1))
    fi
done
echo ""

# Check 5: curl
echo -e "${BLUE}[5/10] Checking curl...${NC}"
if command_exists curl; then
    CURL_VERSION=$(curl --version | head -n1)
    echo -e "${GREEN}✓ curl installed: ${CURL_VERSION}${NC}"
else
    echo -e "${RED}✗ curl is not installed${NC}"
    echo "  Install curl for API testing"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 6: jq (optional but recommended)
echo -e "${BLUE}[6/10] Checking jq...${NC}"
if command_exists jq; then
    JQ_VERSION=$(jq --version)
    echo -e "${GREEN}✓ jq installed: ${JQ_VERSION}${NC}"
else
    echo -e "${YELLOW}⚠ jq is not installed (optional)${NC}"
    echo "  Install jq for better JSON handling: brew install jq"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 7: openssl
echo -e "${BLUE}[7/10] Checking openssl...${NC}"
if command_exists openssl; then
    OPENSSL_VERSION=$(openssl version)
    echo -e "${GREEN}✓ openssl installed: ${OPENSSL_VERSION}${NC}"
else
    echo -e "${YELLOW}⚠ openssl is not installed${NC}"
    echo "  Install openssl for generating webhook secrets"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check 8: Dockerfile validation
echo -e "${BLUE}[8/10] Validating Dockerfile...${NC}"
if file_exists "Dockerfile"; then
    if grep -q "FROM runpod/comfyui:latest" Dockerfile; then
        echo -e "${GREEN}✓ Base image specified correctly${NC}"
    else
        echo -e "${YELLOW}⚠ Base image may not be correct${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    if grep -q "COPY handler.py" Dockerfile; then
        echo -e "${GREEN}✓ Handler script copied${NC}"
    else
        echo -e "${RED}✗ Handler script not copied in Dockerfile${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "COPY workflow.json" Dockerfile; then
        echo -e "${GREEN}✓ Workflow copied${NC}"
    else
        echo -e "${YELLOW}⚠ Workflow not copied in Dockerfile${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}✗ Dockerfile not found${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 9: handler.py validation
echo -e "${BLUE}[9/10] Validating handler.py...${NC}"
if file_exists "handler.py"; then
    if grep -q "def handler(event):" handler.py; then
        echo -e "${GREEN}✓ Handler function defined${NC}"
    else
        echo -e "${RED}✗ Handler function not found${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "runpod.serverless.start" handler.py; then
        echo -e "${GREEN}✓ RunPod serverless initialization found${NC}"
    else
        echo -e "${RED}✗ RunPod serverless initialization missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗ handler.py not found${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check 10: Documentation
echo -e "${BLUE}[10/10] Checking documentation...${NC}"
DOCS=(
    "README.md"
    "DEPLOYMENT_GUIDE.md"
    "DEPLOYMENT_CHECKLIST.md"
    "QUICKSTART.md"
)

for doc in "${DOCS[@]}"; do
    if file_exists "$doc"; then
        echo -e "${GREEN}✓ ${doc}${NC}"
    else
        echo -e "${YELLOW}⚠ ${doc} not found${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
done
echo ""

# Summary
echo -e "${GREEN}=== Validation Summary ===${NC}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready to deploy.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review DEPLOYMENT_CHECKLIST.md"
    echo "2. Run: ./build-and-deploy.sh --push --registry YOUR_USERNAME --lora-url YOUR_URL"
    echo "3. Create endpoint in RunPod dashboard"
    echo "4. Test with: ./test-endpoint.sh --endpoint-id ID --api-key KEY"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ ${WARNINGS} warning(s) found${NC}"
    echo ""
    echo "You can proceed with deployment, but consider addressing the warnings."
    echo ""
    echo "Next steps:"
    echo "1. Review warnings above"
    echo "2. Review DEPLOYMENT_CHECKLIST.md"
    echo "3. Run: ./build-and-deploy.sh --push --registry YOUR_USERNAME --lora-url YOUR_URL"
    exit 0
else
    echo -e "${RED}✗ ${ERRORS} error(s) and ${WARNINGS} warning(s) found${NC}"
    echo ""
    echo "Please fix the errors above before deploying."
    echo ""
    echo "Common fixes:"
    echo "- Install missing tools (Docker, curl, etc.)"
    echo "- Start Docker daemon"
    echo "- Login to Docker registry: docker login"
    echo "- Make scripts executable: chmod +x *.sh"
    exit 1
fi

