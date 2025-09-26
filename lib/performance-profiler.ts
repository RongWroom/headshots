/**
 * Performance Profiling Service
 * Provides detailed performance monitoring and bottleneck identification
 * for training operations
 */

export interface PerformanceProfile {
  id: string;
  trainingId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  stages: StageProfile[];
  systemMetrics: SystemMetrics[];
  bottlenecks: Bottleneck[];
  recommendations: string[];
}

export interface StageProfile {
  stage: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  operations: OperationProfile[];
  metrics: {
    cpuUsage?: number;
    memoryUsage?: number;
    gpuUsage?: number;
    diskIO?: number;
    networkIO?: number;
  };
}

export interface OperationProfile {
  operation: string;
  startTime: string;
  endTime: string;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  gpu?: {
    utilization: number;
    memoryUsed: number;
    memoryTotal: number;
    temperature?: number;
  };
  disk?: {
    readBytes: number;
    writeBytes: number;
    readOps: number;
    writeOps: number;
  };
  network?: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
}

export interface Bottleneck {
  type: 'cpu' | 'memory' | 'gpu' | 'disk' | 'network' | 'api' | 'database';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  stage: string;
  duration: number;
  impact: number; // Percentage of total time
  suggestions: string[];
  metrics: Record<string, number>;
}

export class PerformanceProfiler {
  private profiles: Map<string, PerformanceProfile> = new Map();
  private activeProfiles: Map<string, PerformanceProfile> = new Map();
  private metricsCollectors: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Start profiling a training session
   */
  startProfiling(trainingId: string): string {
    const profileId = `profile_${trainingId}_${Date.now()}`;
    
    const profile: PerformanceProfile = {
      id: profileId,
      trainingId,
      startTime: new Date().toISOString(),
      stages: [],
      systemMetrics: [],
      bottlenecks: [],
      recommendations: []
    };

    this.activeProfiles.set(profileId, profile);
    this.startMetricsCollection(profileId);

    return profileId;
  }

  /**
   * Stop profiling and generate final analysis
   */
  stopProfiling(profileId: string): PerformanceProfile | null {
    const profile = this.activeProfiles.get(profileId);
    if (!profile) return null;

    profile.endTime = new Date().toISOString();
    profile.duration = new Date(profile.endTime).getTime() - new Date(profile.startTime).getTime();

    // Stop metrics collection
    this.stopMetricsCollection(profileId);

    // Analyze performance and identify bottlenecks
    profile.bottlenecks = this.identifyBottlenecks(profile);
    profile.recommendations = this.generateRecommendations(profile);

    // Move to completed profiles
    this.profiles.set(profileId, profile);
    this.activeProfiles.delete(profileId);

    return profile;
  }

  /**
   * Start profiling a specific stage
   */
  startStage(profileId: string, stageName: string): void {
    const profile = this.activeProfiles.get(profileId);
    if (!profile) return;

    const stage: StageProfile = {
      stage: stageName,
      startTime: new Date().toISOString(),
      operations: [],
      metrics: {}
    };

    profile.stages.push(stage);
  }

  /**
   * End profiling a specific stage
   */
  endStage(profileId: string, stageName: string): void {
    const profile = this.activeProfiles.get(profileId);
    if (!profile) return;

    const stage = profile.stages.find(s => s.stage === stageName && !s.endTime);
    if (stage) {
      stage.endTime = new Date().toISOString();
      stage.duration = new Date(stage.endTime).getTime() - new Date(stage.startTime).getTime();
    }
  }

  /**
   * Profile a specific operation within a stage
   */
  async profileOperation<T>(
    profileId: string,
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = new Date().toISOString();
    const startTimestamp = Date.now();

    try {
      const result = await operation();
      const endTime = new Date().toISOString();
      const duration = Date.now() - startTimestamp;

      this.recordOperation(profileId, {
        operation: operationName,
        startTime,
        endTime,
        duration,
        success: true,
        metadata
      });

      return result;
    } catch (error) {
      const endTime = new Date().toISOString();
      const duration = Date.now() - startTimestamp;

      this.recordOperation(profileId, {
        operation: operationName,
        startTime,
        endTime,
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata
      });

      throw error;
    }
  }

