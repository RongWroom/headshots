"""
LoRA Refinement Node - Optional DanDan style enhancement
Implements subtask 6.6: Configure optional LoRA refinement node
"""


class LoRARefinementConfig:
    """
    Configuration for optional LoRA refinement
    Only executes if styleIntensity > 0.5
    Applies DanDan-Actor LoRA via img2img at low strength
    """
    
    # LoRA configuration
    LORA_MODEL = "dandan-actor.safetensors"
    LORA_STRENGTH_MODEL = 0.35  # Low strength to preserve face
    LORA_STRENGTH_CLIP = 0.35
    
    # img2img configuration
    DENOISE_STRENGTH = 0.4  # Low denoise to preserve face details
    STEPS = 15
    CFG_SCALE = 3.5
    SAMPLER = "euler_ancestral"
    SCHEDULER = "normal"
    
    # Activation threshold
    STYLE_INTENSITY_THRESHOLD = 0.5
    
    @staticmethod
    def should_activate(style_intensity):
        """Check if LoRA refinement should be activated"""
        return style_intensity > LoRARefinementConfig.STYLE_INTENSITY_THRESHOLD


"""
LoRA Refinement Workflow Configuration:

The LoRA refinement is implemented as a series of ComfyUI nodes:

1. LoRALoader Node (id: 6)
   - Loads DanDan-Actor LoRA model
   - Model strength: 0.35
   - CLIP strength: 0.35
   - Input: Base model + CLIP
   - Output: LoRA-enhanced model + CLIP

2. VAEEncode Node (id: 7)
   - Encodes Seedream output to latent space
   - Input: Generated images from Seedream
   - Output: Latent representation

3. CLIPTextEncode Nodes (id: 10, 11)
   - Positive prompt: Uses same prompt from PromptBuilder
   - Negative prompt: "blurry, low quality, distorted face, multiple faces, deformed, ugly, bad anatomy, bad proportions"
   - Input: LoRA-enhanced CLIP + prompt text
   - Output: Conditioning vectors

4. KSampler Node (id: 8)
   - Applies LoRA refinement via img2img
   - Denoise: 0.4 (low to preserve face)
   - Steps: 15
   - CFG Scale: 3.5
   - Sampler: euler_ancestral
   - Input: LoRA model, conditioning, latent
   - Output: Refined latent

5. VAEDecode Node (id: 9)
   - Decodes refined latent back to image
   - Input: Refined latent + VAE
   - Output: Style-refined images

Node Activation:
- All LoRA nodes have mode: 4 (disabled by default)
- Activated dynamically when styleIntensity > 0.5
- If not activated, Seedream output passes directly to output
"""


def configure_lora_nodes(workflow, style_intensity):
    """
    Configure LoRA nodes in workflow based on style intensity
    
    Args:
        workflow: ComfyUI workflow dict
        style_intensity: Style intensity value (0-1)
    
    Returns:
        Modified workflow with LoRA nodes configured
    """
    should_activate = LoRARefinementConfig.should_activate(style_intensity)
    
    # Node IDs for LoRA refinement chain
    lora_node_ids = [6, 7, 8, 9, 10, 11]
    
    for node in workflow.get("nodes", []):
        if node["id"] in lora_node_ids:
            # Set mode: 0 (active) or 4 (disabled)
            node["mode"] = 0 if should_activate else 4
    
    print(f"LoRA refinement: {'ENABLED' if should_activate else 'DISABLED'}")
    print(f"  Style intensity: {style_intensity}")
    
    return workflow


def get_lora_parameters(style_intensity):
    """
    Get LoRA parameters adjusted for style intensity
    
    Args:
        style_intensity: Style intensity value (0-1)
    
    Returns:
        Dict of LoRA parameters
    """
    # Scale LoRA strength based on style intensity
    # Range: 0.3-0.4 for model, 0.3-0.4 for CLIP
    base_strength = 0.3
    max_strength = 0.4
    
    strength_range = max_strength - base_strength
    adjusted_strength = base_strength + (style_intensity * strength_range)
    
    return {
        "lora_model": LoRARefinementConfig.LORA_MODEL,
        "lora_strength_model": adjusted_strength,
        "lora_strength_clip": adjusted_strength,
        "denoise": LoRARefinementConfig.DENOISE_STRENGTH,
        "steps": LoRARefinementConfig.STEPS,
        "cfg": LoRARefinementConfig.CFG_SCALE,
        "sampler_name": LoRARefinementConfig.SAMPLER,
        "scheduler": LoRARefinementConfig.SCHEDULER,
    }


"""
Installation and Setup:

1. Download DanDan-Actor LoRA:
   - Place in: ComfyUI/models/loras/dandan-actor.safetensors
   - Or set custom path in workflow

2. Ensure VAE model is available:
   - Default VAE from base model
   - Or custom VAE in: ComfyUI/models/vae/

3. Webhook Progress:
   When LoRA refinement is active:
   - Send webhook at 80% progress
   - Message: "Refining photography style..."

4. Quality Considerations:
   - Low denoise (0.4) preserves facial features
   - Low LoRA strength (0.3-0.4) enhances style without distortion
   - Euler ancestral sampler provides good quality/speed balance
   - 15 steps is sufficient for subtle refinement

5. Performance:
   - LoRA refinement adds ~20-30 seconds per batch
   - Only activate when style enhancement is needed
   - Consider user preference for speed vs quality
"""
