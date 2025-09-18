import { NextResponse } from 'next/server';
import { apiHealthMonitor, replicateCircuitBreaker, blobCircuitBreaker } from '@/lib/retry-utils';

export const dynamic = "force-dynamic";

/**
 * API endpoint for monitoring system health and circuit breaker status
 */
export async function GET() {
  try {
    // Check Replicate API health
    const replicateHealthy = await apiHealthMonitor.checkHealth('replicate', async () => {
      try {
        const response = await fetch('https://api.replicate.com/v1/models', {
          method: 'HEAD',
          headers: {
            'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`
          }
        });
        return response.ok;
      } catch {
        return false;
      }
    });

    // Check Vercel Blob health (simple connectivity test)
    const blobHealthy = await apiHealthMonitor.checkHealth('vercel-blob', async () => {
      try {
        // We can't easily test blob without uploading, so we check if token exists
        return !!process.env.BLOB_READ_WRITE_TOKEN;
      } catch {
        return false;
      }
    });

    // Get all health statuses
    const healthStatuses = apiHealthMonitor.getAllHealthStatus();
    
    // Get circuit breaker states
    const replicateCircuitState = replicateCircuitBreaker.getState();
    const blobCircuitState = blobCircuitBreaker.getState();

    // Determine overall system health
    const criticalServices = ['replicate'];
    const overallHealthy = criticalServices.every(service => 
      healthStatuses[service]?.isHealthy !== false
    );

    const response = {
      timestamp: new Date().toISOString(),
      overall: {
        status: overallHealthy ? 'healthy' : 'degraded',
        healthy: overallHealthy
      },
      services: {
        replicate: {
          healthy: replicateHealthy,
          circuitBreaker: replicateCircuitState,
          ...healthStatuses.replicate
        },
        'vercel-blob': {
          healthy: blobHealthy,
          circuitBreaker: blobCircuitState,
          ...healthStatuses['vercel-blob']
        }
      },
      metrics: {
        totalServices: Object.keys(healthStatuses).length,
        healthyServices: Object.values(healthStatuses).filter(s => s.isHealthy).length,
        circuitBreakersOpen: [replicateCircuitState, blobCircuitState].filter(s => s.state === 'OPEN').length
      }
    };

    return NextResponse.json(response, {
      status: overallHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overall: {
        status: 'error',
        healthy: false
      },
      error: error instanceof Error ? error.message : 'Unknown error',
      services: {},
      metrics: {
        totalServices: 0,
        healthyServices: 0,
        circuitBreakersOpen: 0
      }
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}

/**
 * Reset circuit breakers (for admin use)
 */
export async function POST(request: Request) {
  try {
    const { action, service } = await request.json();

    if (action === 'reset-circuit-breaker') {
      if (service === 'replicate' || service === 'all') {
        // Reset replicate circuit breaker (we'd need to add a reset method)
        // For now, we'll just return the current state
      }
      
      if (service === 'blob' || service === 'all') {
        // Reset blob circuit breaker
      }

      return NextResponse.json({
        message: 'Circuit breaker reset requested',
        timestamp: new Date().toISOString(),
        service,
        replicateState: replicateCircuitBreaker.getState(),
        blobState: blobCircuitBreaker.getState()
      });
    }

    return NextResponse.json({
      error: 'Invalid action',
      availableActions: ['reset-circuit-breaker']
    }, { status: 400 });

  } catch (error) {
    return NextResponse.json({
      error: 'Invalid request',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 });
  }
}