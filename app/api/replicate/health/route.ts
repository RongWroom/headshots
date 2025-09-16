import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

interface ReplicateHealthResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  message: string;
  details?: any;
  responseTime?: number;
}

interface ReplicateHealthResponse {
  overall: 'healthy' | 'unhealthy' | 'warning';
  timestamp: string;
  checks: ReplicateHealthResult[];
}

export async function GET() {
  const checks: ReplicateHealthResult[] = [];

  // Check API authentication
  const authCheck = await checkReplicateAuthentication();
  checks.push(authCheck);

  // Check fast-flux-trainer model access
  const modelCheck = await checkFastFluxTrainerAccess();
  checks.push(modelCheck);

  // Check model creation permissions
  const createCheck = await checkModelCreationPermissions();
  checks.push(createCheck);

  // Determine overall health
  const hasUnhealthy = checks.some(check => check.status === 'unhealthy');
  const hasWarning = checks.some(check => check.status === 'warning');
  
  let overall: 'healthy' | 'unhealthy' | 'warning' = 'healthy';
  if (hasUnhealthy) {
    overall = 'unhealthy';
  } else if (hasWarning) {
    overall = 'warning';
  }

  const response: ReplicateHealthResponse = {
    overall,
    timestamp: new Date().toISOString(),
    checks
  };

  const statusCode = overall === 'unhealthy' ? 503 : 200;
  
  return NextResponse.json(response, { 
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

async function checkReplicateAuthentication(): Promise<ReplicateHealthResult> {
  const startTime = Date.now();
  
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return {
        service: 'Replicate Authentication',
        status: 'unhealthy',
        message: 'REPLICATE_API_TOKEN not configured',
        responseTime: Date.now() - startTime
      };
    }

    const response = await fetch('https://api.replicate.com/v1/account', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        service: 'Replicate Authentication',
        status: 'unhealthy',
        message: `Authentication failed: ${response.status} ${response.statusText}`,
        details: errorData,
        responseTime
      };
    }

    const accountData = await response.json();
    
    return {
      service: 'Replicate Authentication',
      status: 'healthy',
      message: 'Authentication successful',
      details: {
        username: accountData.username,
        type: accountData.type,
        github_url: accountData.github_url
      },
      responseTime
    };

  } catch (error) {
    return {
      service: 'Replicate Authentication',
      status: 'unhealthy',
      message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime: Date.now() - startTime
    };
  }
}

async function checkFastFluxTrainerAccess(): Promise<ReplicateHealthResult> {
  const startTime = Date.now();
  
  try {
    // Check access to the fast-flux-trainer model
    const modelUrl = 'https://api.replicate.com/v1/models/replicate/fast-flux-trainer';
    const response = await fetch(modelUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        service: 'Fast-Flux-Trainer Model Access',
        status: 'unhealthy',
        message: `Model access failed: ${response.status} ${response.statusText}`,
        details: errorData,
        responseTime
      };
    }

    const modelData = await response.json();
    
    // Check if the specific version we're using exists
    const targetVersion = '8b10794665aed907bb98a1a5324cd1d3a8bea0e9b31e65210967fb9c9e2e08ed';
    const hasTargetVersion = modelData.latest_version?.id === targetVersion;
    
    return {
      service: 'Fast-Flux-Trainer Model Access',
      status: hasTargetVersion ? 'healthy' : 'warning',
      message: hasTargetVersion 
        ? 'Model access successful, target version available'
        : 'Model accessible but target version may be outdated',
      details: {
        modelName: modelData.name,
        latestVersion: modelData.latest_version?.id,
        targetVersion,
        versionMatch: hasTargetVersion,
        description: modelData.description
      },
      responseTime
    };

  } catch (error) {
    return {
      service: 'Fast-Flux-Trainer Model Access',
      status: 'unhealthy',
      message: `Model access error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime: Date.now() - startTime
    };
  }
}

async function checkModelCreationPermissions(): Promise<ReplicateHealthResult> {
  const startTime = Date.now();
  
  try {
    if (!process.env.REPLICATE_USERNAME) {
      return {
        service: 'Model Creation Permissions',
        status: 'warning',
        message: 'REPLICATE_USERNAME not configured - model creation may fail',
        responseTime: Date.now() - startTime
      };
    }

    // Test by trying to list user's models (this requires proper permissions)
    const response = await fetch(`https://api.replicate.com/v1/models?owner=${process.env.REPLICATE_USERNAME}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        service: 'Model Creation Permissions',
        status: 'unhealthy',
        message: `Permission check failed: ${response.status} ${response.statusText}`,
        details: errorData,
        responseTime
      };
    }

    const modelsData = await response.json();
    
    return {
      service: 'Model Creation Permissions',
      status: 'healthy',
      message: 'Model creation permissions verified',
      details: {
        username: process.env.REPLICATE_USERNAME,
        existingModelsCount: modelsData.results?.length || 0
      },
      responseTime
    };

  } catch (error) {
    return {
      service: 'Model Creation Permissions',
      status: 'unhealthy',
      message: `Permission check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime: Date.now() - startTime
    };
  }
}