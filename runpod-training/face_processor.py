"""
Advanced face processing for high-quality LoRA training
Ensures optimal face detection, cropping, and quality validation
"""

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import os

class FaceProcessor:
    def __init__(self):
        """Initialize face processor with OpenCV cascade"""
        # Download face cascade if not exists
        cascade_path = '/app/haarcascade_frontalface_default.xml'
        if not os.path.exists(cascade_path):
            import urllib.request
            url = 'https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml'
            urllib.request.urlretrieve(url, cascade_path)
        
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        
    def detect_faces(self, image_path):
        """Detect faces in image and return face coordinates"""
        img = cv2.imread(image_path)
        if img is None:
            return []
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Detect faces with multiple scale factors for better detection
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(100, 100),
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        
        return faces
    
    def validate_image_quality(self, image_path):
        """Validate image quality for training"""
        try:
            img = Image.open(image_path)
            
            # Check minimum resolution
            width, height = img.size
            if width < 512 or height < 512:
                print(f"  ⚠️ Image too small: {width}x{height} (minimum 512x512)")
                return False
            
            # Check if image is too blurry
            img_cv = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
            laplacian_var = cv2.Laplacian(img_cv, cv2.CV_64F).var()
            
            if laplacian_var < 100:  # Threshold for blur detection
                print(f"  ⚠️ Image too blurry: variance {laplacian_var:.2f}")
                return False
            
            # Check brightness
            img_array = np.array(img.convert('L'))
            brightness = np.mean(img_array)
            
            if brightness < 50 or brightness > 200:
                print(f"  ⚠️ Poor lighting: brightness {brightness:.2f}")
                return False
            
            return True
            
        except Exception as e:
            print(f"  ❌ Quality validation failed: {str(e)}")
            return False
    
    def enhance_image(self, image_path, output_path):
        """Enhance image quality for better training"""
        try:
            img = Image.open(image_path)
            
            # Convert to RGB if needed
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Enhance sharpness slightly
            enhancer = ImageEnhance.Sharpness(img)
            img = enhancer.enhance(1.1)
            
            # Enhance contrast slightly
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.05)
            
            # Ensure minimum size while maintaining aspect ratio
            width, height = img.size
            min_size = 1024
            
            if width < min_size or height < min_size:
                if width < height:
                    new_width = min_size
                    new_height = int((height * min_size) / width)
                else:
                    new_height = min_size
                    new_width = int((width * min_size) / height)
                
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Save enhanced image
            img.save(output_path, 'JPEG', quality=95)
            return True
            
        except Exception as e:
            print(f"  ❌ Image enhancement failed: {str(e)}")
            return False
    
    def crop_face_region(self, image_path, output_path, padding=0.3):
        """Crop image to focus on face region with padding"""
        try:
            faces = self.detect_faces(image_path)
            
            if len(faces) == 0:
                print("  ⚠️ No face detected")
                return False
            
            # Use the largest face
            face = max(faces, key=lambda f: f[2] * f[3])
            x, y, w, h = face
            
            # Add padding around face
            img = Image.open(image_path)
            img_width, img_height = img.size
            
            pad_w = int(w * padding)
            pad_h = int(h * padding)
            
            # Calculate crop coordinates with padding
            crop_x1 = max(0, x - pad_w)
            crop_y1 = max(0, y - pad_h)
            crop_x2 = min(img_width, x + w + pad_w)
            crop_y2 = min(img_height, y + h + pad_h)
            
            # Crop the image
            cropped = img.crop((crop_x1, crop_y1, crop_x2, crop_y2))
            
            # Make it square by padding if needed
            crop_width, crop_height = cropped.size
            max_dim = max(crop_width, crop_height)
            
            # Create square image with padding
            square_img = Image.new('RGB', (max_dim, max_dim), (128, 128, 128))
            paste_x = (max_dim - crop_width) // 2
            paste_y = (max_dim - crop_height) // 2
            square_img.paste(cropped, (paste_x, paste_y))
            
            # Resize to training resolution
            square_img = square_img.resize((1024, 1024), Image.Resampling.LANCZOS)
            
            # Save cropped image
            square_img.save(output_path, 'JPEG', quality=95)
            return True
            
        except Exception as e:
            print(f"  ❌ Face cropping failed: {str(e)}")
            return False
    
    def process_training_image(self, image_path, temp_dir, index):
        """Complete processing pipeline for training image"""
        try:
            print(f"    Processing image {index + 1}...")
            
            # Validate quality first
            if not self.validate_image_quality(image_path):
                return None
            
            # Detect faces
            faces = self.detect_faces(image_path)
            if len(faces) == 0:
                print(f"    ⚠️ No face detected in image {index + 1}")
                return None
            
            print(f"    ✅ Detected {len(faces)} face(s)")
            
            # Create processed image path
            processed_path = os.path.join(temp_dir, f"processed_{index:03d}.jpg")
            
            # Enhance and crop image
            if self.crop_face_region(image_path, processed_path):
                print(f"    ✅ Face cropped and enhanced")
                return processed_path
            else:
                # If cropping fails, try enhancement only
                if self.enhance_image(image_path, processed_path):
                    print(f"    ✅ Image enhanced (no cropping)")
                    return processed_path
                else:
                    return None
            
        except Exception as e:
            print(f"    ❌ Processing failed for image {index + 1}: {str(e)}")
            return None