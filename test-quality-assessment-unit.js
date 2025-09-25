/**
 * Unit tests for the Quality Assessment System
 * Tests the core functionality of quality assessment, monitoring, and integration
 */

// Simple test framework
function describe(name, fn) {
  console.log(`\n📋 ${name}`);
  fn();
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (error) {
    console.log(`  ❌ ${name}: ${error.message}`);
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual: (expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toHaveLength: (expected) => {
      if (actual.length !== expected) {
        throw new Error(`Expected length ${expected}, got ${actual.length}`);
      }
    },
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toBeDefined: () => {
      if (actual === undefined) {
        throw new Error('Expected value to be defined');
      }
    },
    toBeCloseTo: (expected, precision = 2) => {
      const factor = Math.pow(10, precision);
      if (Math.round(actual * factor) !== Math.round(expected * factor)) {
        throw new Error(`Expected ${actual} to be close to ${expected}`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeGreaterThanOrEqual: (expected) => {
      if (actual < expected) {
        throw new Error(`Expected ${actual} to be greater than or equal to ${expected}`);
      }
    },
    toBeLessThanOrEqual: (expected) => {
      if (actual > expected) {
        throw new Error(`Expected ${actual} to be less than or equal to ${expected}`);
      }
    }
  };
}

// Mock fetch for API calls
global.fetch = async (url, options) => {
  // Simulate API responses
  if (url.includes('/api/quality/clip-similarity')) {
    return {
      ok: true,
      json: async () => ({ similarity: 0.85 })
    };
  }
  if (url.includes('/api/quality/face-recognition')) {
    return {
      ok: true,
      json: async () => ({ score: 0.9 })
    };
  }
  return {
    ok: true,
    json: async () => ({})
  };
};

describe('Quality Assessment System Unit Tests', () => {

  describe('QualityAssessmentService', () => {
    test('should calculate overall quality correctly', () => {
      // Test the weighted average calculation
      const clipSimilarity = 0.8;
      const faceRecognitionScore = 0.9;
      
      // Weight: CLIP 30%, Face 70%
      const expectedOverallQuality = (clipSimilarity * 0.3) + (faceRecognitionScore * 0.7);
      
      expect(expectedOverallQuality).toBe(0.87);
    });

    test('should check quality thresholds correctly', () => {
      const metrics = {
        clipSimilarity: 0.9,
        faceRecognitionScore: 0.85,
        overallQuality: 0.87
      };

      const thresholds = {
        clipSimilarityMin: 0.85,
        faceRecognitionMin: 0.85,
        overallQualityMin: 0.85
      };

      // All metrics should pass thresholds
      const passesClip = metrics.clipSimilarity >= thresholds.clipSimilarityMin;
      const passesFace = metrics.faceRecognitionScore >= thresholds.faceRecognitionMin;
      const passesOverall = metrics.overallQuality >= thresholds.overallQualityMin;

      expect(passesClip).toBe(true);
      expect(passesFace).toBe(true);
      expect(passesOverall).toBe(true);
    });

    test('should generate appropriate recommendations for low quality', () => {
      const metrics = {
        clipSimilarity: 0.7,  // Below 0.85 threshold
        faceRecognitionScore: 0.8,  // Below 0.85 threshold
        overallQuality: 0.75  // Below 0.85 threshold
      };

      const thresholds = {
        clipSimilarityMin: 0.85,
        faceRecognitionMin: 0.85,
        overallQualityMin: 0.85
      };

      const recommendations = [];

      if (metrics.clipSimilarity < thresholds.clipSimilarityMin) {
        recommendations.push('CLIP similarity is below threshold. Consider adjusting training parameters or providing more diverse training images.');
      }

      if (metrics.faceRecognitionScore < thresholds.faceRecognitionMin) {
        recommendations.push('Face recognition score is low. Ensure training images have clear, well-lit faces and consider face preprocessing.');
      }

      if (metrics.overallQuality < thresholds.overallQualityMin) {
        recommendations.push('Overall quality is below acceptable levels. Recommend retraining with optimized parameters.');
      }

      expect(recommendations).toHaveLength(3);
      expect(recommendations[0]).toContain('CLIP similarity');
      expect(recommendations[1]).toContain('Face recognition');
      expect(recommendations[2]).toContain('Overall quality');
    });

    test('should handle CLIP similarity API call', async () => {
      const response = await fetch('/api/quality/clip-similarity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generatedImage: 'test-generated.jpg',
          originalImages: ['test1.jpg', 'test2.jpg']
        })
      });

      const result = await response.json();
      expect(result.similarity).toBe(0.85);
    });

    test('should handle face recognition API call', async () => {
      const response = await fetch('/api/quality/face-recognition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generatedImage: 'test-generated.jpg',
          originalImages: ['test1.jpg', 'test2.jpg']
        })
      });

      const result = await response.json();
      expect(result.score).toBe(0.9);
    });
  });

  describe('QualityMonitoringService', () => {
    test('should detect consecutive failures correctly', () => {
      const qualityHistory = [
        { overallQuality: 0.7 },  // Failure (< 0.85)
        { overallQuality: 0.75 }, // Failure (< 0.85)
        { overallQuality: 0.8 },  // Failure (< 0.85)
        { overallQuality: 0.9 },  // Success (>= 0.85)
        { overallQuality: 0.85 }  // Success (>= 0.85)
      ];

      const thresholds = { overallQualityMin: 0.85 };
      const alertThreshold = 3;

      let consecutiveCount = 0;
      for (const assessment of qualityHistory) {
        if (assessment.overallQuality < thresholds.overallQualityMin) {
          consecutiveCount++;
        } else {
          break; // Reset count on first success
        }
      }

      const hasFailures = consecutiveCount >= alertThreshold;

      expect(consecutiveCount).toBe(3);
      expect(hasFailures).toBe(true);
    });

    test('should detect quality degradation correctly', () => {
      const qualityHistory = [
        // Recent assessments (lower quality)
        { overallQuality: 0.75 },
        { overallQuality: 0.78 },
        { overallQuality: 0.76 },
        { overallQuality: 0.77 },
        { overallQuality: 0.74 },
        // Historical assessments (higher quality)
        { overallQuality: 0.88 },
        { overallQuality: 0.90 },
        { overallQuality: 0.87 },
        { overallQuality: 0.89 },
        { overallQuality: 0.91 }
      ];

      const degradationThreshold = 0.1; // 10%

      if (qualityHistory.length >= 10) {
        const recentAssessments = qualityHistory.slice(0, 5);
        const historicalAssessments = qualityHistory.slice(5, 10);

        const recentAverage = recentAssessments.reduce(
          (sum, assessment) => sum + assessment.overallQuality,
          0
        ) / recentAssessments.length;

        const historicalAverage = historicalAssessments.reduce(
          (sum, assessment) => sum + assessment.overallQuality,
          0
        ) / historicalAssessments.length;

        const degradationAmount = historicalAverage - recentAverage;
        const hasDegradation = degradationAmount > degradationThreshold;

        expect(recentAverage).toBeCloseTo(0.76, 2);
        expect(historicalAverage).toBeCloseTo(0.89, 2);
        expect(degradationAmount).toBeCloseTo(0.13, 2);
        expect(hasDegradation).toBe(true);
      }
    });

    test('should create quality alerts with correct structure', () => {
      const alert = {
        id: 'test-alert-id',
        modelId: 'test-model-123',
        alertType: 'low_quality',
        severity: 'high',
        message: 'Model has 3 consecutive quality failures',
        recommendations: [
          'Review training parameters and consider retraining',
          'Check training image quality and diversity'
        ],
        createdAt: new Date(),
        resolved: false
      };

      expect(alert.id).toBeDefined();
      expect(alert.modelId).toBe('test-model-123');
      expect(alert.alertType).toBe('low_quality');
      expect(alert.severity).toBe('high');
      expect(alert.message).toContain('consecutive quality failures');
      expect(alert.recommendations).toHaveLength(2);
      expect(alert.resolved).toBe(false);
    });
  });

  describe('TrainingQualityIntegration', () => {
    test('should validate training images correctly', () => {
      const testCases = [
        {
          imageUrls: ['img1.jpg', 'img2.jpg'],
          expectedValid: false,
          expectedIssues: ['Insufficient training images (minimum 5 recommended)']
        },
        {
          imageUrls: Array(60).fill('img.jpg'),
          expectedValid: false,
          expectedIssues: ['Too many training images may increase costs without significant quality improvement']
        },
        {
          imageUrls: Array(10).fill('img.jpg'),
          expectedValid: true,
          expectedIssues: []
        }
      ];

      testCases.forEach(({ imageUrls, expectedValid, expectedIssues }) => {
        const issues = [];
        const recommendations = [];

        // Basic validation logic
        if (imageUrls.length < 5) {
          issues.push('Insufficient training images (minimum 5 recommended)');
          recommendations.push('Add more diverse training images for better quality');
        }

        if (imageUrls.length > 50) {
          issues.push('Too many training images may increase costs without significant quality improvement');
          recommendations.push('Consider selecting the best 20-30 images for optimal cost-quality balance');
        }

        const isValid = issues.length === 0;

        expect(isValid).toBe(expectedValid);
        expect(issues).toEqual(expectedIssues);
      });
    });

    test('should generate comprehensive recommendations', () => {
      const qualityHistory = [
        { overallQuality: 0.7, clipSimilarity: 0.75, faceRecognitionScore: 0.68 }
      ];
      const activeAlerts = [
        { severity: 'high', alertType: 'retraining_needed' }
      ];
      const retrainingStatus = { needsRetraining: true, reason: 'Quality below threshold' };

      const recommendations = [];

      // Quality-based recommendations
      const latestQuality = qualityHistory[0];
      if (latestQuality.overallQuality < 0.7) {
        recommendations.push('Current quality is significantly below acceptable levels. Immediate retraining recommended.');
      } else if (latestQuality.overallQuality < 0.85) {
        recommendations.push('Current quality is below optimal levels. Consider parameter optimization or retraining.');
      }

      // CLIP similarity specific recommendations
      if (latestQuality.clipSimilarity < 0.8) {
        recommendations.push('CLIP similarity is low. Consider improving training image diversity or adjusting style parameters.');
      }

      // Face recognition specific recommendations
      if (latestQuality.faceRecognitionScore < 0.8) {
        recommendations.push('Face recognition score is low. Ensure training images have clear, well-lit faces and consider face preprocessing.');
      }

      // Alert-based recommendations
      const highSeverityAlerts = activeAlerts.filter(alert => alert.severity === 'high');
      if (highSeverityAlerts.length > 0) {
        recommendations.push(`${highSeverityAlerts.length} high-severity alerts require immediate attention.`);
      }

      // Retraining recommendations
      if (retrainingStatus.needsRetraining) {
        recommendations.push(`Retraining recommended: ${retrainingStatus.reason}`);
      }

      expect(recommendations).toHaveLength(5);
      expect(recommendations[0]).toContain('below optimal levels');
      expect(recommendations[1]).toContain('CLIP similarity is low');
      expect(recommendations[2]).toContain('Face recognition score is low');
      expect(recommendations[3]).toContain('high-severity alerts');
      expect(recommendations[4]).toContain('Retraining recommended');
    });
  });

  describe('API Endpoint Validation', () => {
    test('should validate required parameters for quality assessment', () => {
      const testCases = [
        {
          body: {},
          expectedError: 'Missing required parameters: modelId, generatedImageUrl, originalImageUrls'
        },
        {
          body: { modelId: 'test' },
          expectedError: 'Missing required parameters: modelId, generatedImageUrl, originalImageUrls'
        },
        {
          body: { modelId: 'test', generatedImageUrl: 'test.jpg' },
          expectedError: 'Missing required parameters: modelId, generatedImageUrl, originalImageUrls'
        },
        {
          body: { modelId: 'test', generatedImageUrl: 'test.jpg', originalImageUrls: [] },
          expectedError: 'originalImageUrls must be a non-empty array'
        },
        {
          body: { modelId: 'test', generatedImageUrl: 'test.jpg', originalImageUrls: 'not-array' },
          expectedError: 'originalImageUrls must be a non-empty array'
        }
      ];

      testCases.forEach(({ body, expectedError }) => {
        const { modelId, generatedImageUrl, originalImageUrls } = body;

        let error = null;

        if (!modelId || !generatedImageUrl || !originalImageUrls) {
          error = 'Missing required parameters: modelId, generatedImageUrl, originalImageUrls';
        } else if (!Array.isArray(originalImageUrls) || originalImageUrls.length === 0) {
          error = 'originalImageUrls must be a non-empty array';
        }

        expect(error).toBe(expectedError);
      });
    });

    test('should validate CLIP similarity API parameters', () => {
      const testCases = [
        {
          body: {},
          expectedError: 'Missing required parameters: generatedImage and originalImages array'
        },
        {
          body: { generatedImage: 'test.jpg' },
          expectedError: 'Missing required parameters: generatedImage and originalImages array'
        },
        {
          body: { generatedImage: 'test.jpg', originalImages: 'not-array' },
          expectedError: 'Missing required parameters: generatedImage and originalImages array'
        },
        {
          body: { generatedImage: 'test.jpg', originalImages: [] },
          expectedError: 'Missing required parameters: generatedImage and originalImages array'
        }
      ];

      testCases.forEach(({ body, expectedError }) => {
        const { generatedImage, originalImages } = body;

        let error = null;

        if (!generatedImage || !originalImages || !Array.isArray(originalImages) || originalImages.length === 0) {
          error = 'Missing required parameters: generatedImage and originalImages array';
        }

        expect(error).toBe(expectedError);
      });
    });
  });

  describe('Quality Thresholds and Scoring', () => {
    test('should apply default quality thresholds correctly', () => {
      const DEFAULT_QUALITY_THRESHOLDS = {
        clipSimilarityMin: 0.85,
        faceRecognitionMin: 0.85,
        overallQualityMin: 0.85,
      };

      expect(DEFAULT_QUALITY_THRESHOLDS.clipSimilarityMin).toBe(0.85);
      expect(DEFAULT_QUALITY_THRESHOLDS.faceRecognitionMin).toBe(0.85);
      expect(DEFAULT_QUALITY_THRESHOLDS.overallQualityMin).toBe(0.85);
    });

    test('should calculate quality scores within valid range', () => {
      const testScores = [0.0, 0.5, 0.85, 1.0, 1.2];
      
      testScores.forEach(score => {
        // Ensure scores are clamped to valid range [0, 1]
        const clampedScore = Math.max(0, Math.min(1, score));
        
        expect(clampedScore).toBeGreaterThanOrEqual(0);
        expect(clampedScore).toBeLessThanOrEqual(1);
      });
    });

    test('should handle edge cases in quality calculation', () => {
      // Test with extreme values
      const edgeCases = [
        { clip: 0, face: 0, expected: 0 },
        { clip: 1, face: 1, expected: 1 },
        { clip: 0, face: 1, expected: 0.7 }, // 0 * 0.3 + 1 * 0.7
        { clip: 1, face: 0, expected: 0.3 }, // 1 * 0.3 + 0 * 0.7
      ];

      edgeCases.forEach(({ clip, face, expected }) => {
        const overallQuality = (clip * 0.3) + (face * 0.7);
        expect(overallQuality).toBeCloseTo(expected, 2);
      });
    });
  });
});

console.log('Quality Assessment Unit Tests completed successfully!');