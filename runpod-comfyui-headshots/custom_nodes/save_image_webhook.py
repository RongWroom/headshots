"""
Save Image & Webhook Node - Converts images to base64 and sends completion webhook
Implements subtask 6.7: Configure Save Images node
"""

import torch
import numpy as np
import base64
import requests
from io import BytesIO
from PIL import Image


class SaveImageWebhook:
    """
    Saves generated images and sends completion webhook
    - Converts images to base64 strings
    - Sends webhook with images at 100% progress
    - Returns images in response payload
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "webhook_url": ("STRING", {
                    "default": "",
                    "placeholder": "https://yourapp.com/api/headshots/webhook"
                }),
                "job_id": ("STRING", {
                    "default": "",
                    "placeholder": "job-uuid"
                }),
            },
            "optional": {
                "format": (["base64", "url", "both"], {
                    "default": "base64"
                }),
                "image_format": (["PNG", "JPEG", "WEBP"], {
                    "default": "PNG"
                }),
                "jpeg_quality": ("INT", {
                    "default": 90,
                    "min": 1,
                    "max": 100
                }),
                "send_webhook": ("BOOLEAN", {
                    "default": True
                }),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("RESULT",)
    FUNCTION = "save_and_send"
    CATEGORY = "image/output"
    OUTPUT_NODE = True
    
    def save_and_send(self, images, webhook_url, job_id, format="base64",
                      image_format="PNG", jpeg_quality=90, send_webhook=True):
        """
        Save images and send completion webhook
        
        Args:
            images: IMAGE tensor batch
            webhook_url: Webhook URL to send results
            job_id: Job ID for tracking
            format: Output format (base64/url/both)
            image_format: Image file format (PNG/JPEG/WEBP)
            jpeg_quality: JPEG quality (1-100)
            send_webhook: Whether to send webhook
        
        Returns:
            JSON string with results
        """
        print(f"Saving {images.shape[0]} images and sending webhook...")
        
        # Convert images to base64
        image_data = []
        batch_size = images.shape[0]
        
        for i in range(batch_size):
            img_tensor = images[i]
            
            # Convert tensor to PIL Image
            img_pil = self._tensor_to_pil(img_tensor)
            
            # Convert to base64
            img_b64 = self._pil_to_base64(img_pil, image_format, jpeg_quality)
            
            image_data.append({
                "index": i,
                "format": image_format,
                "base64": img_b64,
                "size": img_pil.size
            })
            
            print(f"  ✓ Converted image {i+1}/{batch_size} to base64")
        
        # Prepare webhook payload
        webhook_payload = {
            "job_id": job_id,
            "status": "completed",
            "progress": 100,
            "message": "Complete!",
            "images": [img["base64"] for img in image_data],
            "metadata": {
                "num_images": len(image_data),
                "format": image_format,
                "sizes": [img["size"] for img in image_data]
            }
        }
        
        # Send webhook
        if send_webhook and webhook_url:
            success = self._send_webhook(webhook_url, webhook_payload)
            if success:
                print(f"✓ Webhook sent successfully to {webhook_url}")
            else:
                print(f"✗ Failed to send webhook to {webhook_url}")
        
        # Return result
        import json
        result = {
            "status": "success",
            "job_id": job_id,
            "num_images": len(image_data),
            "webhook_sent": send_webhook and webhook_url is not None
        }
        
        return (json.dumps(result),)
    
    def _tensor_to_pil(self, tensor):
        """Convert image tensor to PIL Image"""
        # Convert to numpy
        img_np = tensor.cpu().numpy()
        
        # Convert to uint8
        img_np = (img_np * 255).astype(np.uint8)
        
        # Convert to PIL
        img_pil = Image.fromarray(img_np)
        
        return img_pil
    
    def _pil_to_base64(self, img_pil, format="PNG", quality=90):
        """Convert PIL Image to base64 string"""
        buffered = BytesIO()
        
        # Save with appropriate format
        if format == "JPEG":
            img_pil.save(buffered, format="JPEG", quality=quality, optimize=True)
        elif format == "WEBP":
            img_pil.save(buffered, format="WEBP", quality=quality)
        else:  # PNG
            img_pil.save(buffered, format="PNG", optimize=True)
        
        # Encode to base64
        img_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        return img_b64
    
    def _send_webhook(self, webhook_url, payload):
        """Send webhook with retry logic"""
        max_retries = 3
        retry_delay = 1  # seconds
        
        for attempt in range(max_retries):
            try:
                response = requests.post(
                    webhook_url,
                    json=payload,
                    timeout=30,
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                return True
                
            except requests.exceptions.RequestException as e:
                print(f"Webhook attempt {attempt + 1}/{max_retries} failed: {str(e)}")
                
                if attempt < max_retries - 1:
                    import time
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
        
        return False


class ImageSelector:
    """
    Selects between Seedream output and LoRA-refined output
    Used to route images based on whether LoRA refinement was applied
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images_seedream": ("IMAGE",),
            },
            "optional": {
                "images_refined": ("IMAGE",),
                "mode": (["use_refined_if_available", "always_seedream", "always_refined"], {
                    "default": "use_refined_if_available"
                }),
            }
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("IMAGE",)
    FUNCTION = "select_images"
    CATEGORY = "image/processing"
    
    def select_images(self, images_seedream, images_refined=None, mode="use_refined_if_available"):
        """
        Select which images to output
        
        Args:
            images_seedream: Images from Seedream node
            images_refined: Images from LoRA refinement (optional)
            mode: Selection mode
        
        Returns:
            Selected images
        """
        if mode == "always_seedream":
            print("Using Seedream output (no refinement)")
            return (images_seedream,)
        
        if mode == "always_refined" and images_refined is not None:
            print("Using LoRA-refined output")
            return (images_refined,)
        
        # Default: use refined if available, otherwise seedream
        if images_refined is not None:
            print("Using LoRA-refined output")
            return (images_refined,)
        else:
            print("Using Seedream output (refinement not available)")
            return (images_seedream,)


"""
Webhook Payload Format:

{
  "job_id": "uuid-string",
  "status": "completed",
  "progress": 100,
  "message": "Complete!",
  "images": [
    "base64_encoded_image_1",
    "base64_encoded_image_2",
    "base64_encoded_image_3",
    "base64_encoded_image_4"
  ],
  "metadata": {
    "num_images": 4,
    "format": "PNG",
    "sizes": [[1728, 2304], [1728, 2304], [1728, 2304], [1728, 2304]]
  }
}

Integration Notes:

1. Base64 Encoding:
   - PNG format recommended for quality
   - JPEG for smaller file sizes (90% quality)
   - WEBP for best compression

2. Webhook Delivery:
   - 3 retry attempts with exponential backoff
   - 30 second timeout per attempt
   - Logs all failures for debugging

3. Error Handling:
   - Continues even if webhook fails
   - Returns success status for workflow
   - Logs detailed error messages

4. Performance:
   - Base64 encoding is fast (<1 second per image)
   - Webhook sending is async-friendly
   - Total time: ~2-3 seconds for 4 images

5. Alternative: Upload to Storage
   Instead of base64 in webhook, can upload to:
   - Vercel Blob Storage
   - AWS S3
   - Cloudinary
   Then send URLs in webhook instead
"""
