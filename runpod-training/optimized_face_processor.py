"""
Optimized face processing for faster training startup
Implements efficient image preprocessing with caching and parallel processing
"""

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import os
import hashlib
import pickle
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import albumentations as A
from albumentations.pytorch import ToTensorV2
import torch

logger = logging.getLogger(__name__)

class OptimizedFaceProcessor:
    """Optimized face processor with caching and parallel processing"""
    
    def __init__(self, cache_dir: str = "/app/cache", max_workers: int = 4):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_workers = max_workers
        
        # Initialize face detection
        self.face_cascade = self._load_face_cascade()
        
        # Setup image preprocessing pipeline
        self.preprocessing_pipeline = self._create_preprocessing_pipeline()
        
        # Cache for processed images
        self.image_cache = {}
        
    def _load_face_cascade(self) -> cv2.CascadeClassifier:
        """Load face detection cascade with fallback"""
        cascade_paths = [
            "/app/haarcascade_frontalface_default.xml",
            "/usr/share/opencv4/haarcascades/haarcascade_frontalface_default.xml",
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        ]
        
        for path in cascade_paths:
            if os.path.exists(path):
                cascade = cv2.CascadeClassifier(path)
                if not cascade.empty():
                    logger.info(f"✅ Face cascade loaded from: {path}")
                    return cascade
        
        # Download if not found
        try:
            import urllib.request
            url = 'https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml'
            cascade_path = "/app/haarcascade_frontalface_default.xml"
            urllib.request.urlretrieve(url, cascade_path)
            cascade = cv2.CascadeClassifier(cascade_path)
            logger.info("✅ Face cascade downloaded and loaded")
            return cascade
        except Exception as e:
            logger.error(f"❌ Failed to load face cascade: {e}")
            return cv2.CascadeClassifier()  # Empty cascade
    
    def _create_preprocessing_pipeline(self) -> A.Compose:
        """Create optimized preprocessing pipeline using Albumentations"""
        return A.Compose([
            A.Resize(1024, 1024, interpolation=cv2.INTER_LANCZOS4),
            A.OneOf([
                A.CLAHE(clip_limit=2.0, tile_grid_size=(8, 8), p=0.3),
                A.RandomBrightnessContrast(brightness_limit=0.1, contrast_limit=0.1, p=0.3),
                A.HueSaturationValue(hue_shift_limit=5, sat_shift_limit=10, val_shift_limit=10, p=0.2),
            ], p=0.5),
            A.OneOf([
                A.GaussianBlur(blur_limit=(1, 3), p=0.2),
                A.Sharpen(alpha=(0.1, 0.3), lightness=(0.8, 1.2), p=0.2),
            ], p=0.3),
            A.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
        ])
    
    def _get_image_hash(self, image_url: str) -> str:
        """Generate hash for image caching"""
        return hashlib.md5(image_url.encode()).hexdigest()
    
    def _load_from_cache(self, image_hash: str) -> Optional[Dict[str, Any]]:
        """Load processed image from cache"""
        cache_file = self.cache_dir / f"{image_hash}.pkl"
        
        if cache_file.exists():
            try:
                with open(cache_file, 'rb') as f:
                    cached_data = pickle.load(f)
                logger.debug(f"📦 Loaded from cache: {image_hash}")
                return cached_data
            except Exception as e:
                logger.warning(f"⚠️ Failed to load cache {image_hash}: {e}")
                cache_file.unlink(missing_ok=True)
        
        return None
    
    def _save_to_cache(self, image_hash: str, data: Dict[str, Any]):
        """Save processed image to cache"""
        cache_file = self.cache_dir / f"{image_hash}.pkl"
        
        try:
            with open(cache_file, 'wb') as f:
                pickle.dump(data, f)
            logger.debug(f"💾 Saved to cache: {image_hash}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to save cache {image_hash}: {e}")
    
    def detect_faces_fast(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """Fast face detection with optimized parameters"""
        if self.face_cascade.empty():
            return []
        
        # Convert to grayscale for detection
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY) if len(image.shape) == 3 else image
        
        # Apply histogram equalization for better detection
        gray = cv2.equalizeHist(gray)
        
        # Multi-scale detection for better accuracy
        faces = []
        
        # Primary detection
        detected = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(80, 80),
            maxSize=(500, 500),
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        faces.extend(detected)
        
        # Secondary detection with different parameters if no faces found
        if len(faces) == 0:
            detected = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.05,
                minNeighbors=3,
                minSize=(60, 60),
                maxSize=(600, 600),
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            faces.extend(detected)
        
        return faces
    
    def validate_image_quality_fast(self, image: np.ndarray) -> Dict[str, Any]:
        """Fast image quality validation"""
        height, width = image.shape[:2]
        
        # Basic size check
        if width < 256 or height < 256:
            return {"valid": False, "reason": "Image too small", "score": 0.0}
        
        # Convert to grayscale for analysis
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY) if len(image.shape) == 3 else image
        
        # Blur detection using Laplacian variance
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # Brightness analysis
        brightness = np.mean(gray)
        
        # Contrast analysis
        contrast = np.std(gray)
        
        # Calculate overall quality score
        quality_score = 0.0
        
        # Blur score (higher is better)
        if blur_score > 500:
            quality_score += 0.4
        elif blur_score > 200:
            quality_score += 0.2
        
        # Brightness score (optimal range 80-180)
        if 80 <= brightness <= 180:
            quality_score += 0.3
        elif 60 <= brightness <= 200:
            quality_score += 0.15
        
        # Contrast score (higher is better, up to a point)
        if contrast > 40:
            quality_score += 0.3
        elif contrast > 20:
            quality_score += 0.15
        
        is_valid = quality_score >= 0.5
        
        return {
            "valid": is_valid,
            "score": quality_score,
            "blur_score": blur_score,
            "brightness": brightness,
            "contrast": contrast,
            "reason": "Good quality" if is_valid else "Poor quality"
        }
    
    def crop_face_smart(self, image: np.ndarray, faces: List[Tuple[int, int, int, int]], 
                       target_size: int = 1024, padding: float = 0.4) -> np.ndarray:
        """Smart face cropping with optimal framing"""
        if not faces:
            # No face detected, return center crop
            h, w = image.shape[:2]
            size = min(h, w)
            start_x = (w - size) // 2
            start_y = (h - size) // 2
            cropped = image[start_y:start_y + size, start_x:start_x + size]
            return cv2.resize(cropped, (target_size, target_size), interpolation=cv2.INTER_LANCZOS4)
        
        # Use the largest face
        face = max(faces, key=lambda f: f[2] * f[3])
        x, y, w, h = face
        
        # Calculate crop region with padding
        face_center_x = x + w // 2
        face_center_y = y + h // 2
        
        # Determine crop size (larger of face dimensions with padding)
        crop_size = int(max(w, h) * (1 + padding * 2))
        
        # Ensure crop size is reasonable
        img_h, img_w = image.shape[:2]
        crop_size = min(crop_size, min(img_h, img_w))
        
        # Calculate crop coordinates
        crop_x1 = max(0, face_center_x - crop_size // 2)
        crop_y1 = max(0, face_center_y - crop_size // 2)
        crop_x2 = min(img_w, crop_x1 + crop_size)
        crop_y2 = min(img_h, crop_y1 + crop_size)
        
        # Adjust if crop goes out of bounds
        if crop_x2 - crop_x1 < crop_size:
            crop_x1 = max(0, crop_x2 - crop_size)
        if crop_y2 - crop_y1 < crop_size:
            crop_y1 = max(0, crop_y2 - crop_size)
        
        # Crop the image
        cropped = image[crop_y1:crop_y2, crop_x1:crop_x2]
        
        # Resize to target size
        return cv2.resize(cropped, (target_size, target_size), interpolation=cv2.INTER_LANCZOS4)
    
    def enhance_image_fast(self, image: np.ndarray) -> np.ndarray:
        """Fast image enhancement"""
        # Convert to PIL for enhancement
        pil_image = Image.fromarray(image)
        
        # Subtle sharpening
        enhancer = ImageEnhance.Sharpness(pil_image)
        pil_image = enhancer.enhance(1.1)
        
        # Slight contrast boost
        enhancer = ImageEnhance.Contrast(pil_image)
        pil_image = enhancer.enhance(1.05)
        
        # Convert back to numpy
        return np.array(pil_image)
    
    def process_single_image(self, image_url: str, download_func) -> Optional[Dict[str, Any]]:
        """Process a single image with caching"""
        image_hash = self._get_image_hash(image_url)
        
        # Check cache first
        cached_data = self._load_from_cache(image_hash)
        if cached_data:
            return cached_data
        
        try:
            # Download image
            image_data = download_func(image_url)
            if image_data is None:
                return None
            
            # Convert to numpy array
            image = np.array(image_data)
            
            # Validate quality
            quality_info = self.validate_image_quality_fast(image)
            if not quality_info["valid"]:
                logger.warning(f"⚠️ Image quality check failed: {quality_info['reason']}")
                return None
            
            # Detect faces
            faces = self.detect_faces_fast(image)
            
            # Crop and enhance
            if faces:
                processed_image = self.crop_face_smart(image, faces)
                processed_image = self.enhance_image_fast(processed_image)
            else:
                # No face detected, use center crop with enhancement
                h, w = image.shape[:2]
                size = min(h, w)
                start_x = (w - size) // 2
                start_y = (h - size) // 2
                cropped = image[start_y:start_y + size, start_x:start_x + size]
                processed_image = cv2.resize(cropped, (1024, 1024), interpolation=cv2.INTER_LANCZOS4)
                processed_image = self.enhance_image_fast(processed_image)
            
            # Apply preprocessing pipeline
            augmented = self.preprocessing_pipeline(image=processed_image)
            final_image = augmented['image']
            
            # Prepare result
            result = {
                "image": final_image,
                "original_size": image.shape[:2],
                "faces_detected": len(faces),
                "quality_score": quality_info["score"],
                "processed": True
            }
            
            # Cache the result
            self._save_to_cache(image_hash, result)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Failed to process image {image_url}: {e}")
            return None
    
    def process_images_parallel(self, image_urls: List[str], download_func) -> List[Dict[str, Any]]:
        """Process multiple images in parallel"""
        logger.info(f"🚀 Processing {len(image_urls)} images in parallel...")
        
        processed_images = []
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all tasks
            future_to_url = {
                executor.submit(self.process_single_image, url, download_func): url 
                for url in image_urls
            }
            
            # Collect results
            for future in as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    result = future.result()
                    if result:
                        processed_images.append(result)
                        logger.info(f"✅ Processed image: {len(processed_images)}/{len(image_urls)}")
                    else:
                        logger.warning(f"⚠️ Failed to process: {url}")
                except Exception as e:
                    logger.error(f"❌ Error processing {url}: {e}")
        
        logger.info(f"✅ Successfully processed {len(processed_images)}/{len(image_urls)} images")
        return processed_images
    
    def create_training_dataset(self, processed_images: List[Dict[str, Any]], 
                              trigger_word: str, style_prompt: str) -> List[Dict[str, Any]]:
        """Create training dataset from processed images"""
        dataset = []
        
        # Prompt templates for variety
        prompt_templates = [
            f"a {style_prompt} of {trigger_word}",
            f"{style_prompt} portrait of {trigger_word}",
            f"high quality {style_prompt} of {trigger_word}",
            f"professional photograph, {style_prompt} of {trigger_word}",
            f"detailed {style_prompt} showing {trigger_word}",
            f"studio lighting, {style_prompt} of {trigger_word}",
            f"sharp focus {style_prompt} of {trigger_word}",
            f"4k resolution {style_prompt} of {trigger_word}",
        ]
        
        for i, img_data in enumerate(processed_images):
            # Create multiple training samples per image with different prompts
            for j, template in enumerate(prompt_templates):
                dataset.append({
                    "image": img_data["image"],
                    "prompt": template,
                    "image_id": i,
                    "prompt_id": j,
                    "quality_score": img_data["quality_score"],
                    "faces_detected": img_data["faces_detected"]
                })
        
        logger.info(f"📊 Created training dataset: {len(dataset)} samples from {len(processed_images)} images")
        return dataset
    
    def cleanup_cache(self, max_age_days: int = 7):
        """Cleanup old cache files"""
        import time
        
        current_time = time.time()
        max_age_seconds = max_age_days * 24 * 3600
        
        removed_count = 0
        
        for cache_file in self.cache_dir.glob("*.pkl"):
            try:
                file_age = current_time - cache_file.stat().st_mtime
                if file_age > max_age_seconds:
                    cache_file.unlink()
                    removed_count += 1
            except Exception as e:
                logger.warning(f"⚠️ Failed to remove cache file {cache_file}: {e}")
        
        if removed_count > 0:
            logger.info(f"🗑️ Cleaned up {removed_count} old cache files")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        cache_files = list(self.cache_dir.glob("*.pkl"))
        total_size = sum(f.stat().st_size for f in cache_files)
        
        return {
            "cache_files": len(cache_files),
            "total_size_mb": total_size / (1024 * 1024),
            "cache_dir": str(self.cache_dir)
        }