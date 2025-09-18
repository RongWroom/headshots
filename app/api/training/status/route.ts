import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Logger } from '@/lib/logger';

export const dynamic = "force-dynamic";

/**
 * Get training status for user's models
 */
export async function GET(request: Request) {
  const logger = new Logger('TRAINING_STATUS');
  
  try {
    const url = new URL(request.url);
    const modelId = url.searchParams.get('model_id');
    
    // Create Supabase client
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

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      logger.logError('AUTH_FAILED', authError || 'No user found');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    logger.setUserId(user.id);

    if (modelId) {
      // Get specific model status
      const { data: model, error: modelError } = await supabase
        .from('models')
        .select(`
          id,
          name,
          status,
          progress,
          error,
          created_at,
          updated_at,
          training_started_at,
          training_completed_at,
          training_duration,
          replicate_model_id,
          webhook_events
        `)
        .eq('id', modelId)
        .eq('user_id', user.id)
        .single();

      if (modelError) {
        logger.logError('MODEL_FETCH_FAILED', modelError, { modelId });
        return NextResponse.json(
          { error: 'Model not found' },
          { status: 404 }
        );
      }

      // Calculate additional status info
      const statusInfo = calculateTrainingStatusInfo(model);

      logger.logSuccess('MODEL_STATUS_RETRIEVED', { modelId, status: model.status });

      return NextResponse.json({
        model: {
          ...model,
          ...statusInfo
        }
      });
    } else {
      // Get all models for user
      const { data: models, error: modelsError } = await supabase
        .from('models')
        .select(`
          id,
          name,
          status,
          progress,
          error,
          created_at,
          updated_at,
          training_started_at,
          training_completed_at,
          training_duration,
          replicate_model_id
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (modelsError) {
        logger.logError('MODELS_FETCH_FAILED', modelsError);
        return NextResponse.json(
          { error: 'Failed to fetch models' },
          { status: 500 }
        );
      }

      // Calculate status info for all models
      const modelsWithStatus = models.map(model => ({
        ...model,
        ...calculateTrainingStatusInfo(model)
      }));

      // Calculate summary statistics
      const summary = {
        total: models.length,
        pending: models.filter(m => m.status === 'pending').length,
        training: models.filter(m => m.status === 'training').length,
        finished: models.filter(m => m.status === 'finished').length,
        failed: models.filter(m => m.status === 'failed').length,
        averageTrainingTime: calculateAverageTrainingTime(models)
      };

      logger.logSuccess('MODELS_STATUS_RETRIEVED', { 
        userId: user.id, 
        totalModels: models.length,
        summary 
      });

      return NextResponse.json({
        models: modelsWithStatus,
        summary
      });
    }

  } catch (error) {
    logger.logError('TRAINING_STATUS_ERROR', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate additional training status information
 */
function calculateTrainingStatusInfo(model: any) {
  const now = new Date();
  const createdAt = new Date(model.created_at);
  const trainingStartedAt = model.training_started_at ? new Date(model.training_started_at) : null;
  const trainingCompletedAt = model.training_completed_at ? new Date(model.training_completed_at) : null;

  let estimatedTimeRemaining = null;
  let elapsedTime = null;
  let statusMessage = '';

  switch (model.status) {
    case 'pending':
      elapsedTime = now.getTime() - createdAt.getTime();
      statusMessage = 'Waiting to start training...';
      estimatedTimeRemaining = 15 * 60 * 1000; // 15 minutes default estimate
      break;

    case 'training':
      if (trainingStartedAt) {
        elapsedTime = now.getTime() - trainingStartedAt.getTime();
        
        // Estimate remaining time based on progress
        if (model.progress && model.progress > 0) {
          const progressRatio = model.progress / 100;
          const estimatedTotalTime = elapsedTime / progressRatio;
          estimatedTimeRemaining = estimatedTotalTime - elapsedTime;
          statusMessage = `Training in progress (${model.progress}%)...`;
        } else {
          estimatedTimeRemaining = 20 * 60 * 1000 - elapsedTime; // 20 minutes default
          statusMessage = 'Training in progress...';
        }
      } else {
        elapsedTime = now.getTime() - createdAt.getTime();
        statusMessage = 'Starting training...';
        estimatedTimeRemaining = 20 * 60 * 1000; // 20 minutes default
      }
      break;

    case 'finished':
      if (trainingStartedAt && trainingCompletedAt) {
        elapsedTime = trainingCompletedAt.getTime() - trainingStartedAt.getTime();
      } else if (model.training_duration) {
        elapsedTime = model.training_duration;
      }
      statusMessage = 'Training completed successfully!';
      break;

    case 'failed':
      if (trainingStartedAt && trainingCompletedAt) {
        elapsedTime = trainingCompletedAt.getTime() - trainingStartedAt.getTime();
      }
      statusMessage = `Training failed: ${model.error || 'Unknown error'}`;
      break;

    default:
      statusMessage = 'Unknown status';
  }

  return {
    elapsedTime,
    estimatedTimeRemaining: Math.max(0, estimatedTimeRemaining || 0),
    statusMessage,
    isActive: ['pending', 'training'].includes(model.status),
    isComplete: ['finished', 'failed'].includes(model.status),
    canRetry: model.status === 'failed',
    formattedElapsedTime: elapsedTime ? formatDuration(elapsedTime) : null,
    formattedEstimatedRemaining: estimatedTimeRemaining && estimatedTimeRemaining > 0 
      ? formatDuration(estimatedTimeRemaining) 
      : null
  };
}

/**
 * Calculate average training time for completed models
 */
function calculateAverageTrainingTime(models: any[]): number | null {
  const completedModels = models.filter(m => 
    m.status === 'finished' && m.training_duration
  );

  if (completedModels.length === 0) return null;

  const totalTime = completedModels.reduce((sum, model) => sum + model.training_duration, 0);
  return totalTime / completedModels.length;
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