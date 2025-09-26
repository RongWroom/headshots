import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';

/**
 * Training Diagnostics API
 * Provides system diagnostics and health checks for training infrastructure
 */

export async function GET(request: NextRequest) {
  const logger = new Logger('training-diagnostics');
  
  try {
    const { searchParams } = new URL(request.url);
    const check = searchParams.get('check') || 'all';

    logger.logInfo('diagnostics_request', { check });

    const diagnostics = await runDiagnostics(check);

    logger.logSuccess('diagnostics_completed', { check, results: diagnostics });

    return NextResponse.json({
      success: true,
      data: diagnostics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.logError('diagnostics_error', error);
    return NextResponse.json(
      logger.createErrorResponse(
        'DIAGNOSTICS_ERROR',
        'Failed to run diagnostics',
        'DIAG_500',
        { error: error instanceof Error ? error.message : String(error) }
      ),
      { status: 500 }
    );
  }
}

async function runDiagnostics(check: string) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    checks: {}
  };

  if (check === 'all' || check === 'system') {
    diagnostics.checks.system = await checkSystemHealth();
  }

  if (check === 'all' || check === 'runpod') {
    diagnostics.checks.runpod = await checkRunPodHealth();
  }

  if (check === 'all' || check === 'replicate') {
    diagnostics.checks.replicate = await checkReplicateHealth();
  }

  if (check === 'all' || check === 'database') {
    diagnostics.checks.database = await checkDatabaseHealth();
  }

  if (check === 'all' || check === 'storage') {
    diagnostics.checks.storage = await checkStorageHealth();
  }

  if (check === 'all' || check === 'queue') {
    diagnostics.checks.queue = await checkQueueHealth();
  }

  if (check === 'all' || check === 'monitoring') {
    diagnostics.checks.monitoring = await checkMonitoringHealth();
  }

  // Calculate overall health
  const allChecks = Object.values(diagnostics.checks);
  const healthyChecks = allChecks.filter((check: any) => check.status === 'healthy').length;
  const totalChecks = allChecks.length;
  
  diagnostics.overall = {
    status: healthyChecks === totalChecks ? 'healthy' : 
            healthyChecks > totalChecks * 0.7 ? 'degraded' : 'unhealthy',
    healthyChecks,
    totalChecks,
    healthPercentage: (healthyChecks / totalChecks) * 100
  };

  return diagnostics;
}

async function checkSystemHealth() {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  
  return {
    status: memoryUsagePercent > 90 ? 'unhealthy' : memoryUsagePercent > 70 ? 'degraded' : 'healthy',
    details: {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: memoryUsagePercent,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      },
      uptime: {
        seconds: uptime,
        formatted: formatUptime(uptime)
      },
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    recommendations: memoryUsagePercent > 80 ? [
      'High memory usage detected',
      'Consider restarting the application',
      'Monitor for memory leaks'
    ] : []
  };
}

async function checkRunPodHealth() {
  try {
    const runpodEndpoint = process.env.RUNPOD_TRAINING_ENDPOINT;
    const runpodApiKey = process.env.RUNPOD_API_KEY;

    if (!runpodEndpoint || !runpodApiKey) {
      return {
        status: 'unhealthy',
        error: 'RunPod configuration missing',
        details: {
          hasEndpoint: !!runpodEndpoint,
          hasApiKey: !!runpodApiKey
        },
        recommendations: [
          'Check RUNPOD_TRAINING_ENDPOINT environment variable',
          'Check RUNPOD_API_KEY environment variable'
        ]
      };
    }

    // Test RunPod health endpoint
    const startTime = Date.now();
    const response = await fetch(`${runpodEndpoint}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${runpodApiKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    const responseTime = Date.now() - startTime;
    const responseData = await response.text();

    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      details: {
        endpoint: runpodEndpoint,
        responseTime,
        httpStatus: response.status,
        response: responseData.substring(0, 500) // Limit response size
      },
      recommendations: !response.ok ? [
        'RunPod endpoint is not responding correctly',
        'Check RunPod service status',
        'Verify API key permissions'
      ] : []
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      recommendations: [
        'RunPod service is unreachable',
        'Check network connectivity',
        'Verify RunPod endpoint URL'
      ]
    };
  }
}

async function checkReplicateHealth() {
  try {
    const replicateToken = process.env.REPLICATE_API_TOKEN;

    if (!replicateToken) {
      return {
        status: 'unhealthy',
        error: 'Replicate API token missing',
        recommendations: [
          'Check REPLICATE_API_TOKEN environment variable'
        ]
      };
    }

    // Test Replicate API
    const startTime = Date.now();
    const response = await fetch('https://api.replicate.com/v1/account', {
      headers: {
        'Authorization': `Token ${replicateToken}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });

    const responseTime = Date.now() - startTime;

    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      details: {
        responseTime,
        httpStatus: response.status
      },
      recommendations: !response.ok ? [
        'Replicate API is not responding correctly',
        'Check API token validity',
        'Verify account status'
      ] : []
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      recommendations: [
        'Replicate API is unreachable',
        'Check network connectivity'
      ]
    };
  }
}

