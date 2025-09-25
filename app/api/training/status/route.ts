import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Logger } from '@/lib/logger';
import { trainingMonitoringService } from '@/lib/training-monitoring';

export const dynamic = "force-dynamic";

/**
 * Get comprehensive training status for user's models
 */
export async function GET(request: Request) {
  const logger = new Logger('TRAINING_STATUS');
  
  try {
    const url = new URL(request.url);
    const modelId = url.searchParams.get('model_id');
    const sessionId = url.searchParams.get('session_id');
    
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

    if (sessionId) {
      // Get specific training session status
      const session = await trainingMonitoringService.getTrainingSession(sessionId);
      
      if (!session || session.user_id !== user.id) {
        logger.logError('TRAINING_SESSION_NOT_FOUND', null, { sessionId });
        return NextResponse.json(
          { error: 'Training session not found' },
          { status: 404 }
        );
      }

      // Calculate progress information
      const progressInfo = await trainingMonitoringService.calculateTrainingProgress(sessionId);
      const estimatedCompletion = await trainingMonitoringService.estimateCompletionTime(sessionId);

      logger.logSuccess('TRAINING_SESSION_STATUS_RETRIEVED', { 
        sessionId, 
        status: session.status,
        progress: progressInfo.progressPercentage
      });

      return NextResponse.json({
        session: {
          ...session,
          progressInfo,
          estimatedCompletionTime: estimatedCompletion?.toISOString()
        }
      });

    } else if (modelId) {
      // Get training sessions for specific model
      const sessions = await trainingMonitoringService.getTrainingSessionsByModel(parseInt(modelId));
      
      // Filter sessions for current user
      const userSessions = sessions.filter(session => session.user_id === user.id);
      
      if (userSessions.length === 0) {
        logger.logError('MODEL_SESSIONS_NOT_FOUND', null, { modelId });
        return NextResponse.json(
          { error: 'No training sessions found for model' },
          { status: 404 }
        );
      }

      // Get the most recent session
      const latestSession = userSessions[0];
      const progressInfo = await trainingMonitoringService.calculateTrainingProgress(latestSession.id);
      const estimatedCompletion = await trainingMonitoringService.estimateCompletionTime(latestSession.id);

      // Also get the legacy model info for backward compatibility
      const { data: model, error: modelError } = await supabase
        .from('models')
        .select('id, name, status, created_at, updated_at')
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

      logger.logSuccess('MODEL_TRAINING_STATUS_RETRIEVED', { 
        modelId, 
        sessionId: latestSession.id,
        status: latestSession.status 
      });

      return NextResponse.json({
        model,
        session: {
          ...latestSession,
          progressInfo,
          estimatedCompletionTime: estimatedCompletion?.toISOString()
        },
        allSessions: userSessions
      });

    } else {
      // Get all training sessions for user
      const sessions = await trainingMonitoringService.getTrainingSessionsByUser(user.id, {
        limit: 50,
        orderBy: 'created_at',
        orderDirection: 'desc'
      });

      // Get training history summary
      const history = await trainingMonitoringService.getTrainingHistory(user.id, {
        limit: 30 // Last 30 days
      });

      // Calculate summary statistics
      const activeSessions = sessions.filter(s => ['pending', 'queued', 'training'].includes(s.status));
      const completedSessions = sessions.filter(s => s.status === 'completed');
      const failedSessions = sessions.filter(s => s.status === 'failed');

      const summary = {
        total: sessions.length,
        active: activeSessions.length,
        completed: completedSessions.length,
        failed: failedSessions.length,
        successRate: sessions.length > 0 ? (completedSessions.length / sessions.length) * 100 : 0,
        averageTrainingTime: calculateAverageTrainingTime(completedSessions)
      };

      // Get progress info for active sessions
      const sessionsWithProgress = await Promise.all(
        sessions.slice(0, 10).map(async (session) => {
          if (['pending', 'queued', 'training'].includes(session.status)) {
            const progressInfo = await trainingMonitoringService.calculateTrainingProgress(session.id);
            const estimatedCompletion = await trainingMonitoringService.estimateCompletionTime(session.id);
            return {
              ...session,
              progressInfo,
              estimatedCompletionTime: estimatedCompletion?.toISOString()
            };
          }
          return session;
        })
      );

      logger.logSuccess('USER_TRAINING_STATUS_RETRIEVED', { 
        userId: user.id, 
        totalSessions: sessions.length,
        activeSessions: activeSessions.length,
        summary 
      });

      return NextResponse.json({
        sessions: sessionsWithProgress,
        history,
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
 * Calculate average training time for completed sessions
 */
function calculateAverageTrainingTime(sessions: any[]): number | null {
  const completedSessions = sessions.filter(s => 
    s.status === 'completed' && s.training_duration
  );

  if (completedSessions.length === 0) return null;

  const totalTime = completedSessions.reduce((sum, session) => sum + session.training_duration, 0);
  return totalTime / completedSessions.length;
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