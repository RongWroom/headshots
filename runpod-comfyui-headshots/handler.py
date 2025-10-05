"""
RunPod Handler for ComfyUI Headshot Generation
Processes user photos and generates professional headshots using ComfyUI workflow
"""

import os
import json
import base64
import requests
import runpod
from io import BytesIO
from PIL import Image
import time

# ComfyUI API endpoint
COMFYUI_URL = "http://127.0.0.1:8188"


def download_image(url):
    """Download image from URL and return as PIL Image"""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return Image.open(BytesIO(response.content))
    except Exception as e:
        raise Exception(f"Failed to download image from {url}: {str(e)}")


def image_to_base64(image):
    """Convert PIL Image to base64 string"""
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode()


def send_webhook(webhook_url, data):
    """Send progress update to webhook URL"""
    if not webhook_url:
        return
    
    try:
        requests.post(webhook_url, json=data, timeout=10)
    except Exception as e:
        print(f"Failed to send webhook: {str(e)}")


def execute_comfyui_workflow(workflow_data, webhook_url=None, job_id=None):
    """Execute ComfyUI workflow and return results"""
    
    # Queue the workflow
    try:
        response = requests.post(
            f"{COMFYUI_URL}/prompt",
            json={"prompt": workflow_data},
            timeout=30
        )
        response.raise_for_status()
        prompt_id = response.json()["prompt_id"]
    except Exception as e:
        raise Exception(f"Failed to queue workflow: {str(e)}")
    
    # Poll for completion
    max_wait = 600  # 10 minutes
    start_time = time.time()
    last_progress = 0
    
    while time.time() - start_time < max_wait:
        try:
            # Check queue status
            history_response = requests.get(
                f"{COMFYUI_URL}/history/{prompt_id}",
                timeout=10
            )
            
            if history_response.status_code == 200:
                history = history_response.json()
                
                if prompt_id in history:
                    # Workflow completed
                    result = history[prompt_id]
                    
                    if "outputs" in result:
                        # Extract generated images
                        images = []
                        for node_id, node_output in result["outputs"].items():
                            if "images" in node_output:
                                for img_data in node_output["images"]:
                                    # Download image from ComfyUI
                                    img_url = f"{COMFYUI_URL}/view?filename={img_data['filename']}&subfolder={img_data.get('subfolder', '')}&type={img_data.get('type', 'output')}"
                                    img_response = requests.get(img_url, timeout=30)
                                    img_response.raise_for_status()
                                    
                                    # Convert to base64
                                    img_base64 = base64.b64encode(img_response.content).decode()
                                    images.append(img_base64)
                        
                        return images
            
            # Send progress update
            current_progress = min(50 + int((time.time() - start_time) / max_wait * 40), 90)
            if current_progress > last_progress:
                send_webhook(webhook_url, {
                    "job_id": job_id,
                    "status": "processing",
                    "progress": current_progress,
                    "message": "Generating professional headshots..."
                })
                last_progress = current_progress
            
            time.sleep(2)
            
        except Exception as e:
            print(f"Error polling workflow: {str(e)}")
            time.sleep(2)
    
    raise Exception("Workflow execution timed out")


def handler(event):
    """
    Main handler function for RunPod
    
    Expected input:
    {
        "reference_images": ["url1", "url2", ...],  # 5-10 image URLs
        "num_outputs": 4,
        "style_intensity": 0.8,
        "webhook_url": "https://yourapp.com/api/headshots/webhook",
        "job_id": "uuid"
    }
    """
    
    try:
        # Extract input parameters
        input_data = event.get("input", {})
        reference_images = input_data.get("reference_images", [])
        num_outputs = input_data.get("num_outputs", 4)
        style_intensity = input_data.get("style_intensity", 0.8)
        webhook_url = input_data.get("webhook_url")
        job_id = input_data.get("job_id")
        
        # Validate inputs
        if not reference_images or len(reference_images) < 5 or len(reference_images) > 10:
            return {
                "error": "Please provide between 5-10 reference images",
                "status": "failed"
            }
        
        # Send initial webhook
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "processing",
            "progress": 10,
            "message": "Loading reference images..."
        })
        
        # Download reference images
        downloaded_images = []
        for i, url in enumerate(reference_images):
            try:
                img = download_image(url)
                downloaded_images.append(img)
                
                # Send progress update
                progress = 10 + int((i + 1) / len(reference_images) * 10)
                send_webhook(webhook_url, {
                    "job_id": job_id,
                    "status": "processing",
                    "progress": progress,
                    "message": f"Loading reference images... ({i + 1}/{len(reference_images)})"
                })
            except Exception as e:
                print(f"Failed to download image {i}: {str(e)}")
                continue
        
        if len(downloaded_images) < 5:
            return {
                "error": "Failed to download enough reference images",
                "status": "failed"
            }
        
        # Load workflow template
        workflow_path = "/workspace/workflows/headshot_generation.json"
        if not os.path.exists(workflow_path):
            return {
                "error": "Workflow template not found",
                "status": "failed"
            }
        
        with open(workflow_path, 'r') as f:
            workflow_data = json.load(f)
        
        # TODO: Customize workflow with downloaded images and parameters
        # This will be implemented when we create the actual ComfyUI workflow JSON
        
        # Execute workflow
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "processing",
            "progress": 30,
            "message": "Processing images through ComfyUI workflow..."
        })
        
        generated_images = execute_comfyui_workflow(
            workflow_data,
            webhook_url=webhook_url,
            job_id=job_id
        )
        
        # Send completion webhook
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "completed",
            "progress": 100,
            "message": "Complete!",
            "images": generated_images
        })
        
        return {
            "status": "success",
            "images": generated_images,
            "metadata": {
                "num_images": len(generated_images),
                "num_reference_images": len(downloaded_images)
            }
        }
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error in handler: {error_msg}")
        
        # Send error webhook
        send_webhook(webhook_url, {
            "job_id": job_id,
            "status": "failed",
            "progress": 0,
            "error": error_msg
        })
        
        return {
            "error": error_msg,
            "status": "failed"
        }


if __name__ == "__main__":
    # Start RunPod serverless handler
    runpod.serverless.start({"handler": handler})
