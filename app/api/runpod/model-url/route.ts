import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Logger } from '@/lib/logger';
import { runPodModelManager } from '@/lib/runpod-model-manager';

export const dynamic = "force-dynamic";

const logger = new Logger('RUNPOD_MODEL_URL_API');

/**
 * Get the model URL for a trained model
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const modelId = url.searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json({
        error: 'Missing modelId parameter'
      }, { status: 400 });
    }

    // Create Supabase client
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

    // Get model from database
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('*')
      .eq('id', modelId)
      .single();

    if (modelError || !model) {
      return NextResponse.json({
        error: 'Model not found'
      }, { status: 404 });
    }

    if (model.status !== 'finished') {
      return NextResponse.json({
        error: 'Model is not ready',
        status: model.status
      }, { status: 400 });
    }

    logger.logInfo('FETCHING_MODEL_URL', {
      modelId,
      trainingId: model.modelId
    });

    // Get model URL from RunPod
    const modelPreparation = await runPodModelManager.prepareModelForInference(
      model.modelId,
      model.name
    );

    if (!modelPreparation.ready) {
      return NextResponse.json({
        error: 'Model not ready for inference',
        message: 'Training may still be in progress or model file not available'
      }, { status: 503 });
    }

    logger.logSuccess('MODEL_URL_RETRIEVED', {
      modelId,
      modelUrl: modelPreparation.modelUrl,
      triggerWord: modelPreparation.triggerWord
    });

    return NextResponse.json({
      success: true,
      modelUrl: modelPreparation.modelUrl,
      triggerWord: modelPreparation.triggerWord,
      modelName: model.name,
      ready: true
    });

  } catch (error) {
    logger.logError('MODEL_URL_REQUEST_ERROR', error);
    
    return NextResponse.json({
      error: 'Failed to get model URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}