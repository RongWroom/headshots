/**
 * Unit tests for training data validation and preprocessing
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const fs = require('fs').promises;
const path = require('path');
const { createHash } = require('crypto');

// Mock sharp for testing
const mockSharp = {
  metadata: jest.fn(),
  resize: jest.fn().mockReturnThis(),
  extract: jest.fn().mockReturnThis(),
  sharpen: jest.fn().mockReturnThis(),
  modulate: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  png: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toFile: jest.fn(),
  clone: jest.fn().mockReturnThis(),
  grayscale: jest.fn().mockReturnThis(),
  raw: jest.fn().mockReturnThis(),
  toBuffer: jest.fn(),
  stats: jest.fn()
};

jest.mock('sharp', () => jest.fn(() => mockSharp));

// Mock fetch for image downloads
global.fetch = jest.fn();

describe('Training Data Processor', () => {
  let TrainingDataProcessor;
  let processor;
  const testTempDir = '/tmp/test-training-processor';

  beforeAll(async () => {
    // Import after mocking
    const module = await import('../lib/training-data-processor.ts');
    TrainingDataProcessor = module.TrainingDataProcessor;
    processor = new TrainingDataProcessor(testTempDir);

    // Ensure test directory exists
    try {
      await fs.mkdir(testTempDir, { recursive: true });
      await fs.mkdir(path.join(testTempDir, 'processed'), { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rmdir(testTempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Image Quality Validation', () => {
    it('should validate image dimensions correctly', async () => {
      mockSharp.metadata.mockResolvedValue({
        width: 1024,
        height: 1024,
        format: 'jpeg',
        hasAlpha: false
      });

      mockSharp.stats.mockResolvedValue({
        channels: [
          { mean: 128, stdev: 50 },
          { mean: 120, stdev: 45 },
          { mean: 135, stdev: 55 }
        ]
      });

      mockSharp.toBuffer.mockResolvedValue(Buffer.alloc(1024 * 1024));

      const testImageUrls = ['https://example.com/test1.jpg'];
      
      // Mock fetch response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg')
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
      });

      const result = await processor.processTrainingData(testImageUrls, {
        minResolution: 512,
        requireFaceDetection: false
      });

      expect(result.totalImages).toBe(1);
      expect(result.processedImages).toHaveLength(1);
      expect(result.processedImages[0].metadata.originalSize.width).toBe(1024);
      expect(result.processedImages[0].metadata.originalSize.height).toBe(1024);
    });

    it('should reject images that are too small', async () => {
      mockSharp.metadata.mockResolvedValue({
        width: 256,
        height: 256,
        format: 'jpeg',
        hasAlpha: false
      });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg')
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
      });

      const testImageUrls = ['https://example.com/small.jpg'];
      
      const result = await processor.processTrainingData(testImageUrls, {
        minResolution: 512,
        requireFaceDetection: false
      });

      expect(result.validImages).toBe(0);
      expect(result.processedImages[0].errors).toContain(
        expect.stringContaining('Image too small')
      );
    });

    it('should calculate quality metrics correctly', async () => {
      mockSharp.metadata.mockResolvedValue({
        width: 1024,
        height: 1024,
        format: 'jpeg',
        hasAlpha: false
      });

      mockSharp.stats.mockResolvedValue({
        channels: [
          { mean: 128, stdev: 60 }, // Good contrast
          { mean: 120, stdev: 55 },
          { mean: 135, stdev: 65 }
        ]
      });

      // Mock high-quality image buffer
      const highQualityBuffer = Buffer.alloc(1024 * 1024);
      // Fill with varied pixel values to simulate good sharpness
      for (let i = 0; i < highQualityBuffer.length; i++) {
        highQualityBuffer[i] = Math.floor(Math.random() * 255);
      }
      mockSharp.toBuffer.mockResolvedValue(highQualityBuffer);

      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg')
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
      });

      const testImageUrls = ['https://example.com/quality.jpg'];
      
      const result = await processor.processTrainingData(testImageUrls, {
        qualityThreshold: 0.5,
        requireFaceDetection: false
      });

      expect(result.processedImages[0].qualityMetrics.overallScore).toBeGreaterThan(0);
      expect(result.processedImages[0].qualityMetrics.brightness).toBeDefined();
      expect(result.processedImages[0].qualityMetrics.contrast).toBeDefined();
      expect(result.processedImages[0].qualityMetrics.sharpness).toBeDefined();
    });
  });

  describe('Face Detection', () => {
    it('should simulate face detection for portrait-like images', async () => {
      mockSharp.metadata.mockResolvedValue({
        width: 800,
        height: 1000, // Portrait aspect ratio
        format: 'jpeg',
        hasAlpha: false
      });

      mockSharp.stats.mockResolvedValue({
        channels: [
          { mean: 128, stdev: 50 },
          { mean: 120, stdev: 45 },
          { mean: 135, stdev: 55 }
        ]
      });

      mockSharp.toBuffer.mockResolvedValue(Buffer.alloc(800 * 1000));

      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg')
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
      });

      const testImageUrls = ['https://example.com/portrait.jpg'];
      
      const result = await processor.processTrainingData(testImageUrls, {
        requireFaceDetection: true
      });

      expect(result.processedImages[0].faceDetection.facesDetected).toBeGreaterThan(0);
      expect(result.processedImages[0].faceDetection.primaryFace).toBeDefined();
      expect(result.processedImages[0].faceDetection.primaryFace.confidence).toBeGreaterThan(0.8);
    });

    it('should reject images when face detection is required but no faces found', async () => {
      mockSharp.metadata.mockResolvedValue({
        width: 1920,
        height: 1080, // Landscape aspect ratio (unlikely to be portrait)
        format: 'jpeg',
        hasAlpha: false
      });

      mockSharp.stats.mockResolvedValue({
        channels: [
          { mean: 128, stdev: 50 }
        ]
      });

      mockSharp.toBuffer.mockResolvedValue(Buffer.alloc(1920 * 1080));

      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg')
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
      });

      const testImageUrls = ['https://example.com/landscape.jpg'];
      
      const result = await processor.processTrainingData(testImageUrls, {
        requireFaceDetection: true
      });

      expect(result.processedImages[0].faceDetection.facesDetected).toBe(0);
      expect(result.processedImages[0].errors).toContain(
        expect.stringContaining('No faces detected')
      );
    });
  });

  describe('Image Preprocessing', () => {
    it('should resize images to target resolution', async () => {
      mockSharp.metadata.mockResolvedValue({
        width: 2048,
        height: 1536,
        format: 'jpeg',
        hasAlpha: false
      });

      mockSharp.stats.mockResolvedValue({
        channels: [
          { mean: 128, stdev: 50 },
          { mean: 120, stdev: 45 },
          { mean: 135, stdev: 55 }
        ]
      });

      mockSharp.toBuffer.mockResolvedValue(Buffer.alloc(2048 * 1536));
      mockSharp.toFile.mockResolvedValue();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg')
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
      });

      const testImageUrls = ['https://example.com/large.jpg'];
      
      const result = await processor.processTrainingData(testImageUrls, {
        targetResolution: 1024,
        requireFaceDetection: false
      });

      expect(result.processedImages[0].preprocessing.wasResized).toBe(true);
      expect(result.processedImages[0].preprocessing.appliedFilters).toContain('resize');
      expect(mockSharp.resize).toHaveBeenCalledWith(1024, 1024, {
        fit: 'cover',
        position: 'center'
      });
    });

    it('should apply enhancements when enabled', async () => {
      mockSharp.metadata.mockResolvedValue({
        width: 1024,
        height: 1024,
        format: 'jpeg',
        hasAlpha: false
      });

      mockSharp.stats.mockResolvedValue({
        channels: [
          { mean: 100, stdev: 30 }, // Lower contrast
          { mean: 95, stdev: 25 },
          { mean: 105, stdev: 35 }
        ]
      });

      mockSharp.toBuffer.mockResolvedValue(Buffer.alloc(1024 * 1024));
      mockSharp.toFile.mockResolvedValue();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg')
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
      });

      const testImageUrls = ['https://example.com/lowcontrast.jpg'];
      
      const result = await processor.processTrainingData(testImageUrls, {
        enableEnhancement: true,
        requireFaceDetection: false
      });

      expect(result.processedImages[0].preprocessing.wasEnhanced).toBe(true);
      expect(result.processedImages[0].preprocessing.appliedFilters).toContain('enhancement');
      expect(mockSharp.sharpen).toHaveBeenCalled();
      expect(mockSharp.modulate).toHaveBeenCalled();
    });

    it('should crop to face when enabled and face detected', async () => {
      mockSharp.metadata.mockResolvedValue({
        width: 1200,
        height: 1600, // Portrait
        format: 'jpeg',
        hasAlpha: false
      });

      mockSharp.stats.mockResolvedValue({
        channels: [
          { mean: 128, stdev: 50 },
          { mean: 120, stdev: 45 },
          { mean: 135, stdev: 55 }
        ]
      });

      mockSharp.toBuffer.mockResolvedValue(Buffer.alloc(1200 * 1600));
      mockSharp.toFile.mockResolvedValue();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg')
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
      });

      const testImageUrls = ['https://example.com/portrait-crop.jpg'];
      
      const result = await processor.processTrainingData(testImageUrls, {
        cropToFace: true,
        requireFaceDetection: true
      });

      expect(result.processedImages[0].preprocessing.wasCropped).toBe(true);
      expect(result.processedImages[0].preprocessing.appliedFilters).toContain('face-crop');
      expect(mockSharp.extract).toHaveBeenCalled();
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect and remove duplicate images', async () => {
      // Mock two identical images
      const identicalBuffer = Buffer.alloc(1024);
      identicalBuffer.fill(128); // Fill with same values

      mockSharp.metadata.mockResolvedValue({
        width: 1024,
        height: 1024,
        format: 'jpeg',
        hasAlpha: false
      });

      mockSharp.stats.mockResolvedValue({
        channels: [
          { mean: 128, stdev: 50 }
        ]
      });

      mockSharp.toBuffer.mockResolvedValue(identicalBuffer);
      mockSharp.toFile.mockResolvedValue();

      // Mock fetch for both images returning identical data
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: jest.fn().mockReturnValue('image/jpeg')
          },
          arrayBuffer: jest.fn().mockResolvedValue(identicalBuffer)
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: jest.fn().mockReturnValue('image/jpeg')
          },
          arrayBuffer: jest.fn().mockResolvedValue(identicalBuffer)
        });

      const testImageUrls = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg' // Duplicate
      ];
      
      const result = await processor.processTrainingData(testImageUrls, {
        enableDeduplication: true,
        requireFaceDetection: false
      });

      expect(result.duplicatesRemoved).toBe(1);
      expect(result.processedImages).toHaveLength(1);
    });
  });

  describe('Overall Quality Assessment', () => {
    it('should calculate overall quality score correctly', async () => {
      // Mock multiple images with different quality levels
      const mockImages = [
        { qualityScore: 0.9, facesDetected: 1 },
        { qualityScore: 0.8, facesDetected: 1 },
        { qualityScore: 0.7, facesDetected: 0 }
      ];

      mockSharp.metadata.mockResolvedValue({
        width: 1024,
        height: 1024,
        format: 'jpeg',
        hasAlpha: false
      });

      mockSharp.toFile.mockResolvedValue();

      let callCount = 0;
      mockSharp.stats.mockImplementation(() => {
        const quality = mockImages[callCount % mockImages.length].qualityScore;
        callCount++;
        return Promise.resolve({
          channels: [
            { mean: 128, stdev: quality * 60 },
            { mean: 120, stdev: quality * 55 },
            { mean: 135, stdev: quality * 65 }
          ]
        });
      });

      mockSharp.toBuffer.mockResolvedValue(Buffer.alloc(1024 * 1024));

      // Mock fetch responses
      for (let i = 0; i < mockImages.length; i++) {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          headers: {
            get: jest.fn().mockReturnValue('image/jpeg')
          },
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
        });
      }

      const testImageUrls = mockImages.map((_, i) => `https://example.com/image${i}.jpg`);
      
      const result = await processor.processTrainingData(testImageUrls, {
        requireFaceDetection: false,
        qualityThreshold: 0.5
      });

      expect(result.overallQualityScore).toBeGreaterThan(0);
      expect(result.overallQualityScore).toBeLessThanOrEqual(1);
      expect(result.validImages).toBe(3); // All should pass quality threshold
    });

    it('should generate appropriate recommendations', async () => {
      mockSharp.metadata.mockResolvedValue({
        width: 512,
        height: 512,
        format: 'jpeg',
        hasAlpha: false
      });

      mockSharp.stats.mockResolvedValue({
        channels: [
          { mean: 128, stdev: 20 } // Low contrast
        ]
      });

      mockSharp.toBuffer.mockResolvedValue(Buffer.alloc(512 * 512));
      mockSharp.toFile.mockResolvedValue();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg')
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
      });

      const testImageUrls = ['https://example.com/lowquality.jpg'];
      
      const result = await processor.processTrainingData(testImageUrls, {
        requireFaceDetection: false,
        qualityThreshold: 0.3 // Low threshold to allow processing
      });

      expect(result.recommendations).toContain(
        expect.stringContaining('Upload at least 8 high-quality images')
      );
      expect(result.recommendations).toContain(
        expect.stringContaining('higher quality images')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const testImageUrls = ['https://example.com/unreachable.jpg'];
      
      const result = await processor.processTrainingData(testImageUrls);

      expect(result.validImages).toBe(0);
      expect(result.errors).toContain(
        expect.stringContaining('No accessible images found')
      );
    });

    it('should handle invalid image data', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg')
        },
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
      });

      mockSharp.metadata.mockRejectedValueOnce(new Error('Invalid image'));

      const testImageUrls = ['https://example.com/invalid.jpg'];
      
      const result = await processor.processTrainingData(testImageUrls);

      expect(result.validImages).toBe(0);
      expect(result.processedImages[0].errors).toContain(
        expect.stringContaining('Processing failed')
      );
    });
  });
});

describe('Training Data Integration', () => {
  let TrainingDataIntegration;
  let integration;

  beforeAll(async () => {
    const module = await import('../lib/training-data-integration.ts');
    TrainingDataIntegration = module.TrainingDataIntegration;
    integration = new TrainingDataIntegration();
  });

  describe('Training Parameter Optimization', () => {
    it('should optimize parameters based on image count and quality', async () => {
      const mockValidationResult = {
        isValid: true,
        totalImages: 15,
        validImages: 15,
        processedImages: Array(15).fill({
          isValid: true,
          faceDetection: { facesDetected: 1 },
          qualityMetrics: { overallScore: 0.8 }
        }),
        duplicatesRemoved: 0,
        lowQualityRemoved: 0,
        noFaceRemoved: 0,
        overallQualityScore: 0.8,
        recommendations: [],
        errors: [],
        warnings: []
      };

      // Mock the processor method
      integration.processor = {
        processTrainingData: jest.fn().mockResolvedValue(mockValidationResult)
      };

      // Mock accessibility check
      const mockAccessibilityCheck = jest.fn().mockResolvedValue({
        accessible: Array(15).fill('https://example.com/image.jpg'),
        inaccessible: []
      });

      // Mock the import
      jest.doMock('../lib/image-validation', () => ({
        checkMultipleImageAccessibility: mockAccessibilityCheck
      }));

      const testImageUrls = Array(15).fill('https://example.com/image.jpg');
      const result = await integration.prepareTrainingData(testImageUrls);

      expect(result.isReady).toBe(true);
      expect(result.optimizedParameters.recommendedSteps).toBeGreaterThan(1000);
      expect(result.optimizedParameters.recommendedBatchSize).toBeGreaterThan(1);
      expect(result.estimatedTrainingTime).toBeGreaterThan(0);
      expect(result.estimatedCost).toBeGreaterThan(0);
    });

    it('should adjust parameters for low quality images', async () => {
      const mockValidationResult = {
        isValid: true,
        totalImages: 10,
        validImages: 10,
        processedImages: Array(10).fill({
          isValid: true,
          faceDetection: { facesDetected: 1 },
          qualityMetrics: { overallScore: 0.5 }
        }),
        duplicatesRemoved: 0,
        lowQualityRemoved: 0,
        noFaceRemoved: 0,
        overallQualityScore: 0.5, // Low quality
        recommendations: [],
        errors: [],
        warnings: []
      };

      integration.processor = {
        processTrainingData: jest.fn().mockResolvedValue(mockValidationResult)
      };

      const mockAccessibilityCheck = jest.fn().mockResolvedValue({
        accessible: Array(10).fill('https://example.com/image.jpg'),
        inaccessible: []
      });

      jest.doMock('../lib/image-validation', () => ({
        checkMultipleImageAccessibility: mockAccessibilityCheck
      }));

      const testImageUrls = Array(10).fill('https://example.com/image.jpg');
      const result = await integration.prepareTrainingData(testImageUrls);

      expect(result.optimizedParameters.qualityBoost).toBe(true);
      expect(result.optimizedParameters.recommendedLearningRate).toBeLessThan(1e-4);
      expect(result.optimizedParameters.recommendedSteps).toBeGreaterThan(1000);
    });
  });

  describe('Training Configuration Generation', () => {
    it('should generate correct RunPod configuration', () => {
      const mockPreparationResult = {
        isReady: true,
        processedImageUrls: [
          'https://example.com/processed1.jpg',
          'https://example.com/processed2.jpg'
        ],
        optimizedParameters: {
          recommendedSteps: 1500,
          recommendedLearningRate: 1e-4,
          recommendedBatchSize: 2,
          qualityBoost: true
        }
      };

      const config = integration.generateTrainingConfig(
        mockPreparationResult,
        'test-model',
        'skstest'
      );

      expect(config.runpod.input.image_urls).toEqual(mockPreparationResult.processedImageUrls);
      expect(config.runpod.input.model_name).toBe('test-model');
      expect(config.runpod.input.trigger_word).toBe('skstest');
      expect(config.runpod.input.training_config.max_train_steps).toBe(1500);
      expect(config.runpod.input.training_config.learning_rate).toBe(1e-4);
      expect(config.runpod.input.training_config.train_batch_size).toBe(2);
      expect(config.runpod.input.training_config.quality_boost).toBe(true);
    });

    it('should generate correct Replicate configuration', () => {
      const mockPreparationResult = {
        isReady: true,
        processedImageUrls: [
          'https://example.com/processed1.jpg',
          'https://example.com/processed2.jpg'
        ],
        optimizedParameters: {
          recommendedSteps: 1200,
          recommendedLearningRate: 8e-5,
          recommendedBatchSize: 1,
          qualityBoost: false
        }
      };

      const config = integration.generateTrainingConfig(
        mockPreparationResult,
        'test-model',
        'skstest'
      );

      expect(config.replicate.input.input_images).toBe(
        mockPreparationResult.processedImageUrls.join(',')
      );
      expect(config.replicate.input.trigger_word).toBe('skstest');
      expect(config.replicate.input.max_train_steps).toBe(1200);
      expect(config.replicate.input.learning_rate).toBe(8e-5);
      expect(config.replicate.input.batch_size).toBe(1);
    });
  });
});

console.log('✅ Training data processor tests completed');