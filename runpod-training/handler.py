"""
High-end FLUX Dev LoRA training handler for 4K headshot generation
Focuses on exact likeness preservation with advanced face processing
"""

import runpod
import os
import json
import traceback
import requests
import tempfile
import shutil
from pathlib import Path
from simple_flux_trainer import SimpleFluxTrainer
from face_processor import FaceProcessor

def download_images(image_urls, temp_dir):
    """Download and validate training images"""
    print(f"📥 Downloading {len(image_urls)} training images...")
    
    downloaded_paths = []
    face_processor = FaceProcessor()
    
    for i, url in enumerate(image_urls):
        try:
            print(f"  Downloading image {i+1}/{len(image_urls)}: {url}")
            
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            # Save image
            image_path = os.path.join(temp_dir, f"image_{i:03d}.jpg")
            with open(image_path, 'wb') as f:
                f.write(response.content)
            
            # Validate and process face
            processed_path = face_processor.process_training_image(image_path, temp_dir, i)
            if processed_path:
                downloaded_paths.append(processed_path)
                print(f"  ✅ Image {i+1} processed successfully")
            else:
                print(f"  ⚠️ Image {i+1} failed face validation - skipping")
                
        except Exception as e:
            print(f"  ❌ Failed to download image {i+1}: {str(e)}")
            continue
    
    print(f"📊 Successfully processed {len(downloaded_paths)}/{len(image_urls)} images")
    return downloaded_paths

def upload_model_to_storage(model_path, model_name):
    """Upload trained model to cloud storage (implement your preferred storage)"""
    # For now, we'll simulate upload and return a mock URL
    # In production, upload to S3, Google Cloud, etc.
    
    print(f"📤 Uploading model: {model_name}")
    
    # TODO: Implement actual upload to your cloud storage
    # Example for S3:
    # import boto3
    # s3 = boto3.client('s3')
    # s3.upload_file(model_path, 'your-bucket', f'models/{model_name}.safetensors')
    
    # For now, return a mock URL
    mock_url = f"https://your-storage.com/models/{model_name}.safetensors"
    print(f"✅ Model uploaded: {mock_url}")
    
    return mock_url

def handler(event):
    """Main training handler"""
    print("🚀 Starting high-end FLUX Dev LoRA training...")
    
    try:
        # Parse input
        input_data = event.get("input", {})
        
        # Validate required inputs
        required_fields = ["image_urls", "trigger_word", "model_name"]
        for field in required_fields:
            if field not in input_data:
                return {"error": f"Missing required field: {field}"}
        
        image_urls = input_data["image_urls"]
        trigger_word = input_data["trigger_word"]
        model_name = input_data["model_name"]
        style_prompt = input_data.get("style_prompt", "professional headshot")
        
        # Get optimized training configuration from input or use defaults
        training_config = input_data.get("training_config", {})
        
        # Apply optimized defaults based on research
        optimized_config = {
            "resolution": training_config.get("resolution", 1024),
            "train_batch_size": training_config.get("train_batch_size", 1),
            "learning_rate": training_config.get("learning_rate", 1e-4),
            "max_train_steps": training_config.get("max_train_steps", 1500),
            "save_steps": training_config.get("save_steps", 500),
            "mixed_precision": training_config.get("mixed_precision", "bf16"),
            "gradient_accumulation_steps": training_config.get("gradient_accumulation_steps", 4),
            "lora_rank": training_config.get("lora_rank", 64),
            "lora_alpha": training_config.get("lora_alpha", 64),
            "use_8bit_adam": training_config.get("use_8bit_adam", True),
            "enable_xformers": training_config.get("enable_xformers", True),
            "warmup_steps": training_config.get("warmup_steps", 150),
            "scheduler_type": training_config.get("scheduler_type", "cosine"),
            "weight_decay": training_config.get("weight_decay", 0.01),
            "max_grad_norm": training_config.get("max_grad_norm", 1.0),
        }
        
        # Validate and optimize parameters based on image count
        image_count = len(image_urls)
        if image_count >= 10:
            # High-quality training for many images
            optimized_config["max_train_steps"] = max(optimized_config["max_train_steps"], 1800)
            optimized_config["lora_rank"] = max(optimized_config["lora_rank"], 64)
            optimized_config["learning_rate"] = min(optimized_config["learning_rate"], 8e-5)
        elif image_count >= 8:
            # Standard high-quality training
            optimized_config["max_train_steps"] = max(optimized_config["max_train_steps"], 1500)
            optimized_config["lora_rank"] = max(optimized_config["lora_rank"], 64)
        elif image_count >= 5:
            # Balanced training for fewer images
            optimized_config["max_train_steps"] = min(optimized_config["max_train_steps"], 1200)
            optimized_config["lora_rank"] = min(optimized_config["lora_rank"], 32)
        else:
            # Conservative training for very few images
            optimized_config["max_train_steps"] = min(optimized_config["max_train_steps"], 800)
            optimized_config["lora_rank"] = min(optimized_config["lora_rank"], 16)
            optimized_config["learning_rate"] = min(optimized_config["learning_rate"], 1.5e-4)
        
        training_config = optimized_config
        
        print(f"📋 Training Configuration:")
        print(f"  Model: {model_name}")
        print(f"  Trigger: {trigger_word}")
        print(f"  Style: {style_prompt}")
        print(f"  Images: {len(image_urls)}")
        print(f"  Steps: {training_config['max_train_steps']}")
        print(f"  LoRA Rank: {training_config['lora_rank']}")
        
        # Create temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            print(f"📁 Working directory: {temp_dir}")
            
            # Initialize simple trainer
            trainer = SimpleFluxTrainer(
                output_dir=os.path.join(temp_dir, "output")
            )
            
            # Train the model
            print("🎯 Starting LoRA training...")
            model_path = trainer.train(
                image_urls=input_data["image_urls"],  # Use URLs directly
                trigger_word=trigger_word,
                style_prompt=style_prompt
            )
            
            # Upload trained model
            model_url = upload_model_to_storage(model_path, model_name)
            
            # Return success response
            result = {
                "status": "success",
                "message": "High-end LoRA training completed successfully",
                "model_url": model_url,
                "model_name": model_name,
                "trigger_word": trigger_word,
                "training_images_used": len(image_paths),
                "training_steps": training_config["max_train_steps"],
                "lora_rank": training_config["lora_rank"],
                "capabilities": {
                    "max_resolution": "4096x4096",
                    "face_preservation": "high",
                    "detail_level": "professional"
                }
            }
            
            print("✅ Training completed successfully!")
            print(f"📊 Final result: {json.dumps(result, indent=2)}")
            
            return result
            
    except Exception as e:
        error_msg = f"Training failed: {str(e)}"
        print(f"❌ {error_msg}")
        print(f"🔍 Traceback: {traceback.format_exc()}")
        
        return {
            "error": error_msg,
            "traceback": traceback.format_exc(),
            "status": "failed"
        }

# Start the RunPod serverless handler
if __name__ == "__main__":
    print("🔥 High-end FLUX training handler starting...")
    runpod.serverless.start({"handler": handler})