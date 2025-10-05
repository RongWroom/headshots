"""
Prompt Builder Node - Combines detected features with DanDan style template
Implements subtask 6.4: Build custom Prompt Builder node
"""


class PromptBuilder:
    """
    Builds professional headshot prompts by combining:
    - Detected facial features from CLIP Interrogator
    - DanDan photography style keywords
    - Professional photography technical terms
    """
    
    # DanDan style template
    DANDAN_TEMPLATE = (
        "A professional headshot portrait of a {gender} with {skin_tone} skin, "
        "{hair_color} hair, {age_range} years old, in dandan style. "
        "Cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8, "
        "muted tones (brown, gray, green, blue), soft directional lighting, "
        "professional serious expression, looking directly at camera, "
        "body angled 45 degrees, face toward camera, photorealistic skin textures, "
        "sharp eyes, natural hair color, subtle shadows, contemplative mood"
    )
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "features": ("DICT",),
            },
            "optional": {
                "template": ("STRING", {
                    "multiline": True,
                    "default": cls.DANDAN_TEMPLATE
                }),
                "use_custom_template": ("BOOLEAN", {
                    "default": False
                }),
                "additional_keywords": ("STRING", {
                    "multiline": False,
                    "default": "",
                    "placeholder": "Additional style keywords (optional)"
                }),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("PROMPT",)
    FUNCTION = "build_prompt"
    CATEGORY = "text/prompt"
    
    def build_prompt(self, features, template=None, use_custom_template=False, additional_keywords=""):
        """
        Build final prompt from detected features and template
        
        Args:
            features: Dictionary of detected facial features
            template: Custom template (optional)
            use_custom_template: Whether to use custom template
            additional_keywords: Additional style keywords to append
        
        Returns:
            Final prompt string
        """
        # Use default template unless custom is specified
        if not use_custom_template or not template:
            template = self.DANDAN_TEMPLATE
        
        # Extract features with defaults
        gender = features.get('gender', 'person')
        skin_tone = features.get('skin_tone', 'medium')
        hair_color = features.get('hair_color', 'brown')
        hair_style = features.get('hair_style', 'professional')
        eye_color = features.get('eye_color', 'brown')
        age_range = features.get('age_range', '30-40')
        
        # Build prompt by replacing placeholders
        prompt = template.format(
            gender=gender,
            skin_tone=skin_tone,
            hair_color=hair_color,
            hair_style=hair_style,
            eye_color=eye_color,
            age_range=age_range
        )
        
        # Add additional keywords if provided
        if additional_keywords and additional_keywords.strip():
            prompt = f"{prompt}, {additional_keywords.strip()}"
        
        # Clean up prompt
        prompt = self._clean_prompt(prompt)
        
        print(f"✓ Built prompt:")
        print(f"  {prompt[:200]}...")
        
        return (prompt,)
    
    def _clean_prompt(self, prompt):
        """Clean and normalize prompt text"""
        # Remove extra whitespace
        prompt = ' '.join(prompt.split())
        
        # Remove duplicate commas
        while ',,' in prompt:
            prompt = prompt.replace(',,', ',')
        
        # Ensure proper spacing after commas
        prompt = prompt.replace(',', ', ')
        prompt = ' '.join(prompt.split())
        
        return prompt.strip()


# Alternative templates for different styles
ALTERNATIVE_TEMPLATES = {
    "corporate": (
        "A professional corporate headshot of a {gender} with {skin_tone} skin, "
        "{hair_color} hair, in dandan style. Clean white background, "
        "professional business attire, confident expression, direct eye contact, "
        "studio lighting, sharp focus, high resolution, corporate photography"
    ),
    
    "creative": (
        "A creative professional portrait of a {gender} with {skin_tone} skin, "
        "{hair_color} hair, in dandan style. Artistic lighting, dramatic shadows, "
        "creative composition, shallow depth of field, moody atmosphere, "
        "professional yet artistic, contemplative expression"
    ),
    
    "casual": (
        "A casual professional headshot of a {gender} with {skin_tone} skin, "
        "{hair_color} hair, in dandan style. Natural lighting, relaxed expression, "
        "approachable demeanor, soft focus background, warm tones, friendly atmosphere"
    ),
    
    "actor": (
        "A professional actor headshot of a {gender} with {skin_tone} skin, "
        "{hair_color} hair, in dandan style. Theatrical lighting, expressive face, "
        "engaging eyes, professional casting photo, neutral background, "
        "Canon R6, 85mm lens, shallow depth of field, sharp facial features"
    ),
}


def get_template(style="default"):
    """Get prompt template by style name"""
    if style == "default":
        return PromptBuilder.DANDAN_TEMPLATE
    return ALTERNATIVE_TEMPLATES.get(style, PromptBuilder.DANDAN_TEMPLATE)
