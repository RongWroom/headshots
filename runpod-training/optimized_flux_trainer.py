"""
Optimized FLUX Dev LoRA trainer with memory optimization, checkpointing, and fast preprocessing
Implements all performance optimizations for production training
"""

import torch
import torch.nn.functional as F
from diffusers import FluxPipeline, FluxSchedulerMixin
from diffusers.optimization import get_scheduler
from peft import LoraConfig, get_peft_model, TaskType
from PIL import Image
import os
import json
import numpy as np
from torch.utils.data import Dataset, DataLoader
from accelerate import Accelerator
import random
import logging
from typing import List, Dict, Any, Optional
import requests
from io import BytesIO
import time

from memory_optimizer import memory_optimizer, gpu_optimizer, setup_optimizations, cleanup_memory
from checkpoint_manager import CheckpointManager
from optimized_face_processor import OptimizedFaceProcessor

logger = logging.getLogger(__name__)

class OptimizedHeadshotDataset(Dataset):
    """Optimized dataset with efficient data loading"""
    
    def __init__(self, processed_images: List[Dict[str, Any]], trigger_word: str, style_prompt: str):
        self.processed_images = processed_images
        self.trigger_word = trigger_word
        self.style_prompt = style_prompt
        
        # Pre-generate prompts for efficiency
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
        
        # Create dataset entries
        self.dataset_entries = []
        for img_data in processed_images:
            for prompt in self.prompt_templates:
                self.dataset_entries.append({
                    "image": img_data["image"],
                    "prompt": prompt,
                    "quality_score": img_data["quality_score"]
                })
        
        logger.info(f"📊 Dataset created: {len(self.dataset_entries)} training samples")
    
    def __len__(self):
        return len(self.dataset_entries)
    
    def __getitem__(self, idx):
        entry = self.dataset_entries[idx]
        
        # Image is already preprocessed and normalized
        image_tensor = entry["image"]
        
        # Ensure tensor is in correct format
        if isinstance(image_tensor, np.ndarray):
            image_tensor = torch.from_numpy(image_tensor).float()
        
        # Ensure CHW format
        if image_tensor.dim() == 3 and image_tensor.shape[0] != 3:
            image_tensor = image_tensor.permute(2, 0, 1)
        
        return {
            'image': image_tensor,
            'prompt': entry["prompt"],
            'quality_score': entry["quality_score"]
        }

