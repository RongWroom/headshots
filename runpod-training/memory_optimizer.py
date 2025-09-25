"""
Memory and GPU optimization utilities for FLUX training
Implements advanced memory management and GPU usage optimization
"""

import torch
import gc
import psutil
import GPUtil
import os
from contextlib import contextmanager
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class MemoryOptimizer:
    """Advanced memory optimization for FLUX training"""
    
    def __init__(self):
        self.initial_memory = self.get_memory_stats()
        self.peak_memory = 0
        self.optimization_enabled = True
        
    def get_memory_stats(self) -> Dict[str, float]:
        """Get current memory statistics"""
        stats = {}
        
        # GPU memory
        if torch.cuda.is_available():
            stats['gpu_allocated'] = torch.cuda.memory_allocated() / 1024**3  # GB
            stats['gpu_reserved'] = torch.cuda.memory_reserved() / 1024**3    # GB
            stats['gpu_max_allocated'] = torch.cuda.max_memory_allocated() / 1024**3  # GB
            
            # Get GPU utilization
            try:
                gpus = GPUtil.getGPUs()
                if gpus:
                    gpu = gpus[0]
                    stats['gpu_utilization'] = gpu.load * 100
                    stats['gpu_memory_used'] = gpu.memoryUsed / 1024  # GB
                    stats['gpu_memory_total'] = gpu.memoryTotal / 1024  # GB
            except:
                pass
        
        # System memory
        memory = psutil.virtual_memory()
        stats['system_memory_used'] = memory.used / 1024**3  # GB
        stats['system_memory_total'] = memory.total / 1024**3  # GB
        stats['system_memory_percent'] = memory.percent
        
        return stats
    
    def log_memory_usage(self, stage: str = ""):
        """Log current memory usage"""
        stats = self.get_memory_stats()
        
        if 'gpu_allocated' in stats:
            logger.info(f"[{stage}] GPU Memory: {stats['gpu_allocated']:.2f}GB allocated, "
                       f"{stats['gpu_reserved']:.2f}GB reserved")
        
        logger.info(f"[{stage}] System Memory: {stats['system_memory_used']:.2f}GB / "
                   f"{stats['system_memory_total']:.2f}GB ({stats['system_memory_percent']:.1f}%)")
    
    def optimize_memory_settings(self):
        """Apply optimal memory settings for FLUX training"""
        if not torch.cuda.is_available():
            return
        
        # Set memory fraction to prevent OOM
        torch.cuda.set_per_process_memory_fraction(0.85)
        
        # Enable memory efficient attention
        try:
            torch.backends.cuda.enable_flash_sdp(True)
            logger.info("✅ Flash Attention enabled")
        except:
            logger.warning("⚠️ Flash Attention not available")
        
        # Optimize CUDA settings
        torch.backends.cudnn.benchmark = True
        torch.backends.cudnn.deterministic = False
        torch.backends.cudnn.allow_tf32 = True
        torch.backends.cuda.matmul.allow_tf32 = True
        
        # Set optimal memory allocator settings
        os.environ['PYTORCH_CUDA_ALLOC_CONF'] = (
            'max_split_size_mb:256,'
            'garbage_collection_threshold:0.6,'
            'expandable_segments:True'
        )
        
        logger.info("✅ Memory optimization settings applied")
    
    def clear_memory(self, aggressive: bool = False):
        """Clear GPU and system memory"""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            if aggressive:
                torch.cuda.synchronize()
                torch.cuda.ipc_collect()
        
        # Force garbage collection
        gc.collect()
        
        if aggressive:
            # More aggressive cleanup
            import ctypes
            libc = ctypes.CDLL("libc.so.6")
            libc.malloc_trim(0)
    
    @contextmanager
    def memory_efficient_context(self, clear_cache: bool = True):
        """Context manager for memory efficient operations"""
        if clear_cache:
            self.clear_memory()
        
        initial_stats = self.get_memory_stats()
        
        try:
            yield
        finally:
            if clear_cache:
                self.clear_memory()
            
            final_stats = self.get_memory_stats()
            
            # Log memory usage change
            if 'gpu_allocated' in initial_stats and 'gpu_allocated' in final_stats:
                memory_change = final_stats['gpu_allocated'] - initial_stats['gpu_allocated']
                logger.info(f"Memory change: {memory_change:+.2f}GB GPU")
    
    def get_optimal_batch_size(self, base_batch_size: int = 1) -> int:
        """Calculate optimal batch size based on available memory"""
        if not torch.cuda.is_available():
            return base_batch_size
        
        stats = self.get_memory_stats()
        
        if 'gpu_memory_total' not in stats:
            return base_batch_size
        
        available_memory = stats['gpu_memory_total'] - stats.get('gpu_memory_used', 0)
        
        # Conservative estimation: each batch item needs ~2GB for FLUX training
        memory_per_batch = 2.0  # GB
        max_batch_size = max(1, int(available_memory * 0.7 / memory_per_batch))
        
        optimal_batch_size = min(base_batch_size, max_batch_size)
        
        logger.info(f"Optimal batch size: {optimal_batch_size} (available memory: {available_memory:.1f}GB)")
        
        return optimal_batch_size
    
    def monitor_memory_usage(self, threshold_gb: float = 0.5):
        """Monitor memory usage and warn if approaching limits"""
        stats = self.get_memory_stats()
        
        if 'gpu_memory_total' in stats:
            available_memory = stats['gpu_memory_total'] - stats.get('gpu_memory_used', 0)
            
            if available_memory < threshold_gb:
                logger.warning(f"⚠️ Low GPU memory: {available_memory:.2f}GB remaining")
                self.clear_memory(aggressive=True)
                return True
        
        if stats['system_memory_percent'] > 90:
            logger.warning(f"⚠️ High system memory usage: {stats['system_memory_percent']:.1f}%")
            self.clear_memory(aggressive=True)
            return True
        
        return False

