"""
LoadImageBatch Node - Loads multiple images from URLs
Implements subtask 6.1: Configure Load Images node
"""

import torch
import requests
import numpy as np
from PIL import Image
from io import BytesIO


class LoadImageBatch:
    """
    Loads 5-10 images from URLs (Vercel Blob Storage)
    Validates image formats (JPEG, PNG)
    Outputs image tensors for ComfyUI processing
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image_urls": ("STRING", {
                    "multiline": True,
                    "default": "",
                    "placeholder": "Enter image URLs (one per line)"
                }),
            },
            "optional": {
                "max_size": ("INT", {
                    "default": 2048,
                    "min": 512,
                    "max": 4096,
                    "step": 64
                }),
            }
        }
    
    RETURN_TYPES = ("IMAGE", "INT")
    RETURN_NAMES = ("IMAGE", "COUNT")
    FUNCTION = "load_images"
    CATEGORY = "image/batch"
    
    def load_images(self, image_urls, max_size=2048):
        """
        Download and process images from URLs
        
        Args:
            image_urls: Newline-separated list of image URLs
            max_size: Maximum dimension for resizing (optimization)
        
        Returns:
            Tuple of (image_tensor, count)
        """
        # Parse URLs
        urls = [url.strip() for url in image_urls.split('\n') if url.strip()]
        
        if len(urls) < 5:
            raise ValueError(f"Please provide at least 5 images (got {len(urls)})")
        if len(urls) > 10:
            raise ValueError(f"Please provide at most 10 images (got {len(urls)})")
        
        images = []
        valid_formats = {'JPEG', 'PNG', 'JPG'}
        
        for i, url in enumerate(urls):
            try:
                # Download image
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                
                # Open and validate image
                img = Image.open(BytesIO(response.content))
                
                # Validate format
                if img.format not in valid_formats:
                    raise ValueError(f"Invalid image format: {img.format}. Only JPEG and PNG are supported.")
                
                # Convert to RGB (remove alpha channel if present)
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Resize if needed (optimization)
                if max(img.size) > max_size:
                    ratio = max_size / max(img.size)
                    new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                
                # Convert to numpy array
                img_array = np.array(img).astype(np.float32) / 255.0
                images.append(img_array)
                
                print(f"✓ Loaded image {i+1}/{len(urls)}: {img.size}")
                
            except Exception as e:
                print(f"✗ Failed to load image {i+1} from {url}: {str(e)}")
                raise Exception(f"Failed to load image {i+1}: {str(e)}")
        
        if len(images) < 5:
            raise ValueError(f"Successfully loaded only {len(images)} images, need at least 5")
        
        # Convert to torch tensor
        # Shape: (batch, height, width, channels)
        images_tensor = torch.from_numpy(np.stack(images))
        
        print(f"✓ Successfully loaded {len(images)} images")
        print(f"  Tensor shape: {images_tensor.shape}")
        
        return (images_tensor, len(images))