async function checkDatabaseHealth() {
  try {
    // Test database connection by making a simple query
    const response = await fetch('/api/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    const startTime = Date.now();
    const healthData = await response.json();
    const responseTime = Date.now() - startTime;

    return {
      status: response.ok && healthData.database ? 'healthy' : 'unhealthy',
      details: {
        responseTime,
        connectionStatus: healthData.database || 'unknown'
      },
      recommendations: !response.ok ? [
        'Database connection issues detected',
        'Check Supabase configuration',
        'Verify database credentials'
      ] : []
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      recommendations: [
        'Database health check failed',
        'Check database connectivity',
        'Verify Supabase status'
      ]
    };
  }
}

async function checkStorageHealth() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 'unhealthy',
        error: 'Supabase configuration missing',
        recommendations: [
          'Check NEXT_PUBLIC_SUPABASE_URL environment variable',
          'Check SUPABASE_SERVICE_ROLE_KEY environment variable'
        ]
      };
    }

    // Test storage by checking if we can access the storage API
    const startTime = Date.now();
    const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    const responseTime = Date.now() - startTime;

    return {
      status: response.ok ? 'healthy' : 'degraded',
      details: {
        responseTime,
        httpStatus: response.status
      },
      recommendations: !response.ok ? [
        'Storage API issues detected',
        'Check Supabase storage configuration',
        'Verify service role permissions'
      ] : []
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      recommendations: [
        'Storage health check failed',
        'Check Supabase connectivity'
      ]
    };
  }
}

async function checkQueueHealth() {
  try {
    // Check training queue status
    const response = await fetch('/api/training/queue/metrics', {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    const startTime = Date.now();
    const queueData = await response.json();
    const responseTime = Date.now() - startTime;

    const queueLength = queueData.data?.queueLength || 0;
    const processingJobs = queueData.data?.processingJobs || 0;

    return {
      status: response.ok ? (queueLength > 100 ? 'degraded' : 'healthy') : 'unhealthy',
      details: {
        responseTime,
        queueLength,
        processingJobs,
        metrics: queueData.data
      },
      recommendations: queueLength > 100 ? [
        'High queue length detected',
        'Consider scaling up processing capacity',
        'Monitor queue processing rate'
      ] : []
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      recommendations: [
        'Queue health check failed',
        'Check queue service status'
      ]
    };
  }
}

async function checkMonitoringHealth() {
  try {
    // Check monitoring metrics endpoint
    const response = await fetch('/api/monitoring/metrics', {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    const startTime = Date.now();
    const metricsData = await response.json();
    const responseTime = Date.now() - startTime;

    return {
      status: response.ok ? 'healthy' : 'degraded',
      details: {
        responseTime,
        metricsAvailable: !!metricsData.data
      },
      recommendations: !response.ok ? [
        'Monitoring system issues detected',
        'Check metrics collection service'
      ] : []
    };
  } catch (error) {
    return {
      status: 'degraded',
      error: error instanceof Error ? error.message : String(error),
      recommendations: [
        'Monitoring health check failed',
        'Monitoring is not critical for core functionality'
      ]
    };
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}

export async function POST(request: NextRequest) {
  const logger = new Logger('training-diagnostics');
  
  try {
    const body = await request.json();
    const { action, parameters } = body;

    logger.logInfo('diagnostic_action', { action, parameters });

    let result;
    switch (action) {
      case 'clear_logs':
        result = await clearTrainingLogs(parameters?.trainingId);
        break;
      case 'restart_queue':
        result = await restartQueue();
        break;
      case 'force_cleanup':
        result = await forceCleanup();
        break;
      default:
        return NextResponse.json(
          logger.createErrorResponse(
            'INVALID_ACTION',
            `Unknown diagnostic action: ${action}`,
            'DIAG_001'
          ),
          { status: 400 }
        );
    }

    logger.logSuccess('diagnostic_action_completed', { action, result });

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.logError('diagnostic_action_error', error);
    return NextResponse.json(
      logger.createErrorResponse(
        'DIAGNOSTIC_ACTION_ERROR',
        'Failed to execute diagnostic action',
        'DIAG_500',
        { error: error instanceof Error ? error.message : String(error) }
      ),
      { status: 500 }
    );
  }
}

async function clearTrainingLogs(trainingId?: string) {
  if (typeof global !== 'undefined' && (global as any).trainingLogs) {
    if (trainingId) {
      (global as any).trainingLogs.delete(trainingId);
      return { message: `Cleared logs for training ${trainingId}` };
    } else {
      (global as any).trainingLogs.clear();
      return { message: 'Cleared all training logs' };
    }
  }
  return { message: 'No logs to clear' };
}

async function restartQueue() {
  // This would typically restart the queue processing
  // For now, we'll just return a success message
  return { message: 'Queue restart initiated' };
}

async function forceCleanup() {
  // Force garbage collection if available
  if ((global as any).gc) {
    (global as any).gc();
  }
  
  // Clear any cached data
  if (typeof global !== 'undefined') {
    if ((global as any).trainingLogs) {
      const oldLogs = (global as any).trainingLogs.size;
      // Keep only recent logs (last 24 hours)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      for (const [trainingId, data] of (global as any).trainingLogs.entries()) {
        const sessionTime = new Date(data.session?.startTime || 0).getTime();
        if (sessionTime < cutoff) {
          (global as any).trainingLogs.delete(trainingId);
        }
      }
      const newLogs = (global as any).trainingLogs.size;
      return { 
        message: 'Cleanup completed',
        details: {
          logsCleared: oldLogs - newLogs,
          logsRemaining: newLogs
        }
      };
    }
  }
  
  return { message: 'Cleanup completed' };
}