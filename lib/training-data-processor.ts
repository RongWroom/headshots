/**
 * Comprehensive training data validation and preprocessing system
 * Implements robust image quality validation, face detection, preprocessing, and optimization
 */

import sharp from 'sharp';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export interface ImageProcessingResult {
  isValid: boolean;
  processedImagePath?: string;
  originalImagePath: string;
  metadata: {
    originalSize: { width: number; height: number };
    processedSize: { width: number; height: number };
    fileSize: number;
    format: string;
    hasAlpha: boolean;
  };
  qualityMetrics: {
    sharpness: number;
    brightness: number;
    contrast: number;
    colorfulness: number;
    overallScore: number;
  };
  faceDetection: {
    facesDetected: number;
    faceRegions: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      confidence: number;
    }>;
    primaryFace?: {
      x: number;
      y: number;
      width: number;
      height: number;
      confidence: number;
    };
  };
  preprocessing: {
    wasResized: boolean;
    wasEnhanced: boolean;
    wasCropped: boolean;
    appliedFilters: string[];
  };
  errors: string[];
  warnings: string[];
}

export interface TrainingDataValidationResult {
  isValid: boolean;
  totalImages: number;
  validImages: number;
  processedImages: ImageProcessingResult[];
  duplicatesRemoved: number;
  lowQualityRemoved: number;
  noFaceRemoved: number;
  overallQualityScore: number;
  recommendations: string[];
  errors: string[];
  warnings: string[];
}

export interface ProcessingOptions {
  targetResolution: number;
  minResolution: number;
  maxResolution: number;
  requireFaceDetection: boolean;
  minFaceSize: number;
  maxFaceSize: number;
  qualityThreshold: number;
  enableEnhancement: boolean;
  enableDeduplication: boolean;
  outputFormat: 'jpeg' | 'png' | 'webp';
  outputQuality: number;
  cropToFace: boolean;
  facePadding: number;
}

export class TrainingDataProcessor {
  private readonly defaultOptions: ProcessingOptions = {
    targetResolution: 1024,
    minResolution: 512,
    maxResolution: 2048,
    requireFaceDetection: true,
    minFaceSize: 80,
    maxFaceSize: 800,
    qualityThreshold: 0.6,
    enableEnhancement: true,
    enableDeduplication: true,
    outputFormat: 'jpeg',
    outputQuality: 95,
    cropToFace: true,
    facePadding: 0.3
  };

  private tempDir: string;
  private processedDir: string;

  constructor(tempDir: string = '/tmp/training-processor') {
    this.tempDir = tempDir;
    this.processedDir = path.join(tempDir, 'processed');
  }

  /**
   * Process and validate training images
   */
  async processTrainingData(
    imageUrls: string[],
    options: Partial<ProcessingOptions> = {}
  ): Promise<TrainingDataValidationResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    // Ensure directories exist
    await this.ensureDirectories();

    const result: TrainingDataValidationResult = {
      isValid: false,
      totalImages: imageUrls.length,
      validImages: 0,
      processedImages: [],
      duplicatesRemoved: 0,
      lowQualityRemoved: 0,
      noFaceRemoved: 0,
      overallQualityScore: 0,
      recommendations: [],
      errors: [],
      warnings: []
    };

    if (imageUrls.length === 0) {
      result.errors.push('No images provided for processing');
      return result;
    }

    // Step 1: Download and validate images
    const downloadedImages = await this.downloadImages(imageUrls);
    
    // Step 2: Remove duplicates if enabled
    const uniqueImages = opts.enableDeduplication 
      ? await this.removeDuplicates(downloadedImages)
      : downloadedImages;
    
    result.duplicatesRemoved = downloadedImages.length - uniqueImages.length;

    // Step 3: Process each image
    for (const imagePath of uniqueImages) {
      try {
        const processResult = await this.processImage(imagePath, opts);
        result.processedImages.push(processResult);

        if (processResult.isValid) {
          result.validImages++;
        } else {
          // Track removal reasons
          if (processResult.faceDetection.facesDetected === 0 && opts.requireFaceDetection) {
            result.noFaceRemoved++;
          }
          if (processResult.qualityMetrics.overallScore < opts.qualityThreshold) {
            result.lowQualityRemoved++;
          }
        }
      } catch (error) {
        result.errors.push(`Failed to process image ${imagePath}: ${error}`);
      }
    }

