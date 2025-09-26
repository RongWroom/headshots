/**
 * Training Performance Benchmarking and Optimization Service
 * Automated system for testing training performance, detecting regressions, and optimizing parameters
 */

import { createClient } from '@supabase/supabase-js';
import { Logger } from './logger';
import { QualityAssessmentService } from './quality-assessment';
import { trainingMonitoringService } from './training-monitoring';

// Performance benchmark interfaces
export interface PerformanceBenchmark {
  id: string;
  name: string;
  description: string;
  provider: string;
  training_config: TrainingConfiguration;
  test_images: string[];
  expected_metrics: ExpectedMetrics;
  created_at: string;
  updated_at: string;
}

export interface TrainingConfiguration {
  resolution: number;
  max_train_steps: number;
  lora_rank: number;
  learning_rate: number;
  train_batch_size: number;
  gradient_accumulation: number;
  mixed_precision: 'fp16' | 'bf16';
  use_xformers: boolean;
}

export interface ExpectedMetrics {
  max_training_time: number; // milliseconds
  min_quality_score: number;
  max_cost: number;
  min_success_rate: number;
}

export interface BenchmarkResult {
  id: string;
  benchmark_id: string;
  run_date: string;
  training_time: number;
  quality_score: number;
  cost: number;
  success: boolean;
  error_message?: string;
  performance_metrics: PerformanceMetrics;
  regression_detected: boolean;
  created_at: string;
}

export interface PerformanceMetrics {
  training_duration: number;
  queue_time: number;
  preprocessing_time: number;
  actual_training_time: number;
  postprocessing_time: number;
  memory_usage?: number;
  gpu_utilization?: number;
  steps_per_second: number;
  cost_per_step: number;
  quality_metrics: {
    clip_similarity: number;
    face_recognition_score: number;
    overall_quality: number;
  };
}

export interface RegressionAlert {
  id: string;
  benchmark_id: string;
  metric_type: string;
  current_value: number;
  baseline_value: number;
  regression_percentage: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected_at: string;
  resolved_at?: string;
  resolution_notes?: string;
}

export interface ParameterOptimization {
  id: string;
  provider: string;
  optimization_target: 'quality' | 'speed' | 'cost' | 'balanced';
  current_config: TrainingConfiguration;
  optimized_config: TrainingConfiguration;
  expected_improvement: {
    quality_improvement: number;
    speed_improvement: number;
    cost_reduction: number;
  };
  confidence_score: number;
  created_at: string;
  applied_at?: string;
  results?: OptimizationResults;
}

export interface OptimizationResults {
  actual_quality_improvement: number;
  actual_speed_improvement: number;
  actual_cost_reduction: number;
  success: boolean;
  notes: string;
}

export interface PerformanceReport {
  period: string;
  provider_comparisons: ProviderComparison[];
  configuration_analysis: ConfigurationAnalysis[];
  trend_analysis: TrendAnalysis;
  recommendations: string[];
  generated_at: string;
}

export interface ProviderComparison {
  provider: string;
  average_training_time: number;
  average_quality_score: number;
  average_cost: number;
  success_rate: number;
  total_jobs: number;
  rank: number;
}

export interface ConfigurationAnalysis {
  configuration: TrainingConfiguration;
  performance_score: number;
  usage_count: number;
  average_quality: number;
  average_time: number;
  average_cost: number;
  recommendation: string;
}

export interface TrendAnalysis {
  quality_trend: 'improving' | 'stable' | 'declining';
  speed_trend: 'improving' | 'stable' | 'declining';
  cost_trend: 'improving' | 'stable' | 'declining';
  trend_data: {
    date: string;
    quality: number;
    speed: number;
    cost: number;
  }[];
}

