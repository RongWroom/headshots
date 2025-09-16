"""
High-end FLUX Dev LoRA trainer optimized for exact likeness preservation
Implements advanced training techniques for 4K-capable headshot generation
"""

import torch
import torch.nn.functional as F
from diffusers import FluxPipeline, DDPMScheduler
from diffusers.optimization import get_scheduler
from peft import LoraConfig, get_peft_model, TaskType
from transformers import CLIPTextModel, CLIPTokenizer
from PIL import Image
import os
import json
import numpy as np
from torch.utils.data import Dataset, DataLoader
from accelerate import Accelerator
import random

class HeadshotDataset(Dataset):
    """Custom dataset for headshot training with advanced augmentation"""
    
    def __init__(self, image_paths, trigger_word, style_prompt, resolution=1024):
        self.image_paths = image_paths
        self.trigger_word = trigger_word
        self.style_prompt = style_prompt
        self.resolution = resolution
        
        # Create diverse prompts for better training
        self.prompt_templates = [
            f"a {style_prompt} of {trigger_word}",
            f"{style_prompt} portrait of {trigger_word}",
            f"high quality {style_prompt} of {trigger_word}",
            f"professional photograph, {style_prompt} of {trigger_word}",
            f"detailed {style_prompt} showing {trigger_word}",
            f"studio lighting, {style_prompt} of {trigger_word}",
            f"sharp focus {style_prompt} of {trigger_word}",
            f"4k resolution {style_prompt} of {trigger_word}",
        ]
        
    def __len__(self):
        # Repeat dataset multiple times for more training iterations
        return len(self.image_paths) * 8
    
    def __getitem__(self, idx):
        # Get actual image index
        img_idx = idx % len(self.image_paths)
        image_path = self.image_paths[img_idx]
        
        # Load and preprocess image
        image = Image.open(image_path).convert('RGB')
        image = image.resize((self.resolution, self.resolution), Image.Resampling.LANCZOS)
        
        # Convert to tensor and normalize
        image_tensor = torch.from_numpy(np.array(image)).float() / 255.0
        image_tensor = image_tensor.permute(2, 0, 1)  # HWC to CHW
        image_tensor = (image_tensor - 0.5) / 0.5  # Normalize to [-1, 1]
        
        # Random prompt selection for variety
        prompt = random.choice(self.prompt_templates)
        
        return {
            'image': image_tensor,
            'prompt': prompt
        }