class GPUOptimizer:
    """GPU-specific optimizations for FLUX training"""
    
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.gpu_info = self._get_gpu_info()
        
    def _get_gpu_info(self) -> Dict[str, Any]:
        """Get GPU information"""
        info = {}
        
        if torch.cuda.is_available():
            info['name'] = torch.cuda.get_device_name(0)
            info['compute_capability'] = torch.cuda.get_device_capability(0)
            info['memory_total'] = torch.cuda.get_device_properties(0).total_memory / 1024**3
            info['multi_processor_count'] = torch.cuda.get_device_properties(0).multi_processor_count
            
            logger.info(f"GPU: {info['name']}")
            logger.info(f"Compute Capability: {info['compute_capability']}")
            logger.info(f"Total Memory: {info['memory_total']:.1f}GB")
        
        return info
    
    def optimize_for_gpu(self, model: torch.nn.Module) -> torch.nn.Module:
        """Apply GPU-specific optimizations to model"""
        if not torch.cuda.is_available():
            return model
        
        # Move to GPU with optimal dtype
        if hasattr(model, 'to'):
            model = model.to(self.device, dtype=torch.bfloat16)
        
        # Enable gradient checkpointing for memory efficiency
        if hasattr(model, 'enable_gradient_checkpointing'):
            model.enable_gradient_checkpointing()
            logger.info("✅ Gradient checkpointing enabled")
        
        # Compile model for better performance (PyTorch 2.0+)
        try:
            if hasattr(torch, 'compile') and torch.__version__ >= "2.0":
                model = torch.compile(model, mode="reduce-overhead")
                logger.info("✅ Model compiled with torch.compile")
        except Exception as e:
            logger.warning(f"⚠️ Model compilation failed: {e}")
        
        return model
    
    def get_optimal_precision(self) -> str:
        """Get optimal precision for current GPU"""
        if not torch.cuda.is_available():
            return "fp32"
        
        # Check if bfloat16 is supported
        if torch.cuda.is_bf16_supported():
            return "bf16"
        elif torch.cuda.is_available():
            return "fp16"
        else:
            return "fp32"
    
    def optimize_dataloader_settings(self, num_workers: Optional[int] = None) -> Dict[str, Any]:
        """Get optimal DataLoader settings"""
        if num_workers is None:
            # Use number of CPU cores, but cap at 4 for memory efficiency
            num_workers = min(4, os.cpu_count() or 1)
        
        settings = {
            'num_workers': num_workers,
            'pin_memory': torch.cuda.is_available(),
            'persistent_workers': num_workers > 0,
            'prefetch_factor': 2 if num_workers > 0 else None,
        }
        
        logger.info(f"DataLoader settings: {settings}")
        return settings

# Global instances
memory_optimizer = MemoryOptimizer()
gpu_optimizer = GPUOptimizer()

def setup_optimizations():
    """Setup all optimizations"""
    memory_optimizer.optimize_memory_settings()
    logger.info("✅ All optimizations applied")

def cleanup_memory():
    """Cleanup memory"""
    memory_optimizer.clear_memory(aggressive=True)
    logger.info("✅ Memory cleaned up")