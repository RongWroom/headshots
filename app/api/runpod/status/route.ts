import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { runPodService } from '@/lib/runpod-service';
import { Logger, extractErrorDetails } from '@/lib/logger';
import { costTrackingService } from '@/lib/cost-tracking';

export const dynamic = "force-dynamic";

/**
 * Get RunPod training status with comprehensive error handling
 */
export async function GET(request: Request) {
  const logger = new Logger('RUNPOD_STATUS');
  
  try {
    const url = new URL(request.url);
    const trainingId = url.searchParams.get('training_id');
    
    if (!trainingId) {
      const errorResponse = logger.createErrorResponse(
        'Missing training ID',
        'Training ID is required to check status',
        'MISSING_TRAINING_ID',
        {},
        ['Provide a valid training ID in the query parameters']
      );
      
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Create Supabase client for authentication
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.headers.get('cookie')?.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1];
          },
          set() {},
          remove() {},
        },
      }
    );

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      const errorResponse = logger.createErrorResponse(
        'Authentication failed',
        'Please sign in to check training status',
        'UNAUTHORIZED',
        { authError: authError ? extractErrorDetails(authError) : 'No user found' },
        ['Sign in to your account', 'Check if your session has expired']
      );
      
      logger.logError('AUTH_FAILED', authError || 'No user found');
      return NextResponse.json(errorResponse, { status: 401 });
    }

    logger.setUserId(user.id);
    logger.logInfo('RUNPOD_STATUS_REQUEST', { trainingId, userId: user.id });

    // Check service health first
    const isHealthy = await runPodService.checkHealth();
    if (!isHealthy) {
      logger.logWarning('RUNPOD_SERVICE_UNHEALTHY', 'Service health check failed', { trainingId });
    }

    // Get training status using the enhanced service
    let statusResult;
    try {
      statusResult = await runPodService.getTrainingStatus(trainingId);
      
      logger.logSuccess('RUNPOD_STATUS_RETRIEVED', {
        trainingId,
        status: statusResult.status,
        executionTime: statusResult.executionTime,
        delayTime: statusResult.delayTime
      });

      // Record actual training cost if training is completed
      if (statusResult.status === 'COMPLETED' && statusResult.executionTime) {
        await recordTrainingCost(trainingId, statusResult, user.id, logger);
      }

    } catch (statusError: any) {
      // The RunPod service provides user-friendly error messages
      const errorResponse = logger.createErrorResponse(
        'Failed to get training status',
        statusError.message || 'Unable to retrieve training status from RunPod',
        statusError.code || 'STATUS_CHECK_FAILED',
        { 
          trainingId,
          statusError: extractErrorDetails(statusError),
          serviceHealth: runPodService.getHealthStatus()
        },
        statusError.actionableSteps || [
          'Check that the training ID is correct',
          'Verify the training job exists',
          'Try again in a few moments'
        ]
      );
      
      logger.logError('RUNPOD_STATUS_FAILED', statusError.message || 'Failed to get status', { error: statusError, trainingId });
      
      // Use appropriate HTTP status code
      let statusCode = 500;
      if (statusError.code === 'AUTH_ERROR') statusCode = 401;
      else if (statusError.code === 'SERVICE_UNAVAILABLE') statusCode = 503;
      else if (statusError.code === 'TIMEOUT') statusCode = 408;
      
      return NextResponse.json(errorResponse, { status: statusCode });
    }

    // Calculate additional status information
    const statusInfo = calculateRunPodStatusInfo(statusResult);

    // Get service health status for additional context
    const healthStatus = runPodService.getHealthStatus();

    const successResponse = {
      success: true,
      trainingId,
      status: statusResult.status,
      message: getStatusMessage(statusResult.status),
      details: {
        ...statusResult,
        ...statusInfo,
        serviceHealth: {
          isHealthy,
          ...healthStatus
        }
      }
    };

    return NextResponse.json(successResponse);

  } catch (error) {
    const errorResponse = logger.createErrorResponse(
      'Status check failed',
      'An unexpected error occurred while checking training status',
      'STATUS_CHECK_ERROR',
      { 
        error: extractErrorDetails(error),
        timestamp: new Date().toISOString()
      },
      [
        'Check your internet connection',
        'Verify the training ID is correct',
        'Try again in a few moments',
        'Contact support if the issue persists'
      ]
    );
    
    logger.logError('STATUS_CHECK_ERROR', error);
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * Cancel a RunPod training job
 */
export async function DELETE(request: Request) {
  const logger = new Logger('RUNPOD_CANCEL');
  
  try {
    const url = new URL(request.url);
    const trainingId = url.searchParams.get('training_id');
    
    if (!trainingId) {
      const errorResponse = logger.createErrorResponse(
        'Missing training ID',
        'Training ID is required to cancel training',
        'MISSING_TRAINING_ID',
        {},
        ['Provide a valid training ID in the query parameters']
      );
      
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Create Supabase client for authentication
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.headers.get('cookie')?.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1];
          },
          set() {},
          remove() {},
        },
      }
    );

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      const errorResponse = logger.createErrorResponse(
        'Authentication failed',
        'Please sign in to cancel training',
        'UNAUTHORIZED',
        { authError: authError ? extractErrorDetails(authError) : 'No user found' },
        ['Sign in to your account', 'Check if your session has expired']
      );
      
      logger.logError('AUTH_FAILED', authError || 'No user found');
      return NextResponse.json(errorResponse, { status: 401 });
    }

    logger.setUserId(user.id);
    logger.logInfo('RUNPOD_CANCEL_REQUEST', { trainingId, userId: user.id });

    // Cancel training using the enhanced service
    try {
      await runPodService.cancelTraining(trainingId);
      
      logger.logSuccess('RUNPOD_TRAINING_CANCELLED', { trainingId });

      return NextResponse.json({
        success: true,
        trainingId,
        message: 'Training job cancelled successfully',
        status: 'cancelled'
      });

    } catch (cancelError: any) {
      const errorResponse = logger.createErrorResponse(
        'Failed to cancel training',
        cancelError.message || 'Unable to cancel training job',
        cancelError.code || 'CANCEL_FAILED',
        { 
          trainingId,
          cancelError: extractErrorDetails(cancelError)
        },
        cancelError.actionableSteps || [
          'Check that the training ID is correct',
          'Verify the training job is still running',
          'Try again in a few moments'
        ]
      );
      
      logger.logError('RUNPOD_CANCEL_FAILED', cancelError.message || 'Failed to cancel training', { error: cancelError, trainingId });
      
      let statusCode = 500;
      if (cancelError.code === 'AUTH_ERROR') statusCode = 401;
      else if (cancelError.code === 'SERVICE_UNAVAILABLE') statusCode = 503;
      
      return NextResponse.json(errorResponse, { status: statusCode });
    }

  } catch (error) {
    const errorResponse = logger.createErrorResponse(
      'Cancel request failed',
      'An unexpected error occurred while cancelling training',
      'CANCEL_REQUEST_ERROR',
      { 
        error: extractErrorDetails(error),
        timestamp: new Date().toISOString()
      },
      [
        'Check your internet connection',
        'Verify the training ID is correct',
        'Try again in a few moments',
        'Contact support if the issue persists'
      ]
    );
    
    logger.logError('CANCEL_REQUEST_ERROR', error);
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * Calculate additional status information for RunPod training
 */
function calculateRunPodStatusInfo(statusResult: any) {
  const now = Date.now();
  let estimatedTimeRemaining = null;
  let progressPercentage = null;
  
  // Calculate progress and time estimates based on status
  switch (statusResult.status) {
    case 'IN_QUEUE':
      estimatedTimeRemaining = 5 * 60 * 1000; // 5 minutes queue time estimate
      progressPercentage = 0;
      break;
      
    case 'IN_PROGRESS':
      // If we have execution time, estimate progress
      if (statusResult.executionTime) {
        const executionMinutes = statusResult.executionTime / 1000 / 60;
        const estimatedTotalMinutes = 20; // Typical training time
        progressPercentage = Math.min(95, (executionMinutes / estimatedTotalMinutes) * 100);
        estimatedTimeRemaining = Math.max(0, (estimatedTotalMinutes - executionMinutes) * 60 * 1000);
      } else {
        progressPercentage = 10; // Just started
        estimatedTimeRemaining = 18 * 60 * 1000; // 18 minutes remaining
      }
      break;
      
    case 'COMPLETED':
      progressPercentage = 100;
      estimatedTimeRemaining = 0;
      break;
      
    case 'FAILED':
    case 'CANCELLED':
      progressPercentage = statusResult.executionTime ? 50 : 0; // Estimate based on when it failed
      estimatedTimeRemaining = 0;
      break;
  }
  
  return {
    progressPercentage,
    estimatedTimeRemaining,
    formattedExecutionTime: statusResult.executionTime ? formatDuration(statusResult.executionTime) : null,
    formattedDelayTime: statusResult.delayTime ? formatDuration(statusResult.delayTime) : null,
    formattedEstimatedRemaining: estimatedTimeRemaining ? formatDuration(estimatedTimeRemaining) : null,
    isActive: ['IN_QUEUE', 'IN_PROGRESS'].includes(statusResult.status),
    isComplete: ['COMPLETED', 'FAILED', 'CANCELLED'].includes(statusResult.status),
    canCancel: ['IN_QUEUE', 'IN_PROGRESS'].includes(statusResult.status),
    canRetry: statusResult.status === 'FAILED'
  };
}

/**
 * Get user-friendly status message
 */
function getStatusMessage(status: string): string {
  switch (status) {
    case 'IN_QUEUE':
      return 'Training job is queued and waiting for available GPU resources';
    case 'IN_PROGRESS':
      return 'Training is currently in progress';
    case 'COMPLETED':
      return 'Training completed successfully!';
    case 'FAILED':
      return 'Training failed - check error details for more information';
    case 'CANCELLED':
      return 'Training was cancelled';
    default:
      return `Training status: ${status}`;
  }
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Record actual training cost when training completes
 */
async function recordTrainingCost(trainingId: string, statusResult: any, userId: string, logger: Logger) {
  try {
    // Check if cost has already been recorded for this training
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get() { return undefined; },
          set() {},
          remove() {},
        },
      }
    );

    const { data: existingCost } = await supabase
      .from('training_costs')
      .select('id')
      .eq('training_id', trainingId)
      .single();

    if (existingCost) {
      logger.logInfo('COST_ALREADY_RECORDED', { trainingId, costId: existingCost.id });
      return;
    }

    // Get model information
    const { data: model } = await supabase
      .from('models')
      .select('id')
      .eq('modelId', trainingId)
      .single();

    if (!model) {
      logger.logWarning('MODEL_NOT_FOUND_FOR_COST_TRACKING', 'Model not found for cost tracking', { trainingId });
      return;
    }

    // Calculate actual cost based on execution time
    const executionTimeMinutes = Math.ceil(statusResult.executionTime / 1000 / 60);
    const gpuCostPerHour = 0.79; // RTX 4090 cost per hour
    const gpuCost = (executionTimeMinutes / 60) * gpuCostPerHour;
    const storageCost = 0.01; // Minimal storage cost
    const networkCost = 0.02; // Minimal network cost
    const serviceFee = (gpuCost + storageCost + networkCost) * 0.05; // 5% service fee
    const totalCost = gpuCost + storageCost + networkCost + serviceFee;

    const trainingStartTime = new Date(Date.now() - statusResult.executionTime - (statusResult.delayTime || 0));
    const trainingEndTime = new Date();

    await costTrackingService.recordTrainingCost({
      modelId: model.id,
      userId,
      trainingId,
      serviceProvider: 'runpod',
      gpuType: 'RTX 4090',
      trainingStartTime,
      trainingEndTime,
      trainingDurationMinutes: executionTimeMinutes,
      gpuCostPerHour,
      totalCost: Math.round(totalCost * 100) / 100,
      currency: 'USD',
      costBreakdown: {
        gpuCost: Math.round(gpuCost * 100) / 100,
        storageCost: Math.round(storageCost * 100) / 100,
        networkCost: Math.round(networkCost * 100) / 100,
        serviceFee: Math.round(serviceFee * 100) / 100
      },
      trainingParameters: {
        executionTime: statusResult.executionTime,
        delayTime: statusResult.delayTime
      },
      status: 'completed'
    });

    logger.logSuccess('TRAINING_COST_RECORDED', {
      trainingId,
      totalCost: Math.round(totalCost * 100) / 100,
      executionTimeMinutes
    });

  } catch (error) {
    logger.logError('COST_RECORDING_FAILED', error, { trainingId });
    // Don't fail the status request if cost recording fails
  }
}