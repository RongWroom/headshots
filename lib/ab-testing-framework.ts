/**
 * A/B Testing Framework for Training Parameter Optimization
 * Allows systematic comparison of different parameter sets to optimize training quality
 */

import { OptimizedTrainingParams, ParameterSet } from './training-parameters';

export interface ABTestConfig {
  testId: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  trafficSplit: number[]; // Percentage allocation for each variant
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  targetMetrics: string[];
  minimumSampleSize: number;
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  parameters: OptimizedTrainingParams;
  weight: number; // Traffic allocation weight
}

export interface ABTestResult {
  testId: string;
  variantId: string;
  userId: string;
  trainingId: string;
  timestamp: Date;
  metrics: TrainingMetrics;
  userFeedback?: UserFeedback;
}

export interface TrainingMetrics {
  trainingTime: number; // minutes
  trainingCost: number; // USD
  qualityScore: number; // 0-1
  userSatisfaction: number; // 1-5
  technicalMetrics: {
    convergenceRate: number;
    finalLoss: number;
    memoryUsage: number;
    gpuUtilization: number;
  };
  outputMetrics: {
    facePreservation: number; // 0-1
    imageSharpness: number; // 0-1
    colorAccuracy: number; // 0-1
    backgroundQuality: number; // 0-1
  };
}

export interface UserFeedback {
  overallRating: number; // 1-5
  likenessRating: number; // 1-5
  qualityRating: number; // 1-5
  speedRating: number; // 1-5
  comments?: string;
  wouldRecommend: boolean;
}

export interface ABTestAnalysis {
  testId: string;
  status: 'running' | 'completed' | 'paused';
  totalSamples: number;
  variantResults: VariantAnalysis[];
  statisticalSignificance: boolean;
  confidenceLevel: number;
  recommendation: {
    winningVariant: string;
    improvementPercent: number;
    confidence: number;
    reasoning: string[];
  };
}

export interface VariantAnalysis {
  variantId: string;
  sampleSize: number;
  metrics: {
    avgTrainingTime: number;
    avgCost: number;
    avgQualityScore: number;
    avgUserSatisfaction: number;
    conversionRate: number; // % of users who complete training
  };
  confidenceInterval: {
    lower: number;
    upper: number;
    metric: string;
  };
}

/**
 * A/B Testing Manager for training parameter optimization
 */
export class ABTestingManager {
  private activeTests: Map<string, ABTestConfig> = new Map();
  private testResults: Map<string, ABTestResult[]> = new Map();

  /**
   * Create a new A/B test for parameter comparison
   */
  createTest(config: ABTestConfig): void {
    // Validate traffic split
    const totalSplit = config.trafficSplit.reduce((sum, split) => sum + split, 0);
    if (Math.abs(totalSplit - 100) > 0.01) {
      throw new Error('Traffic split must sum to 100%');
    }

    if (config.variants.length !== config.trafficSplit.length) {
      throw new Error('Number of variants must match traffic split array length');
    }

    this.activeTests.set(config.testId, config);
    this.testResults.set(config.testId, []);
  }

  /**
   * Get the appropriate variant for a user based on A/B test configuration
   */
  getVariantForUser(testId: string, userId: string, imageCount: number): ABTestVariant | null {
    const test = this.activeTests.get(testId);
    if (!test || !test.isActive) {
      return null;
    }

    // Check if test is within date range
    const now = new Date();
    if (now < test.startDate || (test.endDate && now > test.endDate)) {
      return null;
    }

    // Use deterministic hash of userId to ensure consistent variant assignment
    const hash = this.hashString(userId + testId);
    const bucket = hash % 100;

    // Determine variant based on traffic split
    let cumulativeWeight = 0;
    for (let i = 0; i < test.variants.length; i++) {
      cumulativeWeight += test.trafficSplit[i];
      if (bucket < cumulativeWeight) {
        return test.variants[i];
      }
    }

    return test.variants[0]; // Fallback
  }

  /**
   * Record test result for analysis
   */
  recordResult(result: ABTestResult): void {
    const results = this.testResults.get(result.testId);
    if (results) {
      results.push(result);
    }
  }