  /**
   * Record system metrics at a point in time
   */
  recordSystemMetrics(profileId: string, metrics: Partial<SystemMetrics>): void {
    const profile = this.activeProfiles.get(profileId);
    if (!profile) return;

    const systemMetrics: SystemMetrics = {
      timestamp: new Date().toISOString(),
      cpu: metrics.cpu || { usage: 0, loadAverage: [] },
      memory: metrics.memory || { used: 0, total: 0, percentage: 0, heapUsed: 0, heapTotal: 0 },
      gpu: metrics.gpu,
      disk: metrics.disk,
      network: metrics.network
    };

    profile.systemMetrics.push(systemMetrics);
  }

  /**
   * Get performance profile
   */
  getProfile(profileId: string): PerformanceProfile | null {
    return this.profiles.get(profileId) || this.activeProfiles.get(profileId) || null;
  }

  /**
   * Get all profiles for a training session
   */
  getTrainingProfiles(trainingId: string): PerformanceProfile[] {
    const allProfiles = [...this.profiles.values(), ...this.activeProfiles.values()];
    return allProfiles.filter(profile => profile.trainingId === trainingId);
  }

  /**
   * Generate performance comparison between profiles
   */
  compareProfiles(profileIds: string[]): {
    profiles: PerformanceProfile[];
    comparison: {
      averageDuration: number;
      fastestProfile: string;
      slowestProfile: string;
      commonBottlenecks: string[];
      performanceVariation: number;
    };
  } {
    const profiles = profileIds
      .map(id => this.getProfile(id))
      .filter(profile => profile !== null) as PerformanceProfile[];

    if (profiles.length === 0) {
      throw new Error('No valid profiles found');
    }

    const durations = profiles
      .filter(p => p.duration !== undefined)
      .map(p => p.duration!);

    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const fastestProfile = profiles.reduce((fastest, current) => 
      (current.duration || 0) < (fastest.duration || Infinity) ? current : fastest
    ).id;
    const slowestProfile = profiles.reduce((slowest, current) => 
      (current.duration || 0) > (slowest.duration || 0) ? current : slowest
    ).id;

    // Find common bottlenecks
    const allBottlenecks = profiles.flatMap(p => p.bottlenecks.map(b => b.description));
    const bottleneckCounts = allBottlenecks.reduce((acc, bottleneck) => {
      acc[bottleneck] = (acc[bottleneck] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const commonBottlenecks = Object.entries(bottleneckCounts)
      .filter(([, count]) => count > 1)
      .map(([bottleneck]) => bottleneck);

    // Calculate performance variation (coefficient of variation)
    const mean = averageDuration;
    const variance = durations.reduce((acc, duration) => acc + Math.pow(duration - mean, 2), 0) / durations.length;
    const standardDeviation = Math.sqrt(variance);
    const performanceVariation = (standardDeviation / mean) * 100;

    return {
      profiles,
      comparison: {
        averageDuration,
        fastestProfile,
        slowestProfile,
        commonBottlenecks,
        performanceVariation
      }
    };
  }

  /**
   * Export performance data
   */
  exportProfile(profileId: string, format: 'json' | 'csv' | 'flamegraph' = 'json'): string {
    const profile = this.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    switch (format) {
      case 'json':
        return JSON.stringify(profile, null, 2);
      case 'csv':
        return this.convertProfileToCSV(profile);
      case 'flamegraph':
        return this.generateFlameGraph(profile);
      default:
        return JSON.stringify(profile, null, 2);
    }
  }

  private recordOperation(profileId: string, operation: OperationProfile): void {
    const profile = this.activeProfiles.get(profileId);
    if (!profile) return;

    // Add to the current stage or create a default stage
    let currentStage = profile.stages[profile.stages.length - 1];
    if (!currentStage) {
      currentStage = {
        stage: 'default',
        startTime: operation.startTime,
        operations: [],
        metrics: {}
      };
      profile.stages.push(currentStage);
    }

    currentStage.operations.push(operation);
  }

  private startMetricsCollection(profileId: string): void {
    const interval = setInterval(() => {
      this.collectSystemMetrics(profileId);
    }, 5000); // Collect every 5 seconds

    this.metricsCollectors.set(profileId, interval);
  }

  private stopMetricsCollection(profileId: string): void {
    const interval = this.metricsCollectors.get(profileId);
    if (interval) {
      clearInterval(interval);
      this.metricsCollectors.delete(profileId);
    }
  }

  private collectSystemMetrics(profileId: string): void {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      const metrics: Partial<SystemMetrics> = {
        cpu: {
          usage: 0, // Would need additional library for actual CPU usage
          loadAverage: []
        },
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal
        }
      };

      this.recordSystemMetrics(profileId, metrics);
    } catch (error) {
      console.warn('Failed to collect system metrics:', error);
    }
  }

  private identifyBottlenecks(profile: PerformanceProfile): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Analyze stage durations
    for (const stage of profile.stages) {
      if (stage.duration && stage.duration > 60000) { // More than 1 minute
        const impact = profile.duration ? (stage.duration / profile.duration) * 100 : 0;
        
        bottlenecks.push({
          type: 'api',
          severity: impact > 50 ? 'critical' : impact > 25 ? 'high' : 'medium',
          description: `Stage "${stage.stage}" took ${(stage.duration / 1000).toFixed(1)} seconds`,
          stage: stage.stage,
          duration: stage.duration,
          impact,
          suggestions: this.getStageSuggestions(stage),
          metrics: { duration: stage.duration, impact }
        });
      }
    }

    // Analyze memory usage
    const memoryMetrics = profile.systemMetrics.filter(m => m.memory);
    if (memoryMetrics.length > 0) {
      const maxMemoryUsage = Math.max(...memoryMetrics.map(m => m.memory.percentage));
      if (maxMemoryUsage > 90) {
        bottlenecks.push({
          type: 'memory',
          severity: maxMemoryUsage > 95 ? 'critical' : 'high',
          description: `High memory usage detected: ${maxMemoryUsage.toFixed(1)}%`,
          stage: 'system',
          duration: 0,
          impact: 0,
          suggestions: [
            'Reduce batch size',
            'Enable gradient checkpointing',
            'Use mixed precision training',
            'Increase system memory'
          ],
          metrics: { maxMemoryUsage }
        });
      }
    }

    // Analyze operation failures
    const allOperations = profile.stages.flatMap(s => s.operations);
    const failedOperations = allOperations.filter(op => !op.success);
    if (failedOperations.length > 0) {
      const failureRate = (failedOperations.length / allOperations.length) * 100;
      
      bottlenecks.push({
        type: 'api',
        severity: failureRate > 20 ? 'critical' : failureRate > 10 ? 'high' : 'medium',
        description: `High operation failure rate: ${failureRate.toFixed(1)}%`,
        stage: 'operations',
        duration: 0,
        impact: failureRate,
        suggestions: [
          'Implement retry logic',
          'Check API endpoints',
          'Verify network connectivity',
          'Review error patterns'
        ],
        metrics: { failureRate, failedCount: failedOperations.length }
      });
    }

    return bottlenecks.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  private getStageSuggestions(stage: StageProfile): string[] {
    const suggestions = [];

    if (stage.stage.includes('upload') || stage.stage.includes('download')) {
      suggestions.push('Check network bandwidth');
      suggestions.push('Use CDN for file transfers');
      suggestions.push('Implement parallel uploads');
    }

    if (stage.stage.includes('training')) {
      suggestions.push('Optimize training parameters');
      suggestions.push('Use faster GPU instances');
      suggestions.push('Implement gradient accumulation');
    }

    if (stage.stage.includes('validation') || stage.stage.includes('quality')) {
      suggestions.push('Cache validation results');
      suggestions.push('Optimize validation algorithms');
      suggestions.push('Use parallel processing');
    }

    return suggestions;
  }

  private generateRecommendations(profile: PerformanceProfile): string[] {
    const recommendations = new Set<string>();

    // General performance recommendations
    if (profile.duration && profile.duration > 1800000) { // More than 30 minutes
      recommendations.add('Training duration is longer than expected. Consider optimizing parameters.');
    }

    // Bottleneck-based recommendations
    for (const bottleneck of profile.bottlenecks) {
      bottleneck.suggestions.forEach(suggestion => recommendations.add(suggestion));
    }

    // Stage-based recommendations
    const stageDurations = profile.stages
      .filter(s => s.duration !== undefined)
      .map(s => ({ stage: s.stage, duration: s.duration! }))
      .sort((a, b) => b.duration - a.duration);

    if (stageDurations.length > 0) {
      const slowestStage = stageDurations[0];
      if (slowestStage.duration > 300000) { // More than 5 minutes
        recommendations.add(`Focus optimization efforts on "${slowestStage.stage}" stage`);
      }
    }

    return Array.from(recommendations);
  }

  private convertProfileToCSV(profile: PerformanceProfile): string {
    const rows = ['Stage,Operation,Duration,Success,Error'];
    
    for (const stage of profile.stages) {
      for (const operation of stage.operations) {
        rows.push([
          stage.stage,
          operation.operation,
          operation.duration.toString(),
          operation.success.toString(),
          operation.error || ''
        ].join(','));
      }
    }

    return rows.join('\n');
  }

  private generateFlameGraph(profile: PerformanceProfile): string {
    // Simplified flame graph data format
    const flameData = {
      name: `Training ${profile.trainingId}`,
      value: profile.duration || 0,
      children: profile.stages.map(stage => ({
        name: stage.stage,
        value: stage.duration || 0,
        children: stage.operations.map(op => ({
          name: op.operation,
          value: op.duration,
          success: op.success
        }))
      }))
    };

    return JSON.stringify(flameData, null, 2);
  }
}

// Singleton instance
export const performanceProfiler = new PerformanceProfiler();

// Utility functions
export function createPerformanceReport(profileId: string): string {
  const profile = performanceProfiler.getProfile(profileId);
  if (!profile) {
    return 'Profile not found';
  }

  const report = `
# Performance Analysis Report

**Training ID:** ${profile.trainingId}
**Profile ID:** ${profile.id}
**Duration:** ${profile.duration ? (profile.duration / 1000).toFixed(1) : 'N/A'} seconds
**Generated:** ${new Date().toISOString()}

## Stage Performance
${profile.stages.map(stage => `
### ${stage.stage}
- Duration: ${stage.duration ? (stage.duration / 1000).toFixed(1) : 'N/A'} seconds
- Operations: ${stage.operations.length}
- Success Rate: ${stage.operations.length > 0 ? ((stage.operations.filter(op => op.success).length / stage.operations.length) * 100).toFixed(1) : 'N/A'}%
`).join('')}

## Bottlenecks
${profile.bottlenecks.map(bottleneck => `
### ${bottleneck.type.toUpperCase()} - ${bottleneck.severity.toUpperCase()}
- **Description:** ${bottleneck.description}
- **Stage:** ${bottleneck.stage}
- **Impact:** ${bottleneck.impact.toFixed(1)}%
- **Suggestions:**
${bottleneck.suggestions.map(s => `  - ${s}`).join('\n')}
`).join('')}

## Recommendations
${profile.recommendations.map(rec => `- ${rec}`).join('\n')}

## System Metrics Summary
- Memory Usage: ${profile.systemMetrics.length > 0 ? 
  `Peak ${Math.max(...profile.systemMetrics.map(m => m.memory.percentage)).toFixed(1)}%` : 'N/A'}
- Metrics Collected: ${profile.systemMetrics.length} data points
`;

  return report.trim();
}