/**
 * Log Aggregation and Search Service
 * Provides centralized logging, aggregation, and search capabilities
 */

import { TrainingLogEntry, TrainingSession } from './training-logger';

export interface LogQuery {
  trainingId?: string;
  userId?: string;
  level?: TrainingLogEntry['level'] | TrainingLogEntry['level'][];
  stage?: string | string[];
  timeRange?: {
    start: string;
    end: string;
  };
  textSearch?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'level' | 'stage';
  sortOrder?: 'asc' | 'desc';
}

export interface LogSearchResult {
  logs: TrainingLogEntry[];
  totalCount: number;
  hasMore: boolean;
  aggregations?: LogAggregations;
}

export interface LogAggregations {
  byLevel: Record<string, number>;
  byStage: Record<string, number>;
  byTrainingId: Record<string, number>;
  byTimeRange: Array<{
    timestamp: string;
    count: number;
  }>;
}

export interface LogMetrics {
  totalLogs: number;
  errorRate: number;
  warningRate: number;
  averageLogsPerTraining: number;
  topErrors: Array<{
    message: string;
    count: number;
  }>;
  topStages: Array<{
    stage: string;
    count: number;
  }>;
  timeDistribution: Array<{
    hour: number;
    count: number;
  }>;
}

export class LogAggregationService {
  private logStore: Map<string, TrainingSession> = new Map();
  private indexedLogs: Map<string, TrainingLogEntry[]> = new Map();
  private lastIndexUpdate: number = 0;

  constructor() {
    // Initialize with global logs if available
    if (typeof global !== 'undefined' && global.trainingLogs) {
      this.logStore = global.trainingLogs;
    }
    
    // Update indexes periodically
    setInterval(() => this.updateIndexes(), 60000); // Every minute
  }

  /**
   * Add logs to the aggregation service
   */
  addLogs(trainingId: string, session: TrainingSession) {
    this.logStore.set(trainingId, session);
    this.updateIndexes();
  }

  /**
   * Search logs with advanced filtering and aggregation
   */
  searchLogs(query: LogQuery): LogSearchResult {
    this.updateIndexes();

    let allLogs = this.getAllLogs();
    
    // Apply filters
    const filteredLogs = this.applyFilters(allLogs, query);
    
    // Apply sorting
    const sortedLogs = this.applySorting(filteredLogs, query);
    
    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const paginatedLogs = sortedLogs.slice(offset, offset + limit);
    
    // Generate aggregations
    const aggregations = this.generateAggregations(filteredLogs);
    
    return {
      logs: paginatedLogs,
      totalCount: filteredLogs.length,
      hasMore: offset + limit < filteredLogs.length,
      aggregations
    };
  }

