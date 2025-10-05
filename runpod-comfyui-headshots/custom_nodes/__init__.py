"""
Custom ComfyUI nodes for headshot generation workflow
"""

from .load_images_batch import LoadImageBatch
from .prompt_builder import PromptBuilder
from .clip_interrogator_node import CLIPInterrogator
from .seedream_node import SeedreamNode
from .save_image_webhook import SaveImageWebhook, ImageSelector
from .webhook_progress import WebhookProgress

NODE_CLASS_MAPPINGS = {
    "LoadImageBatch": LoadImageBatch,
    "PromptBuilder": PromptBuilder,
    "CLIPInterrogator": CLIPInterrogator,
    "SeedreamNode": SeedreamNode,
    "ImageSelector": ImageSelector,
    "SaveImageWebhook": SaveImageWebhook,
    "WebhookProgress": WebhookProgress,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "LoadImageBatch": "Load Image Batch from URLs",
    "PromptBuilder": "DanDan Prompt Builder",
    "CLIPInterrogator": "CLIP Interrogator (Face Analysis)",
    "SeedreamNode": "Seedream 4.0 Generator",
    "ImageSelector": "Image Selector",
    "SaveImageWebhook": "Save Image & Send Webhook",
    "WebhookProgress": "Webhook Progress Tracker",
}
