/**
 * Metrics store for tracking API performance and health
 * Separated from the route handler to avoid Next.js export restrictions
 */

/**
 * Simple in-memory metrics store (in production, use Redis or database)
 */
export class MetricsStore {
  private metrics: Map<string, {
    count: number;
    successCount: number;
    totalResponseTime: number;
    lastUpdated: number;
    errors: Array<{ timestamp: number; error: string; }>;
  }> = new Map();

  recordMetric(operation: string, success: boolean, responseTime: number, error?: string) {
    const existing = this.metrics.get(operation) || {
      count: 0,
      successCount: 0,
      totalResponseTime: 0,
      lastUpdated: 0,
      errors: []
    };

    existing.count++;
    existing.totalResponseTime += responseTime;
    existing.lastUpdated = Date.now();

    if (success) {
      existing.successCount++;
    } else if (error) {
      existing.errors.push({
        timestamp: Date.now(),
        error: error.substring(0, 200) // Limit error message length
      });
      
      // Keep only last 10 errors
      if (existing.errors.length > 10) {
        existing.errors = existing.errors.slice(-10);
      }
    }

    this.metrics.set(operation, existing);
  }

  getMetrics(operation?: string) {
    if (operation) {
      const metric = this.metrics.get(operation);
      if (!metric) return null;

      return {
        operation,
        totalRequests: metric.count,
        successfulRequests: metric.successCount,
        successRate: metric.count > 0 ? (metric.successCount / metric.count) * 100 : 0,
        averageResponseTime: metric.count > 0 ? metric.totalResponseTime / metric.count : 0,
        lastUpdated: metric.lastUpdated,
        recentErrors: metric.errors.slice(-5) // Last 5 errors
      };
    }

    const allMetrics: Record<string, any> = {};
    for (const [op, metric] of this.metrics) {
      allMetrics[op] = {
        totalRequests: metric.count,
        successfulRequests: metric.successCount,
        successRate: metric.count > 0 ? (metric.successCount / metric.count) * 100 : 0,
        averageResponseTime: metric.count > 0 ? metric.totalResponseTime / metric.count : 0,
        lastUpdated: metric.lastUpdated,
        errorCount: metric.errors.length
      };
    }

    return allMetrics;
  }

  getSystemSummary() {
    const allMetrics = this.getMetrics() || {};
    const operations = Object.keys(allMetrics);
    
    if (operations.length === 0) {
      return {
        totalOperations: 0,
        totalRequests: 0,
        overallSuccessRate: 0,
        averageResponseTime: 0,
        healthyOperations: 0
      };
    }

    const totalRequests = operations.reduce((sum, op) => sum + allMetrics[op].totalRequests, 0);
    const totalSuccessful = operations.reduce((sum, op) => sum + allMetrics[op].successfulRequests, 0);
    const totalResponseTime = operations.reduce((sum, op) => 
      sum + (allMetrics[op].averageResponseTime * allMetrics[op].totalRequests), 0);
    
    const healthyOperations = operations.filter(op => allMetrics[op].successRate >= 95).length;

    return {
      totalOperations: operations.length,
      totalRequests,
      overallSuccessRate: totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      healthyOperations,
      unhealthyOperations: operations.length - healthyOperations
    };
  }
}

// Global metrics store instance
export const globalMetricsStore = new MetricsStore();