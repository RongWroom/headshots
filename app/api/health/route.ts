import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export const dynamic = "force-dynamic";

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  message: string;
  details?: any;
  responseTime?: number;
}

interface HealthCheckResponse {
  overall: 'healthy' | 'unhealthy' | 'warning';
  timestamp: string;
  checks: HealthCheckResult[];
}

export async function GET() {
  const checks: HealthCheckResult[] = [];
  const startTime = Date.now();

  // Check Replicate API connectivity and authentication
  const replicateCheck = await checkReplicateHealth();
  checks.push(replicateCheck);

  // Check Vercel Blob connectivity
  const blobCheck = await checkVercelBlobHealth();
  checks.push(blobCheck);

  // Check environment variables
  const envCheck = checkEnvironmentVariables();
  checks.push(envCheck);

  // Determine overall health
  const hasUnhealthy = checks.some(check => check.status === 'unhealthy');
  const hasWarning = checks.some(check => check.status === 'warning');
  
  let overall: 'healthy' | 'unhealthy' | 'warning' = 'healthy';
  if (hasUnhealthy) {
    overall = 'unhealthy';
  } else if (hasWarning) {
    overall = 'warning';
  }

  const response: HealthCheckResponse = {
    overall,
    timestamp: new Date().toISOString(),
    checks
  };

  const statusCode = overall === 'unhealthy' ? 503 : 200;
  
  return NextResponse.json(response, { 
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}

async function checkReplicateHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return {
        service: 'Replicate API',
        status: 'unhealthy',
        message: 'REPLICATE_API_TOKEN environment variable not set',
        responseTime: Date.now() - startTime
      };
    }

    // Test authentication by fetching account info
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
        service: 'Replicate API',
        status: 'unhealthy',
        message: `Authentication failed: ${response.status} ${response.statusText}`,
        details: errorData,
        responseTime
      };
    }

    const accountData = await response.json();
    
    return {
      service: 'Replicate API',
      status: 'healthy',
      message: 'Authentication successful',
      details: {
        username: accountData.username,
        type: accountData.type
      },
      responseTime
    };

  } catch (error) {
    return {
      service: 'Replicate API',
      status: 'unhealthy',
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime: Date.now() - startTime
    };
  }
}

async function checkVercelBlobHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return {
        service: 'Vercel Blob',
        status: 'unhealthy',
        message: 'BLOB_READ_WRITE_TOKEN environment variable not set',
        responseTime: Date.now() - startTime
      };
    }

    // Test blob connectivity by uploading a small test file
    const testContent = `Health check test - ${new Date().toISOString()}`;
    const testFilename = `health-check-${Date.now()}.txt`;
    
    const blob = await put(testFilename, testContent, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: 'text/plain'
    });

    const responseTime = Date.now() - startTime;

    // Verify the uploaded file is accessible
    const verifyResponse = await fetch(blob.url);
    if (!verifyResponse.ok) {
      return {
        service: 'Vercel Blob',
        status: 'warning',
        message: 'Upload successful but file not accessible',
        details: { uploadUrl: blob.url },
        responseTime
      };
    }

    return {
      service: 'Vercel Blob',
      status: 'healthy',
      message: 'Upload and access successful',
      details: { 
        testFileUrl: blob.url,
        downloadUrl: blob.downloadUrl 
      },
      responseTime
    };

  } catch (error) {
    return {
      service: 'Vercel Blob',
      status: 'unhealthy',
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      responseTime: Date.now() - startTime
    };
  }
}

function checkEnvironmentVariables(): HealthCheckResult {
  const requiredVars = [
    'REPLICATE_API_TOKEN',
    'BLOB_READ_WRITE_TOKEN',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  const optionalVars = [
    'REPLICATE_USERNAME',
    'REPLICATE_WEBHOOK_SECRET'
  ];
  const missingOptionalVars = optionalVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    return {
      service: 'Environment Variables',
      status: 'unhealthy',
      message: `Missing required environment variables: ${missingVars.join(', ')}`,
      details: {
        missing: missingVars,
        missingOptional: missingOptionalVars
      }
    };
  }

  if (missingOptionalVars.length > 0) {
    return {
      service: 'Environment Variables',
      status: 'warning',
      message: `Missing optional environment variables: ${missingOptionalVars.join(', ')}`,
      details: {
        missingOptional: missingOptionalVars
      }
    };
  }

  return {
    service: 'Environment Variables',
    status: 'healthy',
    message: 'All required environment variables are set'
  };
}