export class TrainingPerformanceBenchmarkingService {
  private supabase;
  private logger: Logger;
  private qualityService: QualityAssessmentService;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.logger = new Logger('PERFORMANCE_BENCHMARKING');
    this.qualityService = new QualityAssessmentService();
  }

  /**
   * Create a new performance benchmark
   */
  async createBenchmark(benchmark: Omit<PerformanceBenchmark, 'id' | 'created_at' | 'updated_at'>): Promise<PerformanceBenchmark> {
    this.logger.logInfo('CREATE_BENCHMARK', {
      name: benchmark.name,
      provider: benchmark.provider
    });

    const benchmarkData = {
      ...benchmark,
      id: this.generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('performance_benchmarks')
      .insert(benchmarkData)
      .select()
      .single();

    if (error) {
      this.logger.logError('CREATE_BENCHMARK_FAILED', error);
      throw new Error(`Failed to create benchmark: ${error.message}`);
    }

    this.logger.logSuccess('BENCHMARK_CREATED', { benchmarkId: data.id });
    return data;
  }

  /**
   * Run automated benchmarking for all active benchmarks
   */
  async runAutomatedBenchmarking(): Promise<BenchmarkResult[]> {
    this.logger.logInfo('RUN_AUTOMATED_BENCHMARKING', 'Starting automated benchmarking');

    const benchmarks = await this.getActiveBenchmarks();
    const results: BenchmarkResult[] = [];

    for (const benchmark of benchmarks) {
      try {
        const result = await this.runSingleBenchmark(benchmark);
        results.push(result);

        // Check for regressions
        await this.checkForRegressions(benchmark.id, result);
      } catch (error) {
        this.logger.logError('BENCHMARK_RUN_FAILED', error, {
          benchmarkId: benchmark.id
        });
      }
    }

    this.logger.logSuccess('AUTOMATED_BENCHMARKING_COMPLETE', {
      totalBenchmarks: benchmarks.length,
      successfulRuns: results.filter(r => r.success).length
    });

    return results;
  }

  /**
   * Run a single benchmark
   */
  async runSingleBenchmark(benchmark: PerformanceBenchmark): Promise<BenchmarkResult> {
    this.logger.logInfo('RUN_SINGLE_BENCHMARK', {
      benchmarkId: benchmark.id,
      provider: benchmark.provider
    });

    const startTime = Date.now();
    let trainingSession;
    let success = false;
    let errorMessage;
    let performanceMetrics: PerformanceMetrics;

    try {
      // Create training session for benchmark
      trainingSession = await trainingMonitoringService.createTrainingSession({
        model_id: parseInt(benchmark.id.replace(/\D/g, '')), // Extract numeric ID
        user_id: 'benchmark-system',
        provider: benchmark.provider,
        external_training_id: `benchmark-${benchmark.id}-${Date.now()}`,
        total_steps: benchmark.training_config.max_train_steps,
        training_config: benchmark.training_config
      });

      // Simulate training execution (in real implementation, this would trigger actual training)
      const trainingResult = await this.simulateTrainingExecution(
        benchmark.provider,
        benchmark.training_config,
        benchmark.test_images
      );

      // Calculate performance metrics
      performanceMetrics = await this.calculatePerformanceMetrics(
        trainingResult,
        benchmark.test_images
      );

      success = trainingResult.success;
      if (!success) {
        errorMessage = trainingResult.error;
      }

      // Update training session with results
      await trainingMonitoringService.updateTrainingSession(trainingSession.id, {
        status: success ? 'completed' : 'failed',
        training_completed_at: new Date().toISOString(),
        training_duration: performanceMetrics.training_duration,
        error_message: errorMessage
      });

    } catch (error) {
      this.logger.logError('BENCHMARK_EXECUTION_FAILED', error, {
        benchmarkId: benchmark.id
      });
      
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Create minimal performance metrics for failed run
      performanceMetrics = {
        training_duration: Date.now() - startTime,
        queue_time: 0,
        preprocessing_time: 0,
        actual_training_time: 0,
        postprocessing_time: 0,
        steps_per_second: 0,
        cost_per_step: 0,
        quality_metrics: {
          clip_similarity: 0,
          face_recognition_score: 0,
          overall_quality: 0
        }
      };
    }

    // Create benchmark result
    const result: BenchmarkResult = {
      id: this.generateId(),
      benchmark_id: benchmark.id,
      run_date: new Date().toISOString(),
      training_time: performanceMetrics.training_duration,
      quality_score: performanceMetrics.quality_metrics.overall_quality,
      cost: performanceMetrics.cost_per_step * benchmark.training_config.max_train_steps,
      success,
      error_message: errorMessage,
      performance_metrics: performanceMetrics,
      regression_detected: false, // Will be updated by regression detection
      created_at: new Date().toISOString()
    };

    // Store result
    await this.storeBenchmarkResult(result);

    this.logger.logInfo('BENCHMARK_COMPLETED', {
      benchmarkId: benchmark.id,
      success,
      trainingTime: performanceMetrics.training_duration,
      qualityScore: performanceMetrics.quality_metrics.overall_quality
    });

    return result;
  }

  /**
   * Check for performance regressions
   */
  async checkForRegressions(benchmarkId: string, currentResult: BenchmarkResult): Promise<RegressionAlert[]> {
    this.logger.logInfo('CHECK_REGRESSIONS', { benchmarkId });

    const alerts: RegressionAlert[] = [];
    const historicalResults = await this.getHistoricalResults(benchmarkId, 10);
    
    if (historicalResults.length < 3) {
      // Need at least 3 historical results for meaningful regression detection
      return alerts;
    }

    const baseline = this.calculateBaseline(historicalResults);
    const regressionThreshold = 0.15; // 15% regression threshold

    // Check training time regression
    const timeRegression = (currentResult.training_time - baseline.averageTrainingTime) / baseline.averageTrainingTime;
    if (timeRegression > regressionThreshold) {
      alerts.push(await this.createRegressionAlert(
        benchmarkId,
        'training_time',
        currentResult.training_time,
        baseline.averageTrainingTime,
        timeRegression,
        this.calculateSeverity(timeRegression)
      ));
    }

    // Check quality regression
    const qualityRegression = (baseline.averageQuality - currentResult.quality_score) / baseline.averageQuality;
    if (qualityRegression > regressionThreshold) {
      alerts.push(await this.createRegressionAlert(
        benchmarkId,
        'quality_score',
        currentResult.quality_score,
        baseline.averageQuality,
        qualityRegression,
        this.calculateSeverity(qualityRegression)
      ));
    }

    // Check cost regression
    const costRegression = (currentResult.cost - baseline.averageCost) / baseline.averageCost;
    if (costRegression > regressionThreshold) {
      alerts.push(await this.createRegressionAlert(
        benchmarkId,
        'cost',
        currentResult.cost,
        baseline.averageCost,
        costRegression,
        this.calculateSeverity(costRegression)
      ));
    }

    // Update result with regression detection status
    if (alerts.length > 0) {
      await this.updateBenchmarkResult(currentResult.id, { regression_detected: true });
    }

    if (alerts.length > 0) {
      this.logger.logWarning('REGRESSIONS_DETECTED', `${alerts.length} regressions detected`, {
        benchmarkId,
        alerts: alerts.map(a => ({ metric: a.metric_type, severity: a.severity }))
      });
    }

    return alerts;
  }

  /**
   * Generate parameter optimization recommendations
   */
  async generateParameterOptimizations(
    provider: string,
    target: 'quality' | 'speed' | 'cost' | 'balanced' = 'balanced'
  ): Promise<ParameterOptimization[]> {
    this.logger.logInfo('GENERATE_PARAMETER_OPTIMIZATIONS', { provider, target });

    const historicalData = await this.getHistoricalPerformanceData(provider);
    const optimizations: ParameterOptimization[] = [];

    // Analyze different configuration patterns
    const configAnalysis = await this.analyzeConfigurationPerformance(historicalData);
    
    for (const analysis of configAnalysis) {
      const optimization = await this.generateOptimizationRecommendation(
        provider,
        analysis,
        target
      );
      
      if (optimization) {
        optimizations.push(optimization);
      }
    }

    // Store optimizations
    for (const optimization of optimizations) {
      await this.storeParameterOptimization(optimization);
    }

    this.logger.logSuccess('PARAMETER_OPTIMIZATIONS_GENERATED', {
      provider,
      count: optimizations.length
    });

    return optimizations;
  }

  /**
   * Generate performance comparison report
   */
  async generatePerformanceReport(
    startDate: string,
    endDate: string
  ): Promise<PerformanceReport> {
    this.logger.logInfo('GENERATE_PERFORMANCE_REPORT', { startDate, endDate });

    const [providerComparisons, configurationAnalysis, trendAnalysis] = await Promise.all([
      this.generateProviderComparisons(startDate, endDate),
      this.generateConfigurationAnalysis(startDate, endDate),
      this.generateTrendAnalysis(startDate, endDate)
    ]);

    const recommendations = this.generateRecommendations(
      providerComparisons,
      configurationAnalysis,
      trendAnalysis
    );

    const report: PerformanceReport = {
      period: `${startDate} to ${endDate}`,
      provider_comparisons: providerComparisons,
      configuration_analysis: configurationAnalysis,
      trend_analysis: trendAnalysis,
      recommendations,
      generated_at: new Date().toISOString()
    };

    // Store report
    await this.storePerformanceReport(report);

    this.logger.logSuccess('PERFORMANCE_REPORT_GENERATED', {
      period: report.period,
      providersAnalyzed: providerComparisons.length,
      configurationsAnalyzed: configurationAnalysis.length
    });

    return report;
  }

  // Helper methods

  private async getActiveBenchmarks(): Promise<PerformanceBenchmark[]> {
    const { data, error } = await this.supabase
      .from('performance_benchmarks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.logError('GET_ACTIVE_BENCHMARKS_FAILED', error);
      throw new Error(`Failed to get benchmarks: ${error.message}`);
    }

    return data || [];
  }

  private async simulateTrainingExecution(
    provider: string,
    config: TrainingConfiguration,
    testImages: string[]
  ): Promise<{ success: boolean; error?: string; duration: number; qualityScore: number }> {
    // Simulate training time based on configuration
    const baseTime = config.max_train_steps * (1000 / config.train_batch_size); // milliseconds
    const actualTime = baseTime + (Math.random() * baseTime * 0.2); // Add 0-20% variance

    // Simulate success rate (95% for well-configured jobs)
    const success = Math.random() > 0.05;

    if (!success) {
      return {
        success: false,
        error: 'Simulated training failure',
        duration: actualTime,
        qualityScore: 0
      };
    }

    // Simulate quality score based on configuration
    const qualityScore = this.simulateQualityScore(config);

    // Add processing delay to simulate real training
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      duration: actualTime,
      qualityScore
    };
  }

  private simulateQualityScore(config: TrainingConfiguration): number {
    // Base quality score
    let quality = 0.75;

    // Adjust based on configuration
    if (config.resolution >= 1024) quality += 0.05;
    if (config.max_train_steps >= 1000) quality += 0.05;
    if (config.lora_rank >= 64) quality += 0.03;
    if (config.learning_rate >= 1e-4 && config.learning_rate <= 1e-3) quality += 0.02;

    // Add some randomness
    quality += (Math.random() - 0.5) * 0.1;

    return Math.min(1.0, Math.max(0.0, quality));
  }

  private async calculatePerformanceMetrics(
    trainingResult: any,
    testImages: string[]
  ): Promise<PerformanceMetrics> {
    const queueTime = Math.random() * 30000; // 0-30 seconds
    const preprocessingTime = testImages.length * 1000; // 1 second per image
    const actualTrainingTime = trainingResult.duration;
    const postprocessingTime = Math.random() * 5000; // 0-5 seconds

    return {
      training_duration: actualTrainingTime,
      queue_time: queueTime,
      preprocessing_time: preprocessingTime,
      actual_training_time: actualTrainingTime - preprocessingTime - postprocessingTime,
      postprocessing_time: postprocessingTime,
      steps_per_second: 1000 / (actualTrainingTime / 1000), // Approximate
      cost_per_step: 0.001 + (Math.random() * 0.002), // $0.001-0.003 per step
      quality_metrics: {
        clip_similarity: trainingResult.qualityScore * 0.9 + (Math.random() * 0.1),
        face_recognition_score: trainingResult.qualityScore * 1.1 - (Math.random() * 0.1),
        overall_quality: trainingResult.qualityScore
      }
    };
  }

  private calculateBaseline(results: BenchmarkResult[]): {
    averageTrainingTime: number;
    averageQuality: number;
    averageCost: number;
  } {
    const successfulResults = results.filter(r => r.success);
    
    return {
      averageTrainingTime: successfulResults.reduce((sum, r) => sum + r.training_time, 0) / successfulResults.length,
      averageQuality: successfulResults.reduce((sum, r) => sum + r.quality_score, 0) / successfulResults.length,
      averageCost: successfulResults.reduce((sum, r) => sum + r.cost, 0) / successfulResults.length
    };
  }

  private calculateSeverity(regressionPercentage: number): 'low' | 'medium' | 'high' | 'critical' {
    if (regressionPercentage > 0.5) return 'critical';
    if (regressionPercentage > 0.3) return 'high';
    if (regressionPercentage > 0.2) return 'medium';
    return 'low';
  }

  private generateId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Database operations (simplified implementations)
  private async storeBenchmarkResult(result: BenchmarkResult): Promise<void> {
    const { error } = await this.supabase
      .from('benchmark_results')
      .insert(result);

    if (error) {
      this.logger.logError('STORE_BENCHMARK_RESULT_FAILED', error);
      throw new Error(`Failed to store benchmark result: ${error.message}`);
    }
  }

  private async createRegressionAlert(
    benchmarkId: string,
    metricType: string,
    currentValue: number,
    baselineValue: number,
    regressionPercentage: number,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<RegressionAlert> {
    const alert: RegressionAlert = {
      id: this.generateId(),
      benchmark_id: benchmarkId,
      metric_type: metricType,
      current_value: currentValue,
      baseline_value: baselineValue,
      regression_percentage: regressionPercentage,
      severity,
      detected_at: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('regression_alerts')
      .insert(alert);

    if (error) {
      this.logger.logError('CREATE_REGRESSION_ALERT_FAILED', error);
      throw new Error(`Failed to create regression alert: ${error.message}`);
    }

    return alert;
  }

  private async getHistoricalResults(benchmarkId: string, limit: number): Promise<BenchmarkResult[]> {
    const { data, error } = await this.supabase
      .from('benchmark_results')
      .select('*')
      .eq('benchmark_id', benchmarkId)
      .eq('success', true)
      .order('run_date', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.logError('GET_HISTORICAL_RESULTS_FAILED', error);
      return [];
    }

    return data || [];
  }

  private async updateBenchmarkResult(resultId: string, updates: Partial<BenchmarkResult>): Promise<void> {
    const { error } = await this.supabase
      .from('benchmark_results')
      .update(updates)
      .eq('id', resultId);

    if (error) {
      this.logger.logError('UPDATE_BENCHMARK_RESULT_FAILED', error);
    }
  }

  private async getHistoricalPerformanceData(provider: string): Promise<BenchmarkResult[]> {
    const { data, error } = await this.supabase
      .from('benchmark_results')
      .select('*')
      .eq('success', true)
      .order('run_date', { ascending: false })
      .limit(100);

    if (error) {
      this.logger.logError('GET_HISTORICAL_PERFORMANCE_DATA_FAILED', error);
      return [];
    }

    return (data || []).filter(result => 
      result.performance_metrics && 
      JSON.stringify(result.performance_metrics).includes(provider)
    );
  }

  private async analyzeConfigurationPerformance(data: BenchmarkResult[]): Promise<ConfigurationAnalysis[]> {
    // Group results by configuration
    const configGroups = new Map<string, BenchmarkResult[]>();
    
    for (const result of data) {
      const configKey = JSON.stringify(result.performance_metrics);
      if (!configGroups.has(configKey)) {
        configGroups.set(configKey, []);
      }
      configGroups.get(configKey)!.push(result);
    }

    const analyses: ConfigurationAnalysis[] = [];
    
    for (const [configKey, results] of configGroups) {
      if (results.length < 2) continue; // Need at least 2 results for analysis
      
      const avgQuality = results.reduce((sum, r) => sum + r.quality_score, 0) / results.length;
      const avgTime = results.reduce((sum, r) => sum + r.training_time, 0) / results.length;
      const avgCost = results.reduce((sum, r) => sum + r.cost, 0) / results.length;
      
      // Calculate performance score (higher is better)
      const performanceScore = (avgQuality * 0.5) + ((1 / avgTime) * 0.3) + ((1 / avgCost) * 0.2);
      
      analyses.push({
        configuration: JSON.parse(configKey),
        performance_score: performanceScore,
        usage_count: results.length,
        average_quality: avgQuality,
        average_time: avgTime,
        average_cost: avgCost,
        recommendation: this.generateConfigRecommendation(avgQuality, avgTime, avgCost)
      });
    }

    return analyses.sort((a, b) => b.performance_score - a.performance_score);
  }

  private generateConfigRecommendation(quality: number, time: number, cost: number): string {
    if (quality < 0.8) return 'Consider increasing training steps or adjusting learning rate for better quality';
    if (time > 1800000) return 'Training time is high - consider optimizing batch size or steps';
    if (cost > 5.0) return 'Cost is high - consider reducing training steps or using smaller model';
    return 'Configuration performs well across all metrics';
  }

  private async generateOptimizationRecommendation(
    provider: string,
    analysis: ConfigurationAnalysis,
    target: 'quality' | 'speed' | 'cost' | 'balanced'
  ): Promise<ParameterOptimization | null> {
    // Simple optimization logic - in practice, this would use ML models
    const currentConfig = analysis.configuration;
    const optimizedConfig = { ...currentConfig };
    
    let expectedImprovement = {
      quality_improvement: 0,
      speed_improvement: 0,
      cost_reduction: 0
    };

    switch (target) {
      case 'quality':
        if (currentConfig.max_train_steps < 1500) {
          optimizedConfig.max_train_steps = Math.min(2000, currentConfig.max_train_steps * 1.3);
          expectedImprovement.quality_improvement = 0.05;
        }
        break;
      case 'speed':
        if (currentConfig.train_batch_size < 4) {
          optimizedConfig.train_batch_size = Math.min(4, currentConfig.train_batch_size * 2);
          expectedImprovement.speed_improvement = 0.2;
        }
        break;
      case 'cost':
        if (currentConfig.max_train_steps > 800) {
          optimizedConfig.max_train_steps = Math.max(800, currentConfig.max_train_steps * 0.8);
          expectedImprovement.cost_reduction = 0.15;
        }
        break;
      case 'balanced':
        // Balanced optimization
        if (analysis.average_quality < 0.85 && currentConfig.max_train_steps < 1200) {
          optimizedConfig.max_train_steps = 1200;
          expectedImprovement.quality_improvement = 0.03;
        }
        if (analysis.average_time > 1200000 && currentConfig.train_batch_size < 3) {
          optimizedConfig.train_batch_size = 3;
          expectedImprovement.speed_improvement = 0.1;
        }
        break;
    }

    // Only return optimization if there's meaningful improvement
    const hasImprovement = Object.values(expectedImprovement).some(v => v > 0);
    if (!hasImprovement) return null;

    return {
      id: this.generateId(),
      provider,
      optimization_target: target,
      current_config: currentConfig,
      optimized_config: optimizedConfig,
      expected_improvement: expectedImprovement,
      confidence_score: 0.7 + (Math.random() * 0.2), // 0.7-0.9
      created_at: new Date().toISOString()
    };
  }

  private async storeParameterOptimization(optimization: ParameterOptimization): Promise<void> {
    const { error } = await this.supabase
      .from('parameter_optimizations')
      .insert(optimization);

    if (error) {
      this.logger.logError('STORE_PARAMETER_OPTIMIZATION_FAILED', error);
    }
  }

  private async generateProviderComparisons(startDate: string, endDate: string): Promise<ProviderComparison[]> {
    // Simulate provider comparison data
    const providers = ['runpod', 'fal', 'replicate'];
    const comparisons: ProviderComparison[] = [];

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      comparisons.push({
        provider,
        average_training_time: 900000 + (Math.random() * 600000), // 15-25 minutes
        average_quality_score: 0.8 + (Math.random() * 0.15), // 0.8-0.95
        average_cost: 1.5 + (Math.random() * 2.0), // $1.5-3.5
        success_rate: 0.9 + (Math.random() * 0.09), // 90-99%
        total_jobs: 50 + Math.floor(Math.random() * 100), // 50-150 jobs
        rank: i + 1
      });
    }

    return comparisons.sort((a, b) => {
      // Rank by balanced score (quality * success_rate / (time * cost))
      const scoreA = (a.average_quality_score * a.success_rate) / (a.average_training_time * a.average_cost);
      const scoreB = (b.average_quality_score * b.success_rate) / (b.average_training_time * b.average_cost);
      return scoreB - scoreA;
    }).map((comp, index) => ({ ...comp, rank: index + 1 }));
  }

  private async generateConfigurationAnalysis(startDate: string, endDate: string): Promise<ConfigurationAnalysis[]> {
    // This would analyze actual configuration performance data
    // For now, return simulated analysis
    return [
      {
        configuration: {
          resolution: 1024,
          max_train_steps: 1500,
          lora_rank: 64,
          learning_rate: 1e-4,
          train_batch_size: 2,
          gradient_accumulation: 4,
          mixed_precision: 'fp16',
          use_xformers: true
        },
        performance_score: 0.85,
        usage_count: 45,
        average_quality: 0.87,
        average_time: 1200000,
        average_cost: 2.1,
        recommendation: 'Optimal configuration for balanced performance'
      }
    ];
  }

  private async generateTrendAnalysis(startDate: string, endDate: string): Promise<TrendAnalysis> {
    // Generate simulated trend data
    const trendData = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i < daysDiff; i += 7) { // Weekly data points
      const date = new Date(start.getTime() + (i * 24 * 60 * 60 * 1000));
      trendData.push({
        date: date.toISOString().split('T')[0],
        quality: 0.8 + (Math.random() * 0.1) + (i * 0.001), // Slight improvement over time
        speed: 1.0 - (i * 0.002) + (Math.random() * 0.1), // Slight speed improvement
        cost: 1.0 + (Math.random() * 0.1) - (i * 0.001) // Slight cost reduction
      });
    }

    return {
      quality_trend: 'improving',
      speed_trend: 'improving',
      cost_trend: 'improving',
      trend_data: trendData
    };
  }

  private generateRecommendations(
    providerComparisons: ProviderComparison[],
    configurationAnalysis: ConfigurationAnalysis[],
    trendAnalysis: TrendAnalysis
  ): string[] {
    const recommendations: string[] = [];

    // Provider recommendations
    const topProvider = providerComparisons[0];
    recommendations.push(`Consider using ${topProvider.provider} as primary provider (best overall performance)`);

    // Configuration recommendations
    if (configurationAnalysis.length > 0) {
      const topConfig = configurationAnalysis[0];
      recommendations.push(`Optimal configuration: ${topConfig.recommendation}`);
    }

    // Trend recommendations
    if (trendAnalysis.quality_trend === 'declining') {
      recommendations.push('Quality trend is declining - review training parameters and data quality');
    }
    if (trendAnalysis.cost_trend === 'declining') {
      recommendations.push('Cost optimization is working well - maintain current efficiency measures');
    }

    return recommendations;
  }

  private async storePerformanceReport(report: PerformanceReport): Promise<void> {
    const { error } = await this.supabase
      .from('performance_reports')
      .insert({
        period: report.period,
        report_data: report,
        generated_at: report.generated_at
      });

    if (error) {
      this.logger.logError('STORE_PERFORMANCE_REPORT_FAILED', error);
    }
  }
}

// Export singleton instance
export const performanceBenchmarkingService = new TrainingPerformanceBenchmarkingService();