  /**
   * Get log metrics and statistics
   */
  getLogMetrics(timeRange?: { start: string; end: string }): LogMetrics {
    this.updateIndexes();

    let allLogs = this.getAllLogs();
    
    if (timeRange) {
      const startTime = new Date(timeRange.start).getTime();
      const endTime = new Date(timeRange.end).getTime();
      allLogs = allLogs.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime >= startTime && logTime <= endTime;
      });
    }

    const totalLogs = allLogs.length;
    const errorLogs = allLogs.filter(log => log.level === 'error');
    const warningLogs = allLogs.filter(log => log.level === 'warn');
    
    const errorRate = totalLogs > 0 ? (errorLogs.length / totalLogs) * 100 : 0;
    const warningRate = totalLogs > 0 ? (warningLogs.length / totalLogs) * 100 : 0;
    
    const trainingIds = new Set(allLogs.map(log => log.trainingId));
    const averageLogsPerTraining = trainingIds.size > 0 ? totalLogs / trainingIds.size : 0;
    
    // Top errors
    const errorMessages = errorLogs.map(log => log.message);
    const errorCounts = this.countOccurrences(errorMessages);
    const topErrors = Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));
    
    // Top stages
    const stages = allLogs.map(log => log.stage);
    const stageCounts = this.countOccurrences(stages);
    const topStages = Object.entries(stageCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([stage, count]) => ({ stage, count }));
    
    // Time distribution
    const timeDistribution = this.calculateTimeDistribution(allLogs);
    
    return {
      totalLogs,
      errorRate,
      warningRate,
      averageLogsPerTraining,
      topErrors,
      topStages,
      timeDistribution
    };
  }

  /**
   * Get logs for a specific training session
   */
  getTrainingLogs(trainingId: string): TrainingLogEntry[] {
    const session = this.logStore.get(trainingId);
    return session?.logs || [];
  }

  /**
   * Get all training sessions
   */
  getAllSessions(): TrainingSession[] {
    return Array.from(this.logStore.values());
  }

  /**
   * Export logs in various formats
   */
  exportLogs(query: LogQuery, format: 'json' | 'csv' | 'txt' = 'json'): string {
    const result = this.searchLogs(query);
    
    switch (format) {
      case 'json':
        return JSON.stringify(result, null, 2);
      case 'csv':
        return this.convertToCSV(result.logs);
      case 'txt':
        return this.convertToText(result.logs);
      default:
        return JSON.stringify(result, null, 2);
    }
  }

  /**
   * Clean up old logs
   */
  cleanupOldLogs(maxAge: number = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    const cutoff = Date.now() - maxAge;
    let removedCount = 0;

    for (const [trainingId, session] of this.logStore.entries()) {
      const sessionTime = new Date(session.startTime).getTime();
      if (sessionTime < cutoff) {
        this.logStore.delete(trainingId);
        removedCount++;
      }
    }

    this.updateIndexes();
    return { removedCount, remainingCount: this.logStore.size };
  }

  /**
   * Get real-time log stream for a training session
   */
  getLogStream(trainingId: string): AsyncGenerator<TrainingLogEntry, void, unknown> {
    return this.createLogStream(trainingId);
  }

  private async* createLogStream(trainingId: string): AsyncGenerator<TrainingLogEntry, void, unknown> {
    let lastLogIndex = 0;
    
    while (true) {
      const session = this.logStore.get(trainingId);
      if (!session) {
        break;
      }

      const logs = session.logs;
      if (logs.length > lastLogIndex) {
        for (let i = lastLogIndex; i < logs.length; i++) {
          yield logs[i];
        }
        lastLogIndex = logs.length;
      }

      // Check if training is complete
      if (['completed', 'failed', 'cancelled'].includes(session.status)) {
        break;
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private updateIndexes() {
    const now = Date.now();
    if (now - this.lastIndexUpdate < 30000) { // Update at most every 30 seconds
      return;
    }

    // Update indexed logs for faster searching
    this.indexedLogs.clear();
    
    for (const [trainingId, session] of this.logStore.entries()) {
      const logs = session.logs || [];
      
      // Index by level
      for (const level of ['debug', 'info', 'warn', 'error']) {
        const key = `level:${level}`;
        if (!this.indexedLogs.has(key)) {
          this.indexedLogs.set(key, []);
        }
        this.indexedLogs.get(key)!.push(...logs.filter(log => log.level === level));
      }
      
      // Index by stage
      const stages = new Set(logs.map(log => log.stage));
      for (const stage of stages) {
        const key = `stage:${stage}`;
        if (!this.indexedLogs.has(key)) {
          this.indexedLogs.set(key, []);
        }
        this.indexedLogs.get(key)!.push(...logs.filter(log => log.stage === stage));
      }
    }

    this.lastIndexUpdate = now;
  }

  private getAllLogs(): TrainingLogEntry[] {
    const allLogs: TrainingLogEntry[] = [];
    for (const session of this.logStore.values()) {
      allLogs.push(...(session.logs || []));
    }
    return allLogs;
  }

  private applyFilters(logs: TrainingLogEntry[], query: LogQuery): TrainingLogEntry[] {
    let filtered = logs;

    if (query.trainingId) {
      filtered = filtered.filter(log => log.trainingId === query.trainingId);
    }

    if (query.userId) {
      filtered = filtered.filter(log => log.userId === query.userId);
    }

    if (query.level) {
      const levels = Array.isArray(query.level) ? query.level : [query.level];
      filtered = filtered.filter(log => levels.includes(log.level));
    }

    if (query.stage) {
      const stages = Array.isArray(query.stage) ? query.stage : [query.stage];
      filtered = filtered.filter(log => stages.includes(log.stage));
    }

    if (query.timeRange) {
      const startTime = new Date(query.timeRange.start).getTime();
      const endTime = new Date(query.timeRange.end).getTime();
      filtered = filtered.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime >= startTime && logTime <= endTime;
      });
    }

    if (query.textSearch) {
      const searchText = query.textSearch.toLowerCase();
      filtered = filtered.filter(log => {
        const logText = JSON.stringify(log).toLowerCase();
        return logText.includes(searchText);
      });
    }

    return filtered;
  }

  private applySorting(logs: TrainingLogEntry[], query: LogQuery): TrainingLogEntry[] {
    const sortBy = query.sortBy || 'timestamp';
    const sortOrder = query.sortOrder || 'desc';

    return logs.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'timestamp':
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case 'level':
          const levelOrder = { debug: 0, info: 1, warn: 2, error: 3 };
          comparison = levelOrder[a.level] - levelOrder[b.level];
          break;
        case 'stage':
          comparison = a.stage.localeCompare(b.stage);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  private generateAggregations(logs: TrainingLogEntry[]): LogAggregations {
    const byLevel = this.countOccurrences(logs.map(log => log.level));
    const byStage = this.countOccurrences(logs.map(log => log.stage));
    const byTrainingId = this.countOccurrences(logs.map(log => log.trainingId));
    
    // Time range aggregation (by hour)
    const byTimeRange = this.aggregateByTimeRange(logs);

    return {
      byLevel,
      byStage,
      byTrainingId,
      byTimeRange
    };
  }

  private countOccurrences(items: string[]): Record<string, number> {
    return items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private aggregateByTimeRange(logs: TrainingLogEntry[]): Array<{ timestamp: string; count: number }> {
    const hourlyBuckets: Record<string, number> = {};

    for (const log of logs) {
      const hour = new Date(log.timestamp);
      hour.setMinutes(0, 0, 0); // Round to hour
      const hourKey = hour.toISOString();
      hourlyBuckets[hourKey] = (hourlyBuckets[hourKey] || 0) + 1;
    }

    return Object.entries(hourlyBuckets)
      .map(([timestamp, count]) => ({ timestamp, count }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private calculateTimeDistribution(logs: TrainingLogEntry[]): Array<{ hour: number; count: number }> {
    const hourCounts = new Array(24).fill(0);

    for (const log of logs) {
      const hour = new Date(log.timestamp).getHours();
      hourCounts[hour]++;
    }

    return hourCounts.map((count, hour) => ({ hour, count }));
  }

  private convertToCSV(logs: TrainingLogEntry[]): string {
    if (logs.length === 0) return '';

    const headers = ['timestamp', 'trainingId', 'level', 'stage', 'message', 'userId'];
    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.timestamp,
        log.trainingId,
        log.level,
        log.stage,
        `"${log.message.replace(/"/g, '""')}"`, // Escape quotes
        log.userId || ''
      ];
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  private convertToText(logs: TrainingLogEntry[]): string {
    return logs.map(log => {
      const timestamp = new Date(log.timestamp).toISOString();
      const level = log.level.toUpperCase().padEnd(5);
      const stage = log.stage.padEnd(20);
      return `[${timestamp}] ${level} ${stage} ${log.message}`;
    }).join('\n');
  }
}

// Singleton instance
export const logAggregationService = new LogAggregationService();

// Utility functions for log analysis
export function analyzeLogPatterns(logs: TrainingLogEntry[]): {
  patterns: Array<{
    type: string;
    description: string;
    frequency: number;
    examples: TrainingLogEntry[];
  }>;
  anomalies: Array<{
    type: string;
    description: string;
    log: TrainingLogEntry;
  }>;
} {
  const patterns = [];
  const anomalies = [];

  // Detect error patterns
  const errorLogs = logs.filter(log => log.level === 'error');
  if (errorLogs.length > 0) {
    const errorMessages = errorLogs.map(log => log.message);
    const messageCounts = errorMessages.reduce((acc, msg) => {
      acc[msg] = (acc[msg] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [message, count] of Object.entries(messageCounts)) {
      if (count > 1) {
        patterns.push({
          type: 'recurring_error',
          description: `Error "${message}" occurred ${count} times`,
          frequency: count,
          examples: errorLogs.filter(log => log.message === message).slice(0, 3)
        });
      }
    }
  }

  // Detect stage transition anomalies
  const stageTransitions = logs.filter(log => log.stage === 'stage_transition');
  for (let i = 1; i < stageTransitions.length; i++) {
    const prev = stageTransitions[i - 1];
    const curr = stageTransitions[i];
    const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
    
    if (timeDiff < 1000) { // Less than 1 second between transitions
      anomalies.push({
        type: 'rapid_stage_transition',
        description: 'Unusually rapid stage transition detected',
        log: curr
      });
    }
  }

  // Detect memory usage spikes
  const memoryLogs = logs.filter(log => log.metadata?.memoryUsage);
  for (const log of memoryLogs) {
    const memoryUsage = log.metadata?.memoryUsage?.current;
    if (memoryUsage && memoryUsage > 0.95) { // Over 95% memory usage
      anomalies.push({
        type: 'high_memory_usage',
        description: `Memory usage spike: ${(memoryUsage * 100).toFixed(1)}%`,
        log
      });
    }
  }

  return { patterns, anomalies };
}

export function generateLogReport(logs: TrainingLogEntry[]): string {
  const metrics = logAggregationService.getLogMetrics();
  const patterns = analyzeLogPatterns(logs);

  const report = `
# Training Log Analysis Report

Generated: ${new Date().toISOString()}
Total Logs Analyzed: ${logs.length}

## Summary Statistics
- Error Rate: ${metrics.errorRate.toFixed(2)}%
- Warning Rate: ${metrics.warningRate.toFixed(2)}%
- Average Logs per Training: ${metrics.averageLogsPerTraining.toFixed(1)}

## Top Errors
${metrics.topErrors.map(error => `- ${error.message} (${error.count} occurrences)`).join('\n')}

## Top Stages
${metrics.topStages.map(stage => `- ${stage.stage} (${stage.count} logs)`).join('\n')}

## Detected Patterns
${patterns.patterns.map(pattern => `- ${pattern.description} (frequency: ${pattern.frequency})`).join('\n')}

## Anomalies
${patterns.anomalies.map(anomaly => `- ${anomaly.description}`).join('\n')}

## Recommendations
${generateRecommendations(metrics, patterns).join('\n')}
`;

  return report.trim();
}

function generateRecommendations(metrics: LogMetrics, patterns: any): string[] {
  const recommendations = [];

  if (metrics.errorRate > 10) {
    recommendations.push('- High error rate detected. Review error patterns and implement fixes.');
  }

  if (metrics.warningRate > 20) {
    recommendations.push('- High warning rate. Consider addressing warning conditions.');
  }

  if (patterns.patterns.some((p: any) => p.type === 'recurring_error')) {
    recommendations.push('- Recurring errors detected. Implement retry logic or fix root causes.');
  }

  if (patterns.anomalies.some((a: any) => a.type === 'high_memory_usage')) {
    recommendations.push('- Memory usage spikes detected. Consider optimizing memory usage or increasing resources.');
  }

  if (recommendations.length === 0) {
    recommendations.push('- System appears to be operating normally.');
  }

  return recommendations;
}