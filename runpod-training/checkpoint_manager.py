"""
Checkpoint management for FLUX training with resume functionality
Implements robust checkpoint saving and loading for training reliability
"""

import torch
import os
import json
import shutil
import time
from pathlib import Path
from typing import Dict, Any, Optional, List
import logging
from safetensors.torch import save_file, load_file

logger = logging.getLogger(__name__)

class CheckpointManager:
    """Advanced checkpoint management for FLUX training"""
    
    def __init__(self, checkpoint_dir: str = "/app/checkpoints", max_checkpoints: int = 3):
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.max_checkpoints = max_checkpoints
        self.metadata_file = self.checkpoint_dir / "training_metadata.json"
        
    def save_checkpoint(self, 
                       model: torch.nn.Module,
                       optimizer: torch.optim.Optimizer,
                       scheduler: Any,
                       step: int,
                       epoch: int,
                       loss: float,
                       training_config: Dict[str, Any],
                       model_name: str) -> str:
        """Save training checkpoint with all necessary state"""
        
        checkpoint_name = f"checkpoint-step-{step}"
        checkpoint_path = self.checkpoint_dir / checkpoint_name
        checkpoint_path.mkdir(exist_ok=True)
        
        try:
            logger.info(f"💾 Saving checkpoint at step {step}...")
            
            # Save model state (LoRA weights)
            if hasattr(model, 'save_pretrained'):
                model.save_pretrained(checkpoint_path / "model")
            else:
                # Fallback: save state dict
                model_state = {k: v.cpu() for k, v in model.state_dict().items() if v.requires_grad}
                save_file(model_state, checkpoint_path / "model" / "adapter_model.safetensors")
            
            # Save optimizer state
            torch.save(optimizer.state_dict(), checkpoint_path / "optimizer.pt")
            
            # Save scheduler state
            if scheduler is not None:
                torch.save(scheduler.state_dict(), checkpoint_path / "scheduler.pt")
            
            # Save training metadata
            metadata = {
                "step": step,
                "epoch": epoch,
                "loss": loss,
                "model_name": model_name,
                "training_config": training_config,
                "timestamp": time.time(),
                "pytorch_version": torch.__version__,
                "checkpoint_version": "1.0"
            }
            
            with open(checkpoint_path / "metadata.json", 'w') as f:
                json.dump(metadata, f, indent=2)
            
            # Update global metadata
            self._update_global_metadata(checkpoint_name, metadata)
            
            # Cleanup old checkpoints
            self._cleanup_old_checkpoints()
            
            logger.info(f"✅ Checkpoint saved: {checkpoint_name}")
            return str(checkpoint_path)
            
        except Exception as e:
            logger.error(f"❌ Failed to save checkpoint: {e}")
            # Cleanup partial checkpoint
            if checkpoint_path.exists():
                shutil.rmtree(checkpoint_path, ignore_errors=True)
            raise
    
    def load_checkpoint(self, checkpoint_path: str) -> Optional[Dict[str, Any]]:
        """Load checkpoint and return all state"""
        
        checkpoint_path = Path(checkpoint_path)
        
        if not checkpoint_path.exists():
            logger.warning(f"⚠️ Checkpoint not found: {checkpoint_path}")
            return None
        
        try:
            logger.info(f"📥 Loading checkpoint: {checkpoint_path.name}")
            
            # Load metadata
            metadata_file = checkpoint_path / "metadata.json"
            if not metadata_file.exists():
                logger.error("❌ Checkpoint metadata not found")
                return None
            
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
            
            # Load model state
            model_path = checkpoint_path / "model"
            model_state = None
            
            if (model_path / "adapter_model.safetensors").exists():
                model_state = load_file(model_path / "adapter_model.safetensors")
            elif (model_path / "pytorch_model.bin").exists():
                model_state = torch.load(model_path / "pytorch_model.bin", map_location="cpu")
            
            # Load optimizer state
            optimizer_state = None
            optimizer_file = checkpoint_path / "optimizer.pt"
            if optimizer_file.exists():
                optimizer_state = torch.load(optimizer_file, map_location="cpu")
            
            # Load scheduler state
            scheduler_state = None
            scheduler_file = checkpoint_path / "scheduler.pt"
            if scheduler_file.exists():
                scheduler_state = torch.load(scheduler_file, map_location="cpu")
            
            checkpoint_data = {
                "metadata": metadata,
                "model_state": model_state,
                "optimizer_state": optimizer_state,
                "scheduler_state": scheduler_state,
                "step": metadata["step"],
                "epoch": metadata["epoch"],
                "loss": metadata["loss"],
                "training_config": metadata["training_config"]
            }
            
            logger.info(f"✅ Checkpoint loaded: step {metadata['step']}, loss {metadata['loss']:.4f}")
            return checkpoint_data
            
        except Exception as e:
            logger.error(f"❌ Failed to load checkpoint: {e}")
            return None
    
    def find_latest_checkpoint(self, model_name: Optional[str] = None) -> Optional[str]:
        """Find the latest checkpoint for resuming training"""
        
        if not self.metadata_file.exists():
            return None
        
        try:
            with open(self.metadata_file, 'r') as f:
                global_metadata = json.load(f)
            
            checkpoints = global_metadata.get("checkpoints", [])
            
            if model_name:
                # Filter by model name
                checkpoints = [cp for cp in checkpoints if cp.get("model_name") == model_name]
            
            if not checkpoints:
                return None
            
            # Sort by step (latest first)
            checkpoints.sort(key=lambda x: x.get("step", 0), reverse=True)
            latest = checkpoints[0]
            
            checkpoint_path = self.checkpoint_dir / latest["checkpoint_name"]
            
            if checkpoint_path.exists():
                logger.info(f"📍 Found latest checkpoint: {latest['checkpoint_name']} (step {latest['step']})")
                return str(checkpoint_path)
            else:
                logger.warning(f"⚠️ Latest checkpoint path not found: {checkpoint_path}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to find latest checkpoint: {e}")
            return None
    
    def list_checkpoints(self) -> List[Dict[str, Any]]:
        """List all available checkpoints"""
        
        if not self.metadata_file.exists():
            return []
        
        try:
            with open(self.metadata_file, 'r') as f:
                global_metadata = json.load(f)
            
            checkpoints = global_metadata.get("checkpoints", [])
            
            # Verify checkpoints still exist
            valid_checkpoints = []
            for cp in checkpoints:
                checkpoint_path = self.checkpoint_dir / cp["checkpoint_name"]
                if checkpoint_path.exists():
                    valid_checkpoints.append(cp)
            
            # Sort by step
            valid_checkpoints.sort(key=lambda x: x.get("step", 0), reverse=True)
            
            return valid_checkpoints
            
        except Exception as e:
            logger.error(f"❌ Failed to list checkpoints: {e}")
            return []
    
    def resume_training_from_checkpoint(self, 
                                      model: torch.nn.Module,
                                      optimizer: torch.optim.Optimizer,
                                      scheduler: Any,
                                      checkpoint_path: Optional[str] = None,
                                      model_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Resume training from checkpoint"""
        
        if checkpoint_path is None:
            checkpoint_path = self.find_latest_checkpoint(model_name)
        
        if checkpoint_path is None:
            logger.info("📍 No checkpoint found, starting fresh training")
            return None
        
        checkpoint_data = self.load_checkpoint(checkpoint_path)
        
        if checkpoint_data is None:
            logger.warning("⚠️ Failed to load checkpoint, starting fresh training")
            return None
        
        try:
            # Restore model state
            if checkpoint_data["model_state"] and hasattr(model, 'load_state_dict'):
                model.load_state_dict(checkpoint_data["model_state"], strict=False)
                logger.info("✅ Model state restored")
            
            # Restore optimizer state
            if checkpoint_data["optimizer_state"]:
                optimizer.load_state_dict(checkpoint_data["optimizer_state"])
                logger.info("✅ Optimizer state restored")
            
            # Restore scheduler state
            if checkpoint_data["scheduler_state"] and scheduler is not None:
                scheduler.load_state_dict(checkpoint_data["scheduler_state"])
                logger.info("✅ Scheduler state restored")
            
            logger.info(f"🔄 Training resumed from step {checkpoint_data['step']}")
            return checkpoint_data
            
        except Exception as e:
            logger.error(f"❌ Failed to resume from checkpoint: {e}")
            return None
    
    def _update_global_metadata(self, checkpoint_name: str, metadata: Dict[str, Any]):
        """Update global metadata file"""
        
        global_metadata = {"checkpoints": []}
        
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r') as f:
                    global_metadata = json.load(f)
            except:
                pass
        
        # Add new checkpoint
        checkpoint_entry = {
            "checkpoint_name": checkpoint_name,
            "step": metadata["step"],
            "epoch": metadata["epoch"],
            "loss": metadata["loss"],
            "model_name": metadata["model_name"],
            "timestamp": metadata["timestamp"]
        }
        
        global_metadata["checkpoints"].append(checkpoint_entry)
        
        # Sort by step
        global_metadata["checkpoints"].sort(key=lambda x: x["step"], reverse=True)
        
        # Save updated metadata
        with open(self.metadata_file, 'w') as f:
            json.dump(global_metadata, f, indent=2)
    
    def _cleanup_old_checkpoints(self):
        """Remove old checkpoints to save disk space"""
        
        checkpoints = self.list_checkpoints()
        
        if len(checkpoints) <= self.max_checkpoints:
            return
        
        # Remove oldest checkpoints
        checkpoints_to_remove = checkpoints[self.max_checkpoints:]
        
        for cp in checkpoints_to_remove:
            checkpoint_path = self.checkpoint_dir / cp["checkpoint_name"]
            
            if checkpoint_path.exists():
                try:
                    shutil.rmtree(checkpoint_path)
                    logger.info(f"🗑️ Removed old checkpoint: {cp['checkpoint_name']}")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to remove checkpoint {cp['checkpoint_name']}: {e}")
        
        # Update global metadata
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r') as f:
                    global_metadata = json.load(f)
                
                # Keep only recent checkpoints in metadata
                global_metadata["checkpoints"] = checkpoints[:self.max_checkpoints]
                
                with open(self.metadata_file, 'w') as f:
                    json.dump(global_metadata, f, indent=2)
                    
            except Exception as e:
                logger.warning(f"⚠️ Failed to update global metadata: {e}")
    
    def get_checkpoint_info(self, checkpoint_path: str) -> Optional[Dict[str, Any]]:
        """Get checkpoint information without loading full state"""
        
        checkpoint_path = Path(checkpoint_path)
        metadata_file = checkpoint_path / "metadata.json"
        
        if not metadata_file.exists():
            return None
        
        try:
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
            
            # Add file size information
            total_size = 0
            for file_path in checkpoint_path.rglob("*"):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
            
            metadata["checkpoint_size_mb"] = total_size / (1024 * 1024)
            
            return metadata
            
        except Exception as e:
            logger.error(f"❌ Failed to get checkpoint info: {e}")
            return None