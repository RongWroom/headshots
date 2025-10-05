"""
RMBG Background Removal Node
Implements subtask 6.2: Configure RMBG background removal node

Note: This is a wrapper/configuration for the RMBG custom node.
The actual RMBG node should be installed separately in ComfyUI.
This file documents the configuration and integration.
"""

# RMBG Node Configuration for workflow.json
RMBG_CONFIG = {
    "node_type": "RMBG",
    "model": "RMBG-1.4",  # or "BiRefNet" as alternative
    "settings": {
        "return_mask": True,
        "alpha_matting": True,
        "alpha_matting_foreground_threshold": 240,
        "alpha_matting_background_threshold": 10,
        "alpha_matting_erode_size": 10
    },
    "progress": {
        "percentage": 20,
        "message": "Removing backgrounds..."
    }
}

"""
Installation Instructions for RMBG:

1. Install RMBG custom node in ComfyUI:
   cd ComfyUI/custom_nodes
   git clone https://github.com/Acly/comfyui-tooling-nodes
   
   OR
   
   git clone https://github.com/ZHO-ZHO-ZHO/ComfyUI-BRIA-RMBG

2. Download RMBG-1.4 model:
   - Model: briaai/RMBG-1.4
   - Place in: ComfyUI/models/rmbg/

3. Alternative: BiRefNet
   - More accurate for complex backgrounds
   - Model: ZhengPeng7/BiRefNet
   - Place in: ComfyUI/models/birefnet/

Usage in workflow:
- Input: IMAGE tensor from LoadImageBatch
- Output: IMAGE tensor with transparent background (RGBA)
- Output: MASK tensor for the foreground

The node processes each image in the batch and removes backgrounds,
outputting transparent PNG images suitable for face analysis and generation.
"""

# Webhook integration
def send_rmbg_progress(webhook_url, job_id):
    """Send progress update when RMBG processing starts"""
    import requests
    
    if not webhook_url:
        return
    
    try:
        requests.post(webhook_url, json={
            "job_id": job_id,
            "status": "processing",
            "progress": 20,
            "message": "Removing backgrounds..."
        }, timeout=10)
    except Exception as e:
        print(f"Failed to send RMBG progress webhook: {str(e)}")
