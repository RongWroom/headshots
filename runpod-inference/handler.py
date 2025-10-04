import runpod
import torch
from diffusers import FluxPipeline
import base64
import io
from PIL import Image
import os
import requests

class FluxInferenceHandler:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.pipe = None
        self.load_model()
    
    def load_model(self):
        """Load FLUX.1-dev model"""
        try:
            print("Loading FLUX.1-dev model...")
            self.pipe = FluxPipeline.from_pretrained(
                "black-forest-labs/FLUX.1-dev",
                torch_dtype=torch.bfloat16,
                device_map="auto"
            )
            self.pipe.enable_model_cpu_offload()
            print("Model loaded successfully!")
        except Exception as e:
            print(f"Error loading model: {e}")
            # Fallback to schnell if dev fails
            try:
                print("Trying FLUX.1-schnell as fallback...")
                self.pipe = FluxPipeline.from_pretrained(
                    "black-forest-labs/FLUX.1-schnell",
                    torch_dtype=torch.bfloat16,
                    device_map="auto"
                )
                self.pipe.enable_model_cpu_offload()
                print("Fallback model loaded!")
            except Exception as e2:
                print(f"Fallback also failed: {e2}")
                raise e2
    
    def load_lora(self, lora_url, lora_scale=0.8):
        """Load LoRA weights from URL"""
        try:
            if not lora_url:
                return
            
            print(f"Loading LoRA from: {lora_url}")
            
            # Download LoRA file
            response = requests.get(lora_url)
            if response.status_code == 200:
                lora_path = "/tmp/lora.safetensors"
                with open(lora_path, "wb") as f:
                    f.write(response.content)
                
                # Load LoRA
                self.pipe.load_lora_weights(lora_path)
                self.pipe.fuse_lora(lora_scale=lora_scale)
                print(f"LoRA loaded with scale {lora_scale}")
            else:
                print(f"Failed to download LoRA: {response.status_code}")
        except Exception as e:
            print(f"Error loading LoRA: {e}")
    
    def generate_image(self, prompt, negative_prompt="", width=1024, height=1024, 
                      num_inference_steps=25, guidance_scale=7.5, num_outputs=1,
                      lora_url=None, lora_scale=0.8):
        """Generate image with FLUX"""
        try:
            # Load LoRA if provided
            if lora_url:
                self.load_lora(lora_url, lora_scale)
            
            print(f"Generating image with prompt: {prompt[:100]}...")
            
            # Generate image
            with torch.inference_mode():
                images = self.pipe(
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                    width=width,
                    height=height,
                    num_inference_steps=num_inference_steps,
                    guidance_scale=guidance_scale,
                    num_images_per_prompt=num_outputs,
                    generator=torch.Generator().manual_seed(42)
                ).images
            
            # Convert to base64
            image_urls = []
            for i, image in enumerate(images):
                buffer = io.BytesIO()
                image.save(buffer, format="PNG")
                img_str = base64.b64encode(buffer.getvalue()).decode()
                image_urls.append(f"data:image/png;base64,{img_str}")
            
            return {
                "images": image_urls,
                "status": "success"
            }
            
        except Exception as e:
            print(f"Generation error: {e}")
            return {
                "error": str(e),
                "status": "failed"
            }

# Initialize handler
handler = FluxInferenceHandler()

def inference_handler(event):
    """RunPod inference handler"""
    try:
        input_data = event.get("input", {})
        
        # Extract parameters
        prompt = input_data.get("prompt", "")
        negative_prompt = input_data.get("negative_prompt", "")
        width = input_data.get("width", 1024)
        height = input_data.get("height", 1024)
        num_inference_steps = input_data.get("num_inference_steps", 25)
        guidance_scale = input_data.get("guidance_scale", 7.5)
        num_outputs = input_data.get("num_outputs", 1)
        lora_url = input_data.get("lora_url")
        lora_scale = input_data.get("lora_scale", 0.8)
        
        if not prompt:
            return {"error": "No prompt provided"}
        
        # Generate image
        result = handler.generate_image(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            num_outputs=num_outputs,
            lora_url=lora_url,
            lora_scale=lora_scale
        )
        
        return result
        
    except Exception as e:
        return {"error": str(e), "status": "failed"}

# Start RunPod serverless
if __name__ == "__main__":
    runpod.serverless.start({"handler": inference_handler})