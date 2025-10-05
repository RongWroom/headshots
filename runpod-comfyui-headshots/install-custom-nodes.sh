#!/bin/bash

# Installation script for custom ComfyUI nodes
# Run this script from the runpod-comfyui-headshots directory

set -e

echo "=========================================="
echo "Installing Custom ComfyUI Nodes"
echo "=========================================="
echo ""

# Check if ComfyUI path is provided
if [ -z "$1" ]; then
    echo "Usage: ./install-custom-nodes.sh /path/to/ComfyUI"
    echo ""
    echo "Example: ./install-custom-nodes.sh /workspace/ComfyUI"
    exit 1
fi

COMFYUI_PATH="$1"
CUSTOM_NODES_PATH="$COMFYUI_PATH/custom_nodes/headshot_generation"

# Validate ComfyUI path
if [ ! -d "$COMFYUI_PATH" ]; then
    echo "Error: ComfyUI directory not found at $COMFYUI_PATH"
    exit 1
fi

echo "ComfyUI path: $COMFYUI_PATH"
echo ""

# Step 1: Copy custom nodes
echo "Step 1: Copying custom nodes..."
mkdir -p "$CUSTOM_NODES_PATH"
cp -r custom_nodes/* "$CUSTOM_NODES_PATH/"
echo "✓ Custom nodes copied to $CUSTOM_NODES_PATH"
echo ""

# Step 2: Install Python dependencies
echo "Step 2: Installing Python dependencies..."
pip install -r custom_nodes/requirements.txt
echo "✓ Dependencies installed"
echo ""

# Step 3: Install RMBG node (optional)
echo "Step 3: Installing RMBG node..."
read -p "Install RMBG node? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$COMFYUI_PATH/custom_nodes"
    
    # Check which RMBG implementation to use
    echo "Choose RMBG implementation:"
    echo "1) comfyui-tooling-nodes (recommended)"
    echo "2) ComfyUI-BRIA-RMBG"
    read -p "Enter choice (1 or 2): " -n 1 -r
    echo ""
    
    if [[ $REPLY == "1" ]]; then
        git clone https://github.com/Acly/comfyui-tooling-nodes
        echo "✓ comfyui-tooling-nodes installed"
    elif [[ $REPLY == "2" ]]; then
        git clone https://github.com/ZHO-ZHO-ZHO/ComfyUI-BRIA-RMBG
        echo "✓ ComfyUI-BRIA-RMBG installed"
    else
        echo "Invalid choice, skipping RMBG installation"
    fi
    
    cd - > /dev/null
else
    echo "Skipping RMBG installation"
fi
echo ""

# Step 4: Check for LoRA model
echo "Step 4: Checking for DanDan LoRA model..."
LORA_PATH="$COMFYUI_PATH/models/loras/dandan-actor.safetensors"
if [ -f "$LORA_PATH" ]; then
    echo "✓ DanDan LoRA model found at $LORA_PATH"
else
    echo "⚠ DanDan LoRA model not found"
    echo "  Please place dandan-actor.safetensors in:"
    echo "  $COMFYUI_PATH/models/loras/"
fi
echo ""

# Step 5: Check environment variables
echo "Step 5: Checking environment variables..."
if [ -z "$REPLICATE_API_TOKEN" ]; then
    echo "⚠ REPLICATE_API_TOKEN not set"
    echo "  For Seedream integration, set:"
    echo "  export REPLICATE_API_TOKEN=your_token_here"
else
    echo "✓ REPLICATE_API_TOKEN is set"
fi
echo ""

# Step 6: Copy workflow
echo "Step 6: Copying workflow..."
WORKFLOW_PATH="$COMFYUI_PATH/workflows"
mkdir -p "$WORKFLOW_PATH"
cp workflow.json "$WORKFLOW_PATH/headshot_generation.json"
echo "✓ Workflow copied to $WORKFLOW_PATH/headshot_generation.json"
echo ""

echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Restart ComfyUI to load the new nodes"
echo "2. Open the workflow: $WORKFLOW_PATH/headshot_generation.json"
echo "3. Test the workflow with sample images"
echo ""
echo "Documentation:"
echo "- Node docs: $CUSTOM_NODES_PATH/README.md"
echo "- Task summary: ./TASK_6_COMPLETION_SUMMARY.md"
echo ""
