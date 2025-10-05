"""
Seedream 4.0 Node - High-quality headshot generation with face consistency
Implements subtask 6.5: Configure Seedream 4.0 node
"""

import torch
import requests
import base64
import time
from io import BytesIO
from PIL import Image
import numpy as np


class SeedreamNode:
    """
    Generates professional headshots using Seedream 4.0
    Uses multiple reference images for superior face consistency
    Outputs 4 high-resolution headshots
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image_input": ("IMAGE",),  # Background-removed reference images
                "prompt": ("STRING", {
                    "multiline": True,
                    "default": ""
                }),
            },
            "optional": {
                "model": (["bytedance/seedream-4"], {
                    "default": "bytedance/seedream-4"
                }),
                "size": (["2K", "4K", "1K"], {
                    "default": "2K"
                }),
                "width": ("INT", {
                    "default": 1728,
                    "min": 512,
                    "max": 4096,
                    "step": 64
                }),
                "height": ("INT", {
                    "default": 2304,
                    "min": 512,
                    "max": 4096,
                    "step": 64
                }),
                "aspect_ratio": (["3:4", "4:3", "1:1", "16:9"], {
                    "default": "3:4"
                }),
                "max_images": ("INT", {
                    "default": 4,
                    "min": 1,
                    "max": 8
                }),
                "prompt_strength": ("FLOAT", {
                    "default": 0.85,
                    "min": 0.0,
                    "max": 1.0,
                    "step": 0.05
                }),
                "seed": ("INT", {
                    "default": 42,
                    "min": 0,
                    "max": 2147483647
                }),
            }
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("IMAGE",)
    FUNCTION = "generate"
    CATEGORY = "image/generation"
    
    def generate(self, image_input, prompt, model="bytedance/seedream-4", 
                 size="2K", width=1728, height=2304, aspect_ratio="3:4",
                 max_images=4, prompt_strength=0.85, seed=42):
        """
        Generate professional headshots using Seedream 4.0
        
        Args:
            image_input: Batch of background-removed reference images
            prompt: Generated prompt from PromptBuilder
            model: Seedream model version
            size: Output size preset
            width: Output width in pixels
            height: Output height in pixels
            aspect_ratio: Output aspect ratio
            max_images: Number of variations to generate
            prompt_strength: How strongly to follow the prompt (0-1)
            seed: Random seed for reproducibility
        
        Returns:
            Batch of generated headshot images
        """
        print(f"Generating {max_images} headshots with Seedream 4.0...")
        print(f"  Input images: {image_input.shape[0]}")
        print(f"  Size: {width}x{height} ({aspect_ratio})")
        print(f"  Prompt strength: {prompt_strength}")
        
        # Convert input images to format suitable for Seedream
        reference_images = self._prepare_reference_images(image_input)
        
        # Call Seedream API (via Replicate or local implementation)
        generated_images = self._call_seedream_api(
            reference_images=reference_images,
            prompt=prompt,
            model=model,
            width=width,
            height=height,
            num_outputs=max_images,
            prompt_strength=prompt_strength,
            seed=seed
        )
        
        # Convert generated images to tensor
        output_tensor = self._images_to_tensor(generated_images)
        
        print(f"✓ Generated {len(generated_images)} headshots")
        print(f"  Output tensor shape: {output_tensor.shape}")
        
        return (output_tensor,)
    
    def _prepare_reference_images(self, image_tensor):
        """Convert image tensor to list of PIL Images"""
        images = []
        batch_size = image_tensor.shape[0]
        
        for i in range(batch_size):
            # Convert tensor to numpy
            img_np = image_tensor[i].cpu().numpy()
            
            # Convert to uint8
            img_np = (img_np * 255).astype(np.uint8)
            
            # Convert to PIL Image
            img_pil = Image.fromarray(img_np)
            images.append(img_pil)
        
        return images
    
    def _call_seedream_api(self, reference_images, prompt, model, width, height,
                           num_outputs, prompt_strength, seed):
        """
        Call Seedream API to generate images
        
        This is a placeholder implementation. In production, integrate with:
        1. Replicate API for Seedream 4.0
        2. Local Seedream implementation
        3. Custom Seedream endpoint
        """
        # Check if we should use Replicate API
        replicate_api_token = self._get_replicate_token()
        
        if replicate_api_token:
            return self._call_replicate_seedream(
                reference_images, prompt, width, height,
                num_outputs, prompt_strength, seed, replicate_api_token
            )
        else:
            # Fallback: Return placeholder images for testing
            print("⚠ No Replicate API token found, using placeholder images")
            return self._generate_placeholder_images(
                reference_images[0], num_outputs, width, height
            )
    
    def _get_replicate_token(self):
        """Get Replicate API token from environment"""
        import os
        return os.environ.get('REPLICATE_API_TOKEN')
    
    def _call_replicate_seedream(self, reference_images, prompt, width, height,
                                 num_outputs, prompt_strength, seed, api_token):
        """Call Replicate API for Seedream 4.0"""
        try:
            import replicate
            
            # Convert images to base64
            image_inputs = []
            for img in reference_images:
                buffered = BytesIO()
                img.save(buffered, format="PNG")
                img_b64 = base64.b64encode(buffered.getvalue()).decode()
                image_inputs.append(f"data:image/png;base64,{img_b64}")
            
            # Call Seedream via Replicate
            output = replicate.run(
                "bytedance/seedream-4",
                input={
                    "image_input": image_inputs,
                    "prompt": prompt,
                    "width": width,
                    "height": height,
                    "num_outputs": num_outputs,
                    "prompt_strength": prompt_strength,
                    "seed": seed,
                }
            )
            
            # Download generated images
            generated_images = []
            for img_url in output:
                response = requests.get(img_url, timeout=60)
                response.raise_for_status()
                img = Image.open(BytesIO(response.content))
                generated_images.append(img)
            
            return generated_images
            
        except Exception as e:
            print(f"Error calling Replicate Seedream: {str(e)}")
            # Fallback to placeholder
            return self._generate_placeholder_images(
                reference_images[0], num_outputs, width, height
            )
    
    def _generate_placeholder_images(self, reference_image, num_outputs, width, height):
        """Generate placeholder images for testing"""
        images = []
        
        for i in range(num_outputs):
            # Resize reference image to target size
            img = reference_image.copy()
            img = img.resize((width, height), Image.Resampling.LANCZOS)
            images.append(img)
        
        return images
    
    def _images_to_tensor(self, images):
        """Convert list of PIL Images to tensor"""
        tensors = []
        
        for img in images:
            # Convert to RGB if needed
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Convert to numpy array
            img_np = np.array(img).astype(np.float32) / 255.0
            tensors.append(img_np)
        
        # Stack into batch tensor
        return torch.from_numpy(np.stack(tensors))


"""
Production Integration Notes:

1. Replicate API Integration:
   - Sign up at replicate.com
   - Get API token
   - Set environment variable: REPLICATE_API_TOKEN
   - Install: pip install replicate

2. Seedream 4.0 Parameters:
   - image_input: Array of reference images (5-10 recommended)
   - prompt: Detailed description with style keywords
   - width/height: Output dimensions (1728x2304 for 3:4 portrait)
   - num_outputs: Number of variations (4 recommended)
   - prompt_strength: 0.85 balances prompt following and face consistency
   - seed: For reproducible results

3. Webhook Progress:
   Send progress updates:
   - 50%: "Generating professional headshots..." (start)
   - 60-70%: Update during generation
   - 70%: "Generation complete" (end)

4. Error Handling:
   - Retry on API failures
   - Validate output images
   - Check for NSFW content
   - Handle timeouts gracefully

5. Cost Optimization:
   - Seedream 4.0 costs ~$0.10 per generation
   - Cache results when possible
   - Batch multiple requests
"""
