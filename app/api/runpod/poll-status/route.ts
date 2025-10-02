import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { runPodService } from '@/lib/runpod-service';
import { Logger } from '@/lib/logger';

export const dynamic = "force-dynamic";

const logger = new Logger('RUNPOD_POLL_STATUS');

export async function POST(req: Request) {
  try {
    const { trainingId } = await req.json();

    if (!trainingId) {
      return NextResponse.json({ error: 'Training ID required' }, { status: 400 });
    }

    logger.logInfo('POLLING_STATUS_START', { trainingId });

    // Get status from RunPod
    const status = await runPodService.getTrainingStatus(trainingId);

    // Create Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get() { return undefined; },
          set() {},
          remove() {},
        },
      }
    );

    // Map RunPod status to our database status
    const statusMapping = {
      'IN_QUEUE': 'processing',
      'IN_PROGRESS': 'processing', 
      'COMPLETED': 'finished',
      'FAILED': 'failed',
      'CANCELLED': 'failed'
    };

    const dbStatus = statusMapping[status.status as keyof typeof statusMapping] || 'processing';

    // Update model status in database
    const { data: updatedModel, error: updateError } = await supabase
      .from('models')
      .update({ 
        status: dbStatus,
        updated_at: new Date().toISOString()
      })
      .eq('modelId', trainingId)
      .select()
      .single();

    if (updateError) {
      logger.logError('MODEL_UPDATE_FAILED', updateError.message || 'Failed to update model', { error: updateError });
    } else {
      logger.logSuccess('MODEL_STATUS_UPDATED', {
        trainingId,
        runpodStatus: status.status,
        dbStatus,
        modelId: updatedModel?.id
      });
    }

    return NextResponse.json({
      success: true,
      runpodStatus: status.status,
      dbStatus,
      modelUpdated: !updateError,
      executionTime: status.executionTime,
      logs: status.logs
    });

  } catch (error) {
    logger.logError('POLL_STATUS_ERROR', error);
    
    return NextResponse.json({
      error: 'Failed to poll status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}