  /**
   * Analyze A/B test results and determine statistical significance
   */
  analyzeTest(testId: string): ABTestAnalysis | null {
    const test = this.activeTests.get(testId);
    const results = this.testResults.get(testId);

    if (!test || !results || results.length === 0) {
      return null;
    }

    // Group results by variant
    const variantGroups = new Map<string, ABTestResult[]>();
    for (const result of results) {
      if (!variantGroups.has(result.variantId)) {
        variantGroups.set(result.variantId, []);
      }
      variantGroups.get(result.variantId)!.push(result);
    }

    // Calculate metrics for each variant
    const variantResults: VariantAnalysis[] = [];
    for (const [variantId, variantResults_] of variantGroups) {
      const analysis = this.calculateVariantMetrics(variantId, variantResults_);
      variantResults.push(analysis);
    }

    // Determine statistical significance and winning variant
    const significance = this.calculateStatisticalSignificance(variantResults);
    const recommendation = this.generateRecommendation(variantResults, test);

    return {
      testId,
      status: results.length >= test.minimumSampleSize ? 'completed' : 'running',
      totalSamples: results.length,
      variantResults,
      statisticalSignificance: significance.isSignificant,
      confidenceLevel: significance.confidence,
      recommendation
    };
  }

  /**
   * Get predefined A/B tests for common scenarios
   */
  static getPredefinedTests(): ABTestConfig[] {
    return [
      {
        testId: 'lora-rank-comparison',
        name: 'LoRA Rank Optimization',
        description: 'Compare different LoRA ranks for quality vs speed tradeoff',
        variants: [
          {
            id: 'rank-32',
            name: 'Rank 32 (Fast)',
            description: 'Lower rank for faster training',
            parameters: {
              resolution: 1024,
              learning_rate: 1e-4,
              max_train_steps: 1500,
              lora_rank: 32,
              lora_alpha: 32,
              train_batch_size: 1,
              gradient_accumulation_steps: 4,
              mixed_precision: 'bf16',
              use_8bit_adam: true,
              enable_xformers: true,
              save_steps: 500,
              warmup_steps: 150,
              scheduler_type: 'cosine',
              weight_decay: 0.01,
              max_grad_norm: 1.0
            },
            weight: 50
          },
          {
            id: 'rank-64',
            name: 'Rank 64 (Balanced)',
            description: 'Balanced rank for quality and speed',
            parameters: {
              resolution: 1024,
              learning_rate: 1e-4,
              max_train_steps: 1500,
              lora_rank: 64,
              lora_alpha: 64,
              train_batch_size: 1,
              gradient_accumulation_steps: 4,
              mixed_precision: 'bf16',
              use_8bit_adam: true,
              enable_xformers: true,
              save_steps: 500,
              warmup_steps: 150,
              scheduler_type: 'cosine',
              weight_decay: 0.01,
              max_grad_norm: 1.0
            },
            weight: 50
          }
        ],
        trafficSplit: [50, 50],
        startDate: new Date(),
        isActive: true,
        targetMetrics: ['qualityScore', 'trainingTime', 'userSatisfaction'],
        minimumSampleSize: 100
      },
      {
        testId: 'learning-rate-optimization',
        name: 'Learning Rate Optimization',
        description: 'Find optimal learning rate for convergence and quality',
        variants: [
          {
            id: 'lr-8e5',
            name: 'Conservative LR (8e-5)',
            description: 'Lower learning rate for stable convergence',
            parameters: {
              resolution: 1024,
              learning_rate: 8e-5,
              max_train_steps: 1800,
              lora_rank: 64,
              lora_alpha: 64,
              train_batch_size: 1,
              gradient_accumulation_steps: 4,
              mixed_precision: 'bf16',
              use_8bit_adam: true,
              enable_xformers: true,
              save_steps: 500,
              warmup_steps: 180,
              scheduler_type: 'cosine',
              weight_decay: 0.01,
              max_grad_norm: 1.0
            },
            weight: 33
          },
          {
            id: 'lr-1e4',
            name: 'Standard LR (1e-4)',
            description: 'Standard learning rate',
            parameters: {
              resolution: 1024,
              learning_rate: 1e-4,
              max_train_steps: 1500,
              lora_rank: 64,
              lora_alpha: 64,
              train_batch_size: 1,
              gradient_accumulation_steps: 4,
              mixed_precision: 'bf16',
              use_8bit_adam: true,
              enable_xformers: true,
              save_steps: 500,
              warmup_steps: 150,
              scheduler_type: 'cosine',
              weight_decay: 0.01,
              max_grad_norm: 1.0
            },
            weight: 34
          },
          {
            id: 'lr-12e4',
            name: 'Aggressive LR (1.2e-4)',
            description: 'Higher learning rate for faster convergence',
            parameters: {
              resolution: 1024,
              learning_rate: 1.2e-4,
              max_train_steps: 1200,
              lora_rank: 64,
              lora_alpha: 64,
              train_batch_size: 1,
              gradient_accumulation_steps: 4,
              mixed_precision: 'bf16',
              use_8bit_adam: true,
              enable_xformers: true,
              save_steps: 400,
              warmup_steps: 120,
              scheduler_type: 'cosine',
              weight_decay: 0.01,
              max_grad_norm: 1.0
            },
            weight: 33
          }
        ],
        trafficSplit: [33, 34, 33],
        startDate: new Date(),
        isActive: true,
        targetMetrics: ['qualityScore', 'convergenceRate', 'finalLoss'],
        minimumSampleSize: 150
      }
    ];
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private calculateVariantMetrics(variantId: string, results: ABTestResult[]): VariantAnalysis {
    const sampleSize = results.length;
    
    const avgTrainingTime = results.reduce((sum, r) => sum + r.metrics.trainingTime, 0) / sampleSize;
    const avgCost = results.reduce((sum, r) => sum + r.metrics.trainingCost, 0) / sampleSize;
    const avgQualityScore = results.reduce((sum, r) => sum + r.metrics.qualityScore, 0) / sampleSize;
    const avgUserSatisfaction = results.reduce((sum, r) => sum + r.metrics.userSatisfaction, 0) / sampleSize;
    const conversionRate = (results.filter(r => r.metrics.qualityScore > 0.7).length / sampleSize) * 100;

    // Calculate confidence interval for quality score (primary metric)
    const qualityScores = results.map(r => r.metrics.qualityScore);
    const stdDev = Math.sqrt(qualityScores.reduce((sum, score) => sum + Math.pow(score - avgQualityScore, 2), 0) / sampleSize);
    const marginOfError = 1.96 * (stdDev / Math.sqrt(sampleSize)); // 95% confidence

    return {
      variantId,
      sampleSize,
      metrics: {
        avgTrainingTime,
        avgCost,
        avgQualityScore,
        avgUserSatisfaction,
        conversionRate
      },
      confidenceInterval: {
        lower: avgQualityScore - marginOfError,
        upper: avgQualityScore + marginOfError,
        metric: 'qualityScore'
      }
    };
  }

  private calculateStatisticalSignificance(variants: VariantAnalysis[]): { isSignificant: boolean; confidence: number } {
    if (variants.length < 2) {
      return { isSignificant: false, confidence: 0 };
    }

    // Simple significance test based on confidence intervals
    const sortedVariants = variants.sort((a, b) => b.metrics.avgQualityScore - a.metrics.avgQualityScore);
    const best = sortedVariants[0];
    const second = sortedVariants[1];

    // Check if confidence intervals don't overlap
    const isSignificant = best.confidenceInterval.lower > second.confidenceInterval.upper;
    const confidence = isSignificant ? 95 : 80; // Simplified confidence calculation

    return { isSignificant, confidence };
  }

  private generateRecommendation(variants: VariantAnalysis[], test: ABTestConfig): ABTestAnalysis['recommendation'] {
    const sortedVariants = variants.sort((a, b) => b.metrics.avgQualityScore - a.metrics.avgQualityScore);
    const winner = sortedVariants[0];
    const baseline = sortedVariants[sortedVariants.length - 1];

    const improvementPercent = ((winner.metrics.avgQualityScore - baseline.metrics.avgQualityScore) / baseline.metrics.avgQualityScore) * 100;

    const reasoning: string[] = [];
    reasoning.push(`Highest quality score: ${winner.metrics.avgQualityScore.toFixed(3)}`);
    reasoning.push(`${improvementPercent.toFixed(1)}% improvement over baseline`);
    
    if (winner.metrics.avgTrainingTime < baseline.metrics.avgTrainingTime) {
      reasoning.push('Also provides faster training time');
    }
    
    if (winner.metrics.avgCost < baseline.metrics.avgCost) {
      reasoning.push('Lower training cost');
    }

    return {
      winningVariant: winner.variantId,
      improvementPercent: Math.round(improvementPercent * 100) / 100,
      confidence: winner.sampleSize >= test.minimumSampleSize ? 95 : 80,
      reasoning
    };
  }
}