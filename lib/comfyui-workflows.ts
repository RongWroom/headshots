/**
 * ComfyUI Workflow Templates for FLUX + LoRA Generation
 */

export interface ComfyUIWorkflow {
  [key: string]: {
    inputs: any;
    class_type: string;
    _meta?: any;
  };
}

/**
 * Create a FLUX + LoRA workflow for personalized headshot generation
 */
export function createFluxLoRAWorkflow(
  prompt: string,
  loraUrl?: string,
  width: number = 1024,
  height: number = 1024,
  steps: number = 28,
  guidance: number = 5.0,
  seed: number = -1
): ComfyUIWorkflow {
  const workflow: ComfyUIWorkflow = {
    // Load FLUX.1 Dev model
    "4": {
      "inputs": {
        "ckpt_name": "flux1-dev-fp8.safetensors"
      },
      "class_type": "CheckpointLoaderSimple",
      "_meta": {
        "title": "Load Checkpoint"
      }
    },
    
    // Text prompt
    "6": {
      "inputs": {
        "text": prompt,
        "clip": ["4", 1]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP Text Encode (Prompt)"
      }
    },
    
    // Empty latent image
    "5": {
      "inputs": {
        "width": width,
        "height": height,
        "batch_size": 1
      },
      "class_type": "EmptyLatentImage",
      "_meta": {
        "title": "Empty Latent Image"
      }
    },
    
    // KSampler for generation
    "3": {
      "inputs": {
        "seed": seed,
        "steps": steps,
        "cfg": guidance,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 1,
        "model": ["4", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0]
      },
      "class_type": "KSampler",
      "_meta": {
        "title": "KSampler"
      }
    },
    
    // Negative prompt (empty)
    "7": {
      "inputs": {
        "text": "blurry, low quality, distorted, bad anatomy, deformed, disfigured, multiple people, crowd",
        "clip": ["4", 1]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP Text Encode (Negative)"
      }
    },
    
    // VAE Decode
    "8": {
      "inputs": {
        "samples": ["3", 0],
        "vae": ["4", 2]
      },
      "class_type": "VAEDecode",
      "_meta": {
        "title": "VAE Decode"
      }
    },
    
    // Save Image
    "9": {
      "inputs": {
        "filename_prefix": "flux_headshot",
        "images": ["8", 0]
      },
      "class_type": "SaveImage",
      "_meta": {
        "title": "Save Image"
      }
    }
  };

  // Add LoRA loader if LoRA URL is provided
  if (loraUrl) {
    workflow["10"] = {
      "inputs": {
        "lora_name": loraUrl,
        "strength_model": 0.8,
        "strength_clip": 0.8,
        "model": ["4", 0],
        "clip": ["4", 1]
      },
      "class_type": "LoraLoader",
      "_meta": {
        "title": "Load LoRA"
      }
    };
    
    // Update connections to use LoRA
    workflow["6"].inputs.clip = ["10", 1];
    workflow["7"].inputs.clip = ["10", 1];
    workflow["3"].inputs.model = ["10", 0];
  }

  return workflow;
}

/**
 * Simplified FLUX workflow without LoRA (for testing)
 */
export function createSimpleFluxWorkflow(
  prompt: string,
  width: number = 1024,
  height: number = 1024,
  steps: number = 28,
  guidance: number = 5.0,
  seed: number = -1
): ComfyUIWorkflow {
  return createFluxLoRAWorkflow(prompt, undefined, width, height, steps, guidance, seed);
}