class FluxLoRATrainer:
    """Advanced FLUX Dev LoRA trainer for high-end headshots"""
    
    def __init__(self, model_name, output_dir, **config):
        self.model_name = model_name
        self.output_dir = output_dir
        self.config = config
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Initialize accelerator for mixed precision training
        self.accelerator = Accelerator(
            mixed_precision=config.get('mixed_precision', 'bf16'),
            gradient_accumulation_steps=config.get('gradient_accumulation_steps', 4)
        )
        
        print(f"🔧 Initializing FLUX trainer with device: {self.accelerator.device}")
        
    def load_models(self):
        """Load FLUX Dev pipeline and prepare for LoRA training"""
        print("📥 Loading FLUX Dev model...")
        
        # Load the pipeline
        self.pipe = FluxPipeline.from_pretrained(
            self.model_name,
            torch_dtype=torch.bfloat16,
            use_safetensors=True
        )
        
        # Move to device
        self.pipe = self.pipe.to(self.accelerator.device)
        
        # Configure LoRA for the transformer (FLUX uses a transformer, not UNet)
        lora_config = LoraConfig(
            r=self.config.get('lora_rank', 64),
            lora_alpha=self.config.get('lora_alpha', 64),
            target_modules=[
                "to_k", "to_q", "to_v", "to_out.0",
                "proj_in", "proj_out",
                "ff.net.0.proj", "ff.net.2"
            ],
            lora_dropout=0.1,
            bias="none",
            task_type=TaskType.DIFFUSION_IMAGE_GENERATION,
        )
        
        # Apply LoRA to the transformer
        self.pipe.transformer = get_peft_model(self.pipe.transformer, lora_config)
        
        # Enable training mode for LoRA layers only
        self.pipe.transformer.train()
        for param in self.pipe.transformer.parameters():
            param.requires_grad = False
        for param in self.pipe.transformer.peft_modules():
            param.requires_grad = True
        
        print(f"✅ LoRA applied with rank {lora_config.r}")
        
        # Setup optimizer
        trainable_params = [p for p in self.pipe.transformer.parameters() if p.requires_grad]
        
        if self.config.get('use_8bit_adam', True):
            try:
                import bitsandbytes as bnb
                self.optimizer = bnb.optim.AdamW8bit(
                    trainable_params,
                    lr=self.config.get('learning_rate', 1e-4),
                    betas=(0.9, 0.999),
                    weight_decay=0.01,
                    eps=1e-8
                )
                print("✅ Using 8-bit AdamW optimizer")
            except ImportError:
                self.optimizer = torch.optim.AdamW(
                    trainable_params,
                    lr=self.config.get('learning_rate', 1e-4),
                    betas=(0.9, 0.999),
                    weight_decay=0.01,
                    eps=1e-8
                )
                print("✅ Using standard AdamW optimizer")
        else:
            self.optimizer = torch.optim.AdamW(
                trainable_params,
                lr=self.config.get('learning_rate', 1e-4),
                betas=(0.9, 0.999),
                weight_decay=0.01,
                eps=1e-8
            )
        
        print(f"📊 Trainable parameters: {sum(p.numel() for p in trainable_params):,}")
        
    def train(self, image_paths, trigger_word, style_prompt):
        """Train LoRA model on provided images"""
        print(f"🎯 Starting training with {len(image_paths)} images...")
        
        # Load models
        self.load_models()
        
        # Create dataset and dataloader
        dataset = HeadshotDataset(
            image_paths=image_paths,
            trigger_word=trigger_word,
            style_prompt=style_prompt,
            resolution=self.config.get('resolution', 1024)
        )
        
        dataloader = DataLoader(
            dataset,
            batch_size=self.config.get('train_batch_size', 1),
            shuffle=True,
            num_workers=2
        )
        
        # Setup scheduler
        num_training_steps = self.config.get('max_train_steps', 1500)
        lr_scheduler = get_scheduler(
            "cosine",
            optimizer=self.optimizer,
            num_warmup_steps=100,
            num_training_steps=num_training_steps
        )
        
        # Prepare for training with accelerator
        self.pipe.transformer, self.optimizer, dataloader, lr_scheduler = self.accelerator.prepare(
            self.pipe.transformer, self.optimizer, dataloader, lr_scheduler
        )
        
        # Training loop
        global_step = 0
        progress_bar = range(num_training_steps)
        
        print(f"🚀 Training for {num_training_steps} steps...")
        
        for epoch in range(100):  # Large number, will break when steps reached
            for batch in dataloader:
                if global_step >= num_training_steps:
                    break
                
                with self.accelerator.accumulate(self.pipe.transformer):
                    # Get batch data
                    images = batch['image']
                    prompts = batch['prompt']
                    
                    # Encode prompts
                    text_inputs = self.pipe.tokenizer(
                        prompts,
                        padding="max_length",
                        max_length=self.pipe.tokenizer.model_max_length,
                        truncation=True,
                        return_tensors="pt"
                    )
                    
                    text_embeddings = self.pipe.text_encoder(
                        text_inputs.input_ids.to(self.accelerator.device)
                    )[0]
                    
                    # Add noise to images (diffusion training)
                    noise = torch.randn_like(images)
                    timesteps = torch.randint(
                        0, self.pipe.scheduler.config.num_train_timesteps,
                        (images.shape[0],), device=images.device
                    ).long()
                    
                    noisy_images = self.pipe.scheduler.add_noise(images, noise, timesteps)
                    
                    # Predict noise
                    noise_pred = self.pipe.transformer(
                        noisy_images,
                        timesteps,
                        encoder_hidden_states=text_embeddings
                    ).sample
                    
                    # Calculate loss
                    loss = F.mse_loss(noise_pred.float(), noise.float(), reduction="mean")
                    
                    # Backward pass
                    self.accelerator.backward(loss)
                    
                    if self.accelerator.sync_gradients:
                        self.accelerator.clip_grad_norm_(self.pipe.transformer.parameters(), 1.0)
                    
                    self.optimizer.step()
                    lr_scheduler.step()
                    self.optimizer.zero_grad()
                
                # Logging
                if global_step % 50 == 0:
                    print(f"Step {global_step}/{num_training_steps}, Loss: {loss.item():.4f}, LR: {lr_scheduler.get_last_lr()[0]:.2e}")
                
                # Save checkpoint
                if global_step % self.config.get('save_steps', 500) == 0 and global_step > 0:
                    self.save_checkpoint(global_step, trigger_word)
                
                global_step += 1
                
                if global_step >= num_training_steps:
                    break
            
            if global_step >= num_training_steps:
                break
        
        # Save final model
        final_model_path = self.save_final_model(trigger_word)
        
        print(f"✅ Training completed! Model saved to: {final_model_path}")
        return final_model_path
    
    def save_checkpoint(self, step, trigger_word):
        """Save training checkpoint"""
        checkpoint_dir = os.path.join(self.output_dir, f"checkpoint-{step}")
        os.makedirs(checkpoint_dir, exist_ok=True)
        
        # Save LoRA weights
        self.pipe.transformer.save_pretrained(checkpoint_dir)
        
        print(f"💾 Checkpoint saved at step {step}")
    
    def save_final_model(self, trigger_word):
        """Save final trained model"""
        final_dir = os.path.join(self.output_dir, "final_model")
        os.makedirs(final_dir, exist_ok=True)
        
        # Save LoRA weights
        self.pipe.transformer.save_pretrained(final_dir)
        
        # Save model info
        model_info = {
            "trigger_word": trigger_word,
            "model_type": "flux_dev_lora",
            "lora_rank": self.config.get('lora_rank', 64),
            "training_steps": self.config.get('max_train_steps', 1500),
            "resolution": self.config.get('resolution', 1024),
            "max_generation_resolution": "4096x4096",
            "recommended_inference_steps": 28,
            "recommended_guidance_scale": 3.5
        }
        
        with open(os.path.join(final_dir, "model_info.json"), 'w') as f:
            json.dump(model_info, f, indent=2)
        
        # Return path to the safetensors file
        safetensors_path = os.path.join(final_dir, "adapter_model.safetensors")
        return safetensors_path