class OptimizedFluxTrainer:
    """Optimized FLUX Dev LoRA trainer with all performance improvements"""
    
    def __init__(self, model_name: str, output_dir: str, **config):
        self.model_name = model_name
        self.output_dir = output_dir
        self.config = config
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        
        # Initialize components
        self.checkpoint_manager = CheckpointManager(
            checkpoint_dir=os.path.join(output_dir, "checkpoints"),
            max_checkpoints=config.get('max_checkpoints', 3)
        )
        
        self.face_processor = OptimizedFaceProcessor(
            cache_dir="/app/cache",
            max_workers=config.get('preprocessing_workers', 4)
        )
        
        # Setup optimizations
        setup_optimizations()
        
        # Initialize accelerator with optimal settings
        self.accelerator = Accelerator(
            mixed_precision=gpu_optimizer.get_optimal_precision(),
            gradient_accumulation_steps=config.get('gradient_accumulation_steps', 4),
            log_with="tensorboard" if config.get('enable_logging', True) else None,
            project_dir=output_dir
        )
        
        logger.info(f"🔧 Trainer initialized with device: {self.accelerator.device}")
        memory_optimizer.log_memory_usage("Initialization")
    
    def download_image(self, url: str) -> Optional[Image.Image]:
        """Download image with error handling"""
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return Image.open(BytesIO(response.content)).convert('RGB')
        except Exception as e:
            logger.error(f"❌ Failed to download {url}: {e}")
            return None
    
    def load_and_optimize_models(self):
        """Load FLUX pipeline with optimizations"""
        logger.info("📥 Loading FLUX Dev model with optimizations...")
        
        with memory_optimizer.memory_efficient_context():
            # Load pipeline with optimal settings
            self.pipe = FluxPipeline.from_pretrained(
                self.model_name,
                torch_dtype=torch.bfloat16 if gpu_optimizer.get_optimal_precision() == "bf16" else torch.float16,
                use_safetensors=True,
                variant="fp16" if gpu_optimizer.get_optimal_precision() != "bf16" else None
            )
            
            # Apply GPU optimizations
            self.pipe = gpu_optimizer.optimize_for_gpu(self.pipe)
            
            # Configure LoRA
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
            
            # Apply LoRA to transformer
            self.pipe.transformer = get_peft_model(self.pipe.transformer, lora_config)
            
            # Enable training mode for LoRA layers only
            self.pipe.transformer.train()
            for param in self.pipe.transformer.parameters():
                param.requires_grad = False
            for param in self.pipe.transformer.peft_modules():
                param.requires_grad = True
            
            logger.info(f"✅ LoRA applied with rank {lora_config.r}")
            
            # Setup optimizer with memory optimization
            trainable_params = [p for p in self.pipe.transformer.parameters() if p.requires_grad]
            
            if self.config.get('use_8bit_adam', True):
                try:
                    import bitsandbytes as bnb
                    self.optimizer = bnb.optim.AdamW8bit(
                        trainable_params,
                        lr=self.config.get('learning_rate', 1e-4),
                        betas=(0.9, 0.999),
                        weight_decay=self.config.get('weight_decay', 0.01),
                        eps=1e-8
                    )
                    logger.info("✅ Using 8-bit AdamW optimizer")
                except ImportError:
                    self.optimizer = torch.optim.AdamW(
                        trainable_params,
                        lr=self.config.get('learning_rate', 1e-4),
                        betas=(0.9, 0.999),
                        weight_decay=self.config.get('weight_decay', 0.01),
                        eps=1e-8
                    )
                    logger.info("✅ Using standard AdamW optimizer")
            else:
                self.optimizer = torch.optim.AdamW(
                    trainable_params,
                    lr=self.config.get('learning_rate', 1e-4),
                    betas=(0.9, 0.999),
                    weight_decay=self.config.get('weight_decay', 0.01),
                    eps=1e-8
                )
            
            logger.info(f"📊 Trainable parameters: {sum(p.numel() for p in trainable_params):,}")
            memory_optimizer.log_memory_usage("Model Loading")
    
    def prepare_training_data(self, image_urls: List[str], trigger_word: str, style_prompt: str) -> OptimizedHeadshotDataset:
        """Prepare training data with optimized preprocessing"""
        logger.info(f"🎯 Preparing training data for {len(image_urls)} images...")
        
        # Process images in parallel
        processed_images = self.face_processor.process_images_parallel(
            image_urls, self.download_image
        )
        
        if len(processed_images) < 5:
            raise ValueError(f"Insufficient valid images: {len(processed_images)}/5 minimum required")
        
        # Create optimized dataset
        dataset = OptimizedHeadshotDataset(processed_images, trigger_word, style_prompt)
        
        logger.info(f"✅ Training data prepared: {len(dataset)} samples")
        return dataset
    
    def train(self, image_urls: List[str], trigger_word: str, style_prompt: str, 
              resume_from_checkpoint: bool = True) -> str:
        """Train optimized LoRA model"""
        logger.info(f"🚀 Starting optimized FLUX training...")
        logger.info(f"  Model: {self.model_name}")
        logger.info(f"  Trigger: {trigger_word}")
        logger.info(f"  Style: {style_prompt}")
        logger.info(f"  Images: {len(image_urls)}")
        
        start_time = time.time()
        
        # Load models
        self.load_and_optimize_models()
        
        # Prepare training data
        dataset = self.prepare_training_data(image_urls, trigger_word, style_prompt)
        
        # Create optimized dataloader
        dataloader_settings = gpu_optimizer.optimize_dataloader_settings()
        dataloader = DataLoader(
            dataset,
            batch_size=memory_optimizer.get_optimal_batch_size(self.config.get('train_batch_size', 1)),
            shuffle=True,
            **dataloader_settings
        )
        
        # Setup scheduler
        num_training_steps = self.config.get('max_train_steps', 1500)
        lr_scheduler = get_scheduler(
            self.config.get('scheduler_type', 'cosine'),
            optimizer=self.optimizer,
            num_warmup_steps=self.config.get('warmup_steps', 150),
            num_training_steps=num_training_steps
        )
        
        # Prepare for training with accelerator
        self.pipe.transformer, self.optimizer, dataloader, lr_scheduler = self.accelerator.prepare(
            self.pipe.transformer, self.optimizer, dataloader, lr_scheduler
        )
        
        # Try to resume from checkpoint
        start_step = 0
        start_epoch = 0
        
        if resume_from_checkpoint:
            checkpoint_data = self.checkpoint_manager.resume_training_from_checkpoint(
                self.pipe.transformer, self.optimizer, lr_scheduler, model_name=trigger_word
            )
            
            if checkpoint_data:
                start_step = checkpoint_data['step']
                start_epoch = checkpoint_data['epoch']
                logger.info(f"🔄 Resumed from step {start_step}")
        
        # Training loop with optimizations
        global_step = start_step
        current_epoch = start_epoch
        
        logger.info(f"🎯 Training from step {start_step} to {num_training_steps}")
        
        for epoch in range(current_epoch, 100):  # Large number, will break when steps reached
            if global_step >= num_training_steps:
                break
            
            epoch_start_time = time.time()
            
            for batch_idx, batch in enumerate(dataloader):
                if global_step >= num_training_steps:
                    break
                
                with self.accelerator.accumulate(self.pipe.transformer):
                    # Get batch data
                    images = batch['image']
                    prompts = batch['prompt']
                    
                    # Encode prompts efficiently
                    with torch.no_grad():
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
                    
                    # Add noise for diffusion training
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
                        self.accelerator.clip_grad_norm_(
                            self.pipe.transformer.parameters(), 
                            self.config.get('max_grad_norm', 1.0)
                        )
                    
                    self.optimizer.step()
                    lr_scheduler.step()
                    self.optimizer.zero_grad()
                
                # Logging and checkpointing
                if global_step % 50 == 0:
                    elapsed_time = time.time() - start_time
                    steps_per_sec = (global_step - start_step) / elapsed_time if elapsed_time > 0 else 0
                    eta_seconds = (num_training_steps - global_step) / steps_per_sec if steps_per_sec > 0 else 0
                    
                    logger.info(f"Step {global_step}/{num_training_steps} | "
                              f"Loss: {loss.item():.4f} | "
                              f"LR: {lr_scheduler.get_last_lr()[0]:.2e} | "
                              f"Speed: {steps_per_sec:.2f} steps/s | "
                              f"ETA: {eta_seconds/60:.1f}min")
                    
                    # Memory monitoring
                    if memory_optimizer.monitor_memory_usage():
                        logger.info("🧹 Memory cleanup performed")
                
                # Save checkpoint
                if global_step % self.config.get('save_steps', 500) == 0 and global_step > start_step:
                    try:
                        self.checkpoint_manager.save_checkpoint(
                            model=self.pipe.transformer,
                            optimizer=self.optimizer,
                            scheduler=lr_scheduler,
                            step=global_step,
                            epoch=current_epoch,
                            loss=loss.item(),
                            training_config=self.config,
                            model_name=trigger_word
                        )
                    except Exception as e:
                        logger.warning(f"⚠️ Failed to save checkpoint: {e}")
                
                global_step += 1
            
            current_epoch += 1
            epoch_time = time.time() - epoch_start_time
            logger.info(f"✅ Epoch {current_epoch} completed in {epoch_time:.1f}s")
        
        # Save final model
        final_model_path = self.save_final_model(trigger_word, global_step)
        
        # Cleanup
        cleanup_memory()
        
        total_time = time.time() - start_time
        logger.info(f"✅ Training completed in {total_time/60:.1f} minutes!")
        logger.info(f"📁 Model saved to: {final_model_path}")
        
        return final_model_path
    
    def save_final_model(self, trigger_word: str, final_step: int) -> str:
        """Save final trained model with metadata"""
        final_dir = os.path.join(self.output_dir, "final_model")
        os.makedirs(final_dir, exist_ok=True)
        
        # Save LoRA weights
        self.pipe.transformer.save_pretrained(final_dir)
        
        # Save comprehensive model info
        model_info = {
            "trigger_word": trigger_word,
            "model_type": "flux_dev_lora_optimized",
            "lora_rank": self.config.get('lora_rank', 64),
            "training_steps": final_step,
            "resolution": self.config.get('resolution', 1024),
            "max_generation_resolution": "4096x4096",
            "recommended_inference_steps": 28,
            "recommended_guidance_scale": 3.5,
            "optimization_features": [
                "memory_optimization",
                "checkpoint_resume",
                "fast_preprocessing",
                "parallel_data_loading",
                "8bit_optimizer",
                "gradient_checkpointing"
            ],
            "training_config": self.config,
            "performance_stats": memory_optimizer.get_memory_stats()
        }
        
        with open(os.path.join(final_dir, "model_info.json"), 'w') as f:
            json.dump(model_info, f, indent=2)
        
        # Return path to the safetensors file
        safetensors_path = os.path.join(final_dir, "adapter_model.safetensors")
        return safetensors_path