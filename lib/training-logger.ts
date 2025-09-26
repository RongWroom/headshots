/**
 * Comprehensive Training Logger
 * Provides detailed logging for training operations with parameter tracking,
 * performance metrics, and debugging capabilities
 */

import { Logger } from './logger';

export interface TrainingLogEntry {
  id: string;
  trainingId: string;
  userId?: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  stage: string;
  message: string;
  parameters?: TrainingParameters;
  metrics?: PerformanceMetrics;
  error?: ErrorDetails;
  metadata?: Record<string, any>;
}

export interface TrainingParameters {
  modelName: string;
  imageCount: number;
  resolution: number;
  maxTrainSteps: number;
  loraRank: number;
  learningRate: number;
  trainBatchSize: number;
  gradientAccumulation: number;
  mixedPrecision: string;
  useXformers: boolean;
  triggerWord: string;
  packSlug?: string;
  provider: 'runpod' | 'replicate' | 'fal' | 'other';
}

export interface PerformanceMetrics {
  startTime: string;
  endTime?: string;
  duration?: number;
  memoryUsage?: {
    peak: number;
    average: number;
    current: number;
  };
  gpuUsage?: {
    utilization: number;
    memoryUsed: number;
    memoryTotal: number;
  };
  trainingSpeed?: {
    stepsPerSecond: number;
    imagesPerSecond: number;
    estimatedTimeRemaining?: number;
  };
  qualityMetrics?: {
    clipScore?: number;
    faceRecognitionScore?: number;
    overallQuality?: number;
  };
  costMetrics?: {
    estimatedCost: number;
    actualCost?: number;
    gpuHours: number;
  };
}

export interface ErrorDetails {
  code: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  recoverable: boolean;
  retryCount?: number;
  suggestions?: string[];
}

export interface TrainingSession {
  trainingId: string;
  userId?: string;
  startTime: string;
  parameters: TrainingParameters;
  logs: TrainingLogEntry[];
  currentStage: string;
  status: 'queued' | 'preparing' | 'training' | 'completed' | 'failed' | 'cancelled';
  metrics: PerformanceMetrics;
}

export class TrainingLogger extends Logger {
  private trainingId: string;
  private session: TrainingSession;
  private logBuffer: TrainingLogEntry[] = [];
  private metricsInterval?: NodeJS.Timeout;