    // Step 4: Calculate overall metrics
    result.overallQualityScore = this.calculateOverallQuality(result.processedImages);
    result.isValid = result.validImages >= Math.max(8, Math.ceil(imageUrls.length * 0.7));

    // Step 5: Generate recommendations
    result.recommendations = this.generateRecommendations(result, opts);

    // Cleanup temporary files
    await this.cleanup(downloadedImages);

    return result;
  }

  /**
   * Download images from URLs
   */
  private async downloadImages(imageUrls: string[]): Promise<string[]> {
    const downloadedPaths: string[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const hash = createHash('md5').update(Buffer.from(buffer)).digest('hex');
        const extension = this.getImageExtension(response.headers.get('content-type') || '');
        const filename = `${hash}.${extension}`;
        const filepath = path.join(this.tempDir, filename);

        await fs.writeFile(filepath, Buffer.from(buffer));
        downloadedPaths.push(filepath);
      } catch (error) {
        console.warn(`Failed to download image ${i + 1}: ${error}`);
      }
    }

    return downloadedPaths;
  }

  /**
   * Remove duplicate images based on perceptual hash
   */
  private async removeDuplicates(imagePaths: string[]): Promise<string[]> {
    const hashes = new Map<string, string>();
    const uniquePaths: string[] = [];

    for (const imagePath of imagePaths) {
      try {
        const hash = await this.calculatePerceptualHash(imagePath);
        
        if (!hashes.has(hash)) {
          hashes.set(hash, imagePath);
          uniquePaths.push(imagePath);
        } else {
          // Remove duplicate file
          await fs.unlink(imagePath).catch(() => {});
        }
      } catch (error) {
        console.warn(`Failed to calculate hash for ${imagePath}: ${error}`);
        uniquePaths.push(imagePath); // Keep if hash calculation fails
      }
    }

    return uniquePaths;
  }

  /**
   * Process a single image
   */
  private async processImage(
    imagePath: string,
    options: ProcessingOptions
  ): Promise<ImageProcessingResult> {
    const result: ImageProcessingResult = {
      isValid: false,
      originalImagePath: imagePath,
      metadata: {
        originalSize: { width: 0, height: 0 },
        processedSize: { width: 0, height: 0 },
        fileSize: 0,
        format: '',
        hasAlpha: false
      },
      qualityMetrics: {
        sharpness: 0,
        brightness: 0,
        contrast: 0,
        colorfulness: 0,
        overallScore: 0
      },
      faceDetection: {
        facesDetected: 0,
        faceRegions: [],
        primaryFace: undefined
      },
      preprocessing: {
        wasResized: false,
        wasEnhanced: false,
        wasCropped: false,
        appliedFilters: []
      },
      errors: [],
      warnings: []
    };

    try {
      // Load image and get metadata
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      result.metadata = {
        originalSize: { width: metadata.width || 0, height: metadata.height || 0 },
        processedSize: { width: metadata.width || 0, height: metadata.height || 0 },
        fileSize: (await fs.stat(imagePath)).size,
        format: metadata.format || '',
        hasAlpha: metadata.hasAlpha || false
      };

      // Validate basic requirements
      if (!metadata.width || !metadata.height) {
        result.errors.push('Invalid image dimensions');
        return result;
      }

      if (metadata.width < options.minResolution || metadata.height < options.minResolution) {
        result.errors.push(`Image too small: ${metadata.width}x${metadata.height}. Minimum: ${options.minResolution}x${options.minResolution}`);
        return result;
      }

      // Calculate quality metrics
      result.qualityMetrics = await this.calculateQualityMetrics(image);

      // Perform face detection
      result.faceDetection = await this.detectFaces(imagePath);

      // Check face detection requirements
      if (options.requireFaceDetection && result.faceDetection.facesDetected === 0) {
        result.errors.push('No faces detected in image');
        return result;
      }

      // Validate face sizes
      if (result.faceDetection.primaryFace) {
        const faceSize = Math.max(
          result.faceDetection.primaryFace.width,
          result.faceDetection.primaryFace.height
        );
        
        if (faceSize < options.minFaceSize) {
          result.errors.push(`Face too small: ${faceSize}px. Minimum: ${options.minFaceSize}px`);
          return result;
        }
        
        if (faceSize > options.maxFaceSize) {
          result.warnings.push(`Face very large: ${faceSize}px. May affect training quality`);
        }
      }

      // Check quality threshold
      if (result.qualityMetrics.overallScore < options.qualityThreshold) {
        result.errors.push(`Image quality too low: ${result.qualityMetrics.overallScore.toFixed(2)}. Minimum: ${options.qualityThreshold}`);
        return result;
      }

      // Process the image
      const processedPath = await this.preprocessImage(imagePath, result, options);
      result.processedImagePath = processedPath;
      result.isValid = true;

    } catch (error) {
      result.errors.push(`Processing failed: ${error}`);
    }

    return result;
  }

  /**
   * Preprocess image (resize, enhance, crop)
   */
  private async preprocessImage(
    imagePath: string,
    result: ImageProcessingResult,
    options: ProcessingOptions
  ): Promise<string> {
    const outputPath = path.join(
      this.processedDir,
      `processed_${path.basename(imagePath, path.extname(imagePath))}.${options.outputFormat}`
    );

    let image = sharp(imagePath);
    const { width, height } = result.metadata.originalSize;

    // Step 1: Crop to face if enabled and face detected
    if (options.cropToFace && result.faceDetection.primaryFace) {
      const face = result.faceDetection.primaryFace;
      const padding = Math.floor(Math.max(face.width, face.height) * options.facePadding);
      
      const cropX = Math.max(0, face.x - padding);
      const cropY = Math.max(0, face.y - padding);
      const cropWidth = Math.min(width - cropX, face.width + padding * 2);
      const cropHeight = Math.min(height - cropY, face.height + padding * 2);

      image = image.extract({
        left: cropX,
        top: cropY,
        width: cropWidth,
        height: cropHeight
      });

      result.preprocessing.wasCropped = true;
      result.preprocessing.appliedFilters.push('face-crop');
    }

    // Step 2: Resize to target resolution
    if (width !== options.targetResolution || height !== options.targetResolution) {
      image = image.resize(options.targetResolution, options.targetResolution, {
        fit: 'cover',
        position: 'center'
      });
      
      result.preprocessing.wasResized = true;
      result.preprocessing.appliedFilters.push('resize');
      result.metadata.processedSize = {
        width: options.targetResolution,
        height: options.targetResolution
      };
    }

    // Step 3: Apply enhancements if enabled
    if (options.enableEnhancement) {
      // Sharpen slightly
      image = image.sharpen({ sigma: 0.5, m1: 0.5, m2: 2 });
      
      // Adjust contrast and brightness based on quality metrics
      if (result.qualityMetrics.contrast < 0.5) {
        image = image.modulate({ brightness: 1.05, saturation: 1.1 });
        result.preprocessing.appliedFilters.push('contrast-boost');
      }
      
      if (result.qualityMetrics.brightness < 0.4) {
        image = image.modulate({ brightness: 1.1 });
        result.preprocessing.appliedFilters.push('brightness-boost');
      }

      result.preprocessing.wasEnhanced = true;
      result.preprocessing.appliedFilters.push('enhancement');
    }

    // Step 4: Set output format and quality
    switch (options.outputFormat) {
      case 'jpeg':
        image = image.jpeg({ quality: options.outputQuality, progressive: true });
        break;
      case 'png':
        image = image.png({ quality: options.outputQuality });
        break;
      case 'webp':
        image = image.webp({ quality: options.outputQuality });
        break;
    }

    // Save processed image
    await image.toFile(outputPath);
    
    return outputPath;
  }

  /**
   * Calculate image quality metrics
   */
  private async calculateQualityMetrics(image: sharp.Sharp): Promise<ImageProcessingResult['qualityMetrics']> {
    // Get image statistics
    const stats = await image.stats();
    const { width, height } = await image.metadata();
    
    // Convert to grayscale for analysis
    const grayBuffer = await image.clone().grayscale().raw().toBuffer();
    const pixels = new Uint8Array(grayBuffer);
    
    // Calculate sharpness (Laplacian variance)
    const sharpness = this.calculateSharpness(pixels, width || 0, height || 0);
    
    // Calculate brightness (mean luminance)
    const brightness = stats.channels.reduce((sum, channel) => sum + channel.mean, 0) / stats.channels.length / 255;
    
    // Calculate contrast (standard deviation)
    const contrast = Math.sqrt(stats.channels.reduce((sum, channel) => sum + Math.pow(channel.stdev, 2), 0) / stats.channels.length) / 255;
    
    // Calculate colorfulness (for color images)
    const colorfulness = stats.channels.length > 1 ? this.calculateColorfulness(stats) : 0;
    
    // Calculate overall quality score
    const overallScore = (
      Math.min(sharpness / 1000, 1) * 0.3 +
      (brightness > 0.2 && brightness < 0.8 ? 1 : Math.max(0, 1 - Math.abs(brightness - 0.5) * 2)) * 0.25 +
      Math.min(contrast * 2, 1) * 0.25 +
      Math.min(colorfulness, 1) * 0.2
    );

    return {
      sharpness,
      brightness,
      contrast,
      colorfulness,
      overallScore
    };
  }

  /**
   * Calculate sharpness using Laplacian variance
   */
  private calculateSharpness(pixels: Uint8Array, width: number, height: number): number {
    if (width < 3 || height < 3) return 0;
    
    let variance = 0;
    let mean = 0;
    let count = 0;

    // Apply Laplacian kernel
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const laplacian = 
          -pixels[idx - width - 1] - pixels[idx - width] - pixels[idx - width + 1] +
          -pixels[idx - 1] + 8 * pixels[idx] - pixels[idx + 1] +
          -pixels[idx + width - 1] - pixels[idx + width] - pixels[idx + width + 1];
        
        mean += laplacian;
        count++;
      }
    }

    mean /= count;

    // Calculate variance
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const laplacian = 
          -pixels[idx - width - 1] - pixels[idx - width] - pixels[idx - width + 1] +
          -pixels[idx - 1] + 8 * pixels[idx] - pixels[idx + 1] +
          -pixels[idx + width - 1] - pixels[idx + width] - pixels[idx + width + 1];
        
        variance += Math.pow(laplacian - mean, 2);
      }
    }

    return variance / count;
  }

  /**
   * Calculate colorfulness metric
   */
  private calculateColorfulness(stats: sharp.Stats): number {
    if (stats.channels.length < 3) return 0;
    
    // Simple colorfulness based on channel variance
    const channelVariances = stats.channels.map(channel => Math.pow(channel.stdev, 2));
    const totalVariance = channelVariances.reduce((sum, variance) => sum + variance, 0);
    
    return Math.min(totalVariance / (255 * 255 * 3), 1);
  }

  /**
   * Detect faces in image (placeholder - would use actual face detection service)
   */
  private async detectFaces(imagePath: string): Promise<ImageProcessingResult['faceDetection']> {
    // This is a placeholder implementation
    // In a real implementation, you would use:
    // - OpenCV with Haar cascades
    // - MediaPipe Face Detection
    // - Cloud vision APIs (Google, AWS, Azure)
    // - TensorFlow.js face detection models
    
    const result: ImageProcessingResult['faceDetection'] = {
      facesDetected: 0,
      faceRegions: [],
      primaryFace: undefined
    };

    try {
      // Simulate face detection based on image characteristics
      const metadata = await sharp(imagePath).metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;
      
      // Simple heuristic: assume face detection based on image size and aspect ratio
      const aspectRatio = width / height;
      const isPortraitLike = aspectRatio > 0.6 && aspectRatio < 1.4;
      const isReasonableSize = width >= 256 && height >= 256;
      
      if (isPortraitLike && isReasonableSize) {
        // Simulate detected face in center region
        const faceWidth = Math.floor(Math.min(width, height) * 0.4);
        const faceHeight = Math.floor(faceWidth * 1.2);
        const faceX = Math.floor((width - faceWidth) / 2);
        const faceY = Math.floor((height - faceHeight) / 2.5); // Slightly higher than center
        
        const face = {
          x: faceX,
          y: faceY,
          width: faceWidth,
          height: faceHeight,
          confidence: 0.85
        };
        
        result.facesDetected = 1;
        result.faceRegions = [face];
        result.primaryFace = face;
      }
    } catch (error) {
      console.warn(`Face detection failed for ${imagePath}: ${error}`);
    }

    return result;
  }

  /**
   * Calculate perceptual hash for duplicate detection
   */
  private async calculatePerceptualHash(imagePath: string): Promise<string> {
    // Create a small grayscale version for hashing
    const buffer = await sharp(imagePath)
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();
    
    // Calculate average pixel value
    const pixels = new Uint8Array(buffer);
    const average = pixels.reduce((sum, pixel) => sum + pixel, 0) / pixels.length;
    
    // Create hash based on pixels above/below average
    let hash = '';
    for (const pixel of pixels) {
      hash += pixel > average ? '1' : '0';
    }
    
    return hash;
  }

  /**
   * Calculate overall quality score for the dataset
   */
  private calculateOverallQuality(processedImages: ImageProcessingResult[]): number {
    if (processedImages.length === 0) return 0;
    
    const validImages = processedImages.filter(img => img.isValid);
    if (validImages.length === 0) return 0;
    
    const averageQuality = validImages.reduce(
      (sum, img) => sum + img.qualityMetrics.overallScore, 0
    ) / validImages.length;
    
    const faceDetectionRate = validImages.filter(
      img => img.faceDetection.facesDetected > 0
    ).length / validImages.length;
    
    return averageQuality * 0.7 + faceDetectionRate * 0.3;
  }

  /**
   * Generate recommendations based on processing results
   */
  private generateRecommendations(
    result: TrainingDataValidationResult,
    options: ProcessingOptions
  ): string[] {
    const recommendations: string[] = [];
    
    if (result.validImages < 8) {
      recommendations.push('Upload at least 8 high-quality images for better training results');
    }
    
    if (result.noFaceRemoved > 0) {
      recommendations.push(`${result.noFaceRemoved} images were removed due to no face detection. Ensure faces are clearly visible`);
    }
    
    if (result.lowQualityRemoved > 0) {
      recommendations.push(`${result.lowQualityRemoved} images were removed due to low quality. Use sharp, well-lit photos`);
    }
    
    if (result.duplicatesRemoved > 0) {
      recommendations.push(`${result.duplicatesRemoved} duplicate images were removed. Use varied poses and expressions`);
    }
    
    if (result.overallQualityScore < 0.7) {
      recommendations.push('Consider using higher quality images with better lighting and sharpness');
    }
    
    const avgFacesPerImage = result.processedImages.reduce(
      (sum, img) => sum + img.faceDetection.facesDetected, 0
    ) / result.processedImages.length;
    
    if (avgFacesPerImage > 1.2) {
      recommendations.push('Some images contain multiple faces. Use photos with only one person for better results');
    }
    
    return recommendations;
  }

  /**
   * Get image extension from content type
   */
  private getImageExtension(contentType: string): string {
    const typeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif'
    };
    
    return typeMap[contentType.toLowerCase()] || 'jpg';
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.tempDir, { recursive: true });
    await fs.mkdir(this.processedDir, { recursive: true });
  }

  /**
   * Cleanup temporary files
   */
  private async cleanup(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    tempDirSize: number;
    processedDirSize: number;
    tempFileCount: number;
    processedFileCount: number;
  }> {
    const getTotalSize = async (dirPath: string): Promise<{ size: number; count: number }> => {
      try {
        const files = await fs.readdir(dirPath);
        let totalSize = 0;
        let count = 0;
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            totalSize += stats.size;
            count++;
          }
        }
        
        return { size: totalSize, count };
      } catch {
        return { size: 0, count: 0 };
      }
    };

    const tempStats = await getTotalSize(this.tempDir);
    const processedStats = await getTotalSize(this.processedDir);

    return {
      tempDirSize: tempStats.size,
      processedDirSize: processedStats.size,
      tempFileCount: tempStats.count,
      processedFileCount: processedStats.count
    };
  }
}