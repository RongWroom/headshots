import { NextResponse } from 'next/server';
import { apiHealthMonitor } from '@/lib/retry-utils';
import { globalMetricsStore } from '@/lib/metrics-store';

export const dynamic = "force-dynamic";

/**
 * Get system metrics
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const operation = url.searchParams.get('operation');
    const format = url.searchParams.get('format') || 'json';

    if (operation) {
      const metrics = globalMetricsStore.getMetrics(operation);
      if (!metrics) {
        return NextResponse.json({
          error: 'Operation not found',
          operation,
          availableOperations: Object.keys(globalMetricsStore.getMetrics() || {})
        }, { status: 404 });
      }
      return NextResponse.json(metrics);
    }

    // Get all metrics
    const allMetrics = globalMetricsStore.getMetrics();
    const systemSummary = globalMetricsStore.getSystemSummary();
    const healthStatuses = apiHealthMonitor.getAllHealthStatus();

    const response = {
      timestamp: new Date().toISOString(),
      summary: systemSummary,
      operations: allMetrics,
      services: healthStatuses,
      alerts: generateAlerts(allMetrics, healthStatuses)
    };

    if (format === 'prometheus') {
      // Return Prometheus-style metrics
      const prometheusMetrics = convertToPrometheusFormat(allMetrics, systemSummary);
      return new Response(prometheusMetrics, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4'
        }
      });
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to retrieve metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Record a metric (for internal use by other APIs)
 */
export async function POST(request: Request) {
  try {
    const { operation, success, responseTime, error } = await request.json();

    if (!operation || typeof success !== 'boolean' || typeof responseTime !== 'number') {
      return NextResponse.json({
        error: 'Invalid metric data',
        required: ['operation', 'success', 'responseTime'],
        optional: ['error']
      }, { status: 400 });
    }

    globalMetricsStore.recordMetric(operation, success, responseTime, error);

    return NextResponse.json({
      message: 'Metric recorded',
      operation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to record metric',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 });
  }
}

/**
 * Generate alerts based on metrics and health status
 */
function generateAlerts(metrics: Record<string, any>, healthStatuses: Record<string, any>): Array<{
  level: 'warning' | 'critical';
  message: string;
  operation?: string;
  service?: string;
}> {
  const alerts: Array<{
    level: 'warning' | 'critical';
    message: string;
    operation?: string;
    service?: string;
  }> = [];

  // Check operation success rates
  for (const [operation, metric] of Object.entries(metrics)) {
    if (metric.totalRequests >= 10) { // Only alert if we have enough data
      if (metric.successRate < 50) {
        alerts.push({
          level: 'critical',
          message: `Operation ${operation} has very low success rate: ${metric.successRate.toFixed(1)}%`,
          operation
        });
      } else if (metric.successRate < 90) {
        alerts.push({
          level: 'warning',
          message: `Operation ${operation} has low success rate: ${metric.successRate.toFixed(1)}%`,
          operation
        });
      }
    }

    // Check response times
    if (metric.averageResponseTime > 10000) { // 10 seconds
      alerts.push({
        level: 'warning',
        message: `Operation ${operation} has high response time: ${(metric.averageResponseTime / 1000).toFixed(1)}s`,
        operation
      });
    }
  }

  // Check service health
  for (const [service, health] of Object.entries(healthStatuses)) {
    if (!health.isHealthy) {
      alerts.push({
        level: 'critical',
        message: `Service ${service} is unhealthy (${health.consecutiveFailures} consecutive failures)`,
        service
      });
    } else if (health.successRate < 0.9) {
      alerts.push({
        level: 'warning',
        message: `Service ${service} has low success rate: ${(health.successRate * 100).toFixed(1)}%`,
        service
      });
    }
  }

  return alerts;
}

/**
 * Convert metrics to Prometheus format
 */
function convertToPrometheusFormat(metrics: Record<string, any>, summary: any): string {
  let output = '';
  
  // System summary metrics
  output += `# HELP system_total_requests Total number of requests across all operations\n`;
  output += `# TYPE system_total_requests counter\n`;
  output += `system_total_requests ${summary.totalRequests}\n\n`;
  
  output += `# HELP system_success_rate Overall system success rate\n`;
  output += `# TYPE system_success_rate gauge\n`;
  output += `system_success_rate ${summary.overallSuccessRate / 100}\n\n`;
  
  output += `# HELP system_avg_response_time Average response time across all operations\n`;
  output += `# TYPE system_avg_response_time gauge\n`;
  output += `system_avg_response_time ${summary.averageResponseTime}\n\n`;

  // Per-operation metrics
  for (const [operation, metric] of Object.entries(metrics)) {
    const sanitizedOp = operation.replace(/[^a-zA-Z0-9_]/g, '_');
    
    output += `# HELP operation_requests_total Total requests for operation\n`;
    output += `# TYPE operation_requests_total counter\n`;
    output += `operation_requests_total{operation="${operation}"} ${metric.totalRequests}\n\n`;
    
    output += `# HELP operation_success_rate Success rate for operation\n`;
    output += `# TYPE operation_success_rate gauge\n`;
    output += `operation_success_rate{operation="${operation}"} ${metric.successRate / 100}\n\n`;
    
    output += `# HELP operation_avg_response_time Average response time for operation\n`;
    output += `# TYPE operation_avg_response_time gauge\n`;
    output += `operation_avg_response_time{operation="${operation}"} ${metric.averageResponseTime}\n\n`;
  }

  return output;
}

// Note: metricsStore is available internally within this route file only
// For external access, use the API endpoints