  constructor(trainingId: string, parameters: TrainingParameters, userId?: string) {
    super('training', `training_${trainingId}`, userId);
    this.trainingId = trainingId;
    
    this.session = {
      trainingId,
      userId,
      startTime: new Date().toISOString(),
      parameters,
      logs: [],
      currentStage: 'initializing',
      status: 'queued',
      metrics: {
        startTime: new Date().toISOString()
      }
    };

    this.logTrainingStart();
    this.startMetricsCollection();
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createLogEntry(
    level: TrainingLogEntry['level'],
    stage: string,
    message: string,
    metadata?: Record<string, any>,
    error?: ErrorDetails
  ): TrainingLogEntry {
    return {
      id: this.generateLogId(),
      trainingId: this.trainingId,
      userId: this.userId,
      timestamp: new Date().toISOString(),
      level,
      stage,
      message,
      parameters: this.session.parameters,
      metrics: this.session.metrics,
      error,
      metadata
    };
  }

  private addLogEntry(entry: TrainingLogEntry) {
    this.session.logs.push(entry);
    this.logBuffer.push(entry);
    
    // Console output for immediate visibility
    const logLevel = entry.level.toUpperCase();
    const logMessage = `[TRAINING_${logLevel}] ${entry.stage}: ${entry.message}`;
    const logData = {
      trainingId: entry.trainingId,
      timestamp: entry.timestamp,
      parameters: entry.parameters,
      metrics: entry.metrics,
      metadata: entry.metadata,
      error: entry.error
    };

    switch (entry.level) {
      case 'debug':
        console.debug(logMessage, logData);
        break;
      case 'info':
        console.log(logMessage, logData);
        break;
      case 'warn':
        console.warn(logMessage, logData);
        break;
      case 'error':
        console.error(logMessage, logData);
        break;
    }

    // Persist logs asynchronously
    this.persistLogs();
  }

  logTrainingStart() {
    this.session.status = 'preparing';
    this.session.currentStage = 'initialization';
    
    const entry = this.createLogEntry(
      'info',
      'initialization',
      'Training session started',
      {
        provider: this.session.parameters.provider,
        imageCount: this.session.parameters.imageCount,
        modelName: this.session.parameters.modelName
      }
    );
    
    this.addLogEntry(entry);
  }

  logStageTransition(fromStage: string, toStage: string, metadata?: Record<string, any>) {
    this.session.currentStage = toStage;
    
    const entry = this.createLogEntry(
      'info',
      'stage_transition',
      `Transitioning from ${fromStage} to ${toStage}`,
      {
        fromStage,
        toStage,
        ...metadata
      }
    );
    
    this.addLogEntry(entry);
  }

  logParameterOptimization(originalParams: Partial<TrainingParameters>, optimizedParams: Partial<TrainingParameters>) {
    const entry = this.createLogEntry(
      'info',
      'parameter_optimization',
      'Training parameters optimized',
      {
        originalParams,
        optimizedParams,
        changes: this.getParameterChanges(originalParams, optimizedParams)
      }
    );
    
    this.addLogEntry(entry);
  }

  logTrainingProgress(step: number, totalSteps: number, loss?: number, additionalMetrics?: Record<string, number>) {
    const progress = (step / totalSteps) * 100;
    
    // Update metrics
    if (this.session.metrics.trainingSpeed) {
      const elapsed = Date.now() - new Date(this.session.metrics.startTime).getTime();
      const stepsPerSecond = step / (elapsed / 1000);
      const estimatedTimeRemaining = (totalSteps - step) / stepsPerSecond;
      
      this.session.metrics.trainingSpeed = {
        stepsPerSecond,
        imagesPerSecond: stepsPerSecond * this.session.parameters.trainBatchSize,
        estimatedTimeRemaining
      };
    }

    const entry = this.createLogEntry(
      'debug',
      'training_progress',
      `Training progress: ${step}/${totalSteps} (${progress.toFixed(1)}%)`,
      {
        step,
        totalSteps,
        progress,
        loss,
        ...additionalMetrics
      }
    );
    
    this.addLogEntry(entry);
  }

  logPerformanceMetrics(metrics: Partial<PerformanceMetrics>) {
    this.session.metrics = { ...this.session.metrics, ...metrics };
    
    const entry = this.createLogEntry(
      'debug',
      'performance_metrics',
      'Performance metrics updated',
      { metrics }
    );
    
    this.addLogEntry(entry);
  }

  logResourceUsage(memoryUsage?: PerformanceMetrics['memoryUsage'], gpuUsage?: PerformanceMetrics['gpuUsage']) {
    if (memoryUsage) {
      this.session.metrics.memoryUsage = memoryUsage;
    }
    if (gpuUsage) {
      this.session.metrics.gpuUsage = gpuUsage;
    }

    const entry = this.createLogEntry(
      'debug',
      'resource_usage',
      'Resource usage updated',
      {
        memoryUsage,
        gpuUsage
      }
    );
    
    this.addLogEntry(entry);
  }

  logQualityAssessment(qualityMetrics: PerformanceMetrics['qualityMetrics']) {
    this.session.metrics.qualityMetrics = qualityMetrics;
    
    const entry = this.createLogEntry(
      'info',
      'quality_assessment',
      'Quality assessment completed',
      { qualityMetrics }
    );
    
    this.addLogEntry(entry);
  }

  logTrainingError(stage: string, error: Error | string, recoverable: boolean = false, retryCount: number = 0) {
    const errorDetails: ErrorDetails = {
      code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      recoverable,
      retryCount,
      suggestions: this.generateErrorSuggestions(error, stage)
    };

    this.session.status = recoverable ? this.session.status : 'failed';

    const entry = this.createLogEntry(
      'error',
      stage,
      `Training error: ${errorDetails.message}`,
      {
        recoverable,
        retryCount
      },
      errorDetails
    );
    
    this.addLogEntry(entry);
  }

  logTrainingCompletion(success: boolean, finalMetrics?: Partial<PerformanceMetrics>) {
    this.session.status = success ? 'completed' : 'failed';
    this.session.metrics.endTime = new Date().toISOString();
    
    if (finalMetrics) {
      this.session.metrics = { ...this.session.metrics, ...finalMetrics };
    }

    // Calculate final duration
    const startTime = new Date(this.session.metrics.startTime).getTime();
    const endTime = new Date(this.session.metrics.endTime).getTime();
    this.session.metrics.duration = endTime - startTime;

    const entry = this.createLogEntry(
      success ? 'info' : 'error',
      'completion',
      `Training ${success ? 'completed successfully' : 'failed'}`,
      {
        success,
        duration: this.session.metrics.duration,
        finalMetrics
      }
    );
    
    this.addLogEntry(entry);
    this.stopMetricsCollection();
  }

  private getParameterChanges(original: Partial<TrainingParameters>, optimized: Partial<TrainingParameters>): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};
    
    for (const key in optimized) {
      if (original[key as keyof TrainingParameters] !== optimized[key as keyof TrainingParameters]) {
        changes[key] = {
          from: original[key as keyof TrainingParameters],
          to: optimized[key as keyof TrainingParameters]
        };
      }
    }
    
    return changes;
  }

  private generateErrorSuggestions(error: Error | string, stage: string): string[] {
    const suggestions: string[] = [];
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    if (errorMessage.includes('out of memory') || errorMessage.includes('oom')) {
      suggestions.push('Reduce batch size or resolution');
      suggestions.push('Enable gradient checkpointing');
      suggestions.push('Use mixed precision training');
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
      suggestions.push('Check network connectivity');
      suggestions.push('Retry the operation');
      suggestions.push('Verify API endpoints are accessible');
    }

    if (errorMessage.includes('invalid') && stage.includes('parameter')) {
      suggestions.push('Validate training parameters');
      suggestions.push('Check parameter ranges and types');
    }

    if (errorMessage.includes('image') || errorMessage.includes('file')) {
      suggestions.push('Verify image files are accessible');
      suggestions.push('Check image format and resolution');
      suggestions.push('Validate image URLs');
    }

    return suggestions;
  }

  private startMetricsCollection() {
    // Collect metrics every 30 seconds during training
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
  }

  private stopMetricsCollection() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  private async collectSystemMetrics() {
    try {
      // This would typically collect actual system metrics
      // For now, we'll simulate some basic metrics
      const memoryUsage = process.memoryUsage();
      
      this.logResourceUsage({
        peak: memoryUsage.heapUsed,
        average: memoryUsage.heapUsed,
        current: memoryUsage.heapUsed
      });
    } catch (error) {
      // Don't let metrics collection errors break training
      console.warn('Failed to collect system metrics:', error);
    }
  }

  private async persistLogs() {
    try {
      // Batch persist logs to avoid overwhelming the system
      if (this.logBuffer.length >= 10) {
        const logsToSave = [...this.logBuffer];
        this.logBuffer = [];

        // Save to database or file system
        await this.saveLogs(logsToSave);
      }
    } catch (error) {
      console.warn('Failed to persist training logs:', error);
    }
  }

  private async saveLogs(logs: TrainingLogEntry[]) {
    // This would typically save to a database or file system
    // For now, we'll just ensure they're available for debugging endpoints
    
    // Store in memory for debugging endpoints
    if (typeof global !== 'undefined') {
      if (!global.trainingLogs) {
        global.trainingLogs = new Map();
      }
      global.trainingLogs.set(this.trainingId, {
        session: this.session,
        logs
      });
    }
  }

  // Public methods for accessing session data
  getSession(): TrainingSession {
    return { ...this.session };
  }

  getLogs(): TrainingLogEntry[] {
    return [...this.session.logs];
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.session.metrics };
  }

  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify({
      session: this.session,
      exportTime: new Date().toISOString()
    }, null, 2);
  }
}

// Utility functions for log analysis
export function analyzeTrainingLogs(logs: TrainingLogEntry[]): {
  errorCount: number;
  warningCount: number;
  averageStepTime?: number;
  bottlenecks: string[];
  recommendations: string[];
} {
  const errorCount = logs.filter(log => log.level === 'error').length;
  const warningCount = logs.filter(log => log.level === 'warn').length;
  
  const progressLogs = logs.filter(log => log.stage === 'training_progress');
  const averageStepTime = progressLogs.length > 1 ? 
    (new Date(progressLogs[progressLogs.length - 1].timestamp).getTime() - 
     new Date(progressLogs[0].timestamp).getTime()) / progressLogs.length : undefined;

  const bottlenecks: string[] = [];
  const recommendations: string[] = [];

  // Analyze for bottlenecks
  const memoryLogs = logs.filter(log => log.metadata?.memoryUsage);
  if (memoryLogs.some(log => log.metadata?.memoryUsage?.current > 0.9)) {
    bottlenecks.push('High memory usage detected');
    recommendations.push('Consider reducing batch size or resolution');
  }

  const errorLogs = logs.filter(log => log.level === 'error');
  if (errorLogs.length > 0) {
    const commonErrors = errorLogs.reduce((acc, log) => {
      const errorType = log.error?.code || 'UNKNOWN';
      acc[errorType] = (acc[errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonError = Object.entries(commonErrors)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (mostCommonError) {
      bottlenecks.push(`Frequent ${mostCommonError[0]} errors (${mostCommonError[1]} occurrences)`);
    }
  }

  return {
    errorCount,
    warningCount,
    averageStepTime,
    bottlenecks,
    recommendations
  };
}

export function searchLogs(logs: TrainingLogEntry[], query: {
  level?: TrainingLogEntry['level'];
  stage?: string;
  timeRange?: { start: string; end: string };
  textSearch?: string;
}): TrainingLogEntry[] {
  return logs.filter(log => {
    if (query.level && log.level !== query.level) return false;
    if (query.stage && log.stage !== query.stage) return false;
    
    if (query.timeRange) {
      const logTime = new Date(log.timestamp).getTime();
      const startTime = new Date(query.timeRange.start).getTime();
      const endTime = new Date(query.timeRange.end).getTime();
      if (logTime < startTime || logTime > endTime) return false;
    }
    
    if (query.textSearch) {
      const searchText = query.textSearch.toLowerCase();
      const logText = JSON.stringify(log).toLowerCase();
      if (!logText.includes(searchText)) return false;
    }
    
    return true;
  });
}