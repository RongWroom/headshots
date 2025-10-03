import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Logger } from '@/lib/logger';

export const dynamic = "force-dynamic";

const logger = new Logger('GENERATE_HEADSHOTS_API');

export async function POST(req: Request) {
  try {
    // Create Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.headers.get('cookie')?.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1];
          },
          set() { },
          remove() { },
        },
      }
    );

    // Authentication check
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      logger.logError('AUTH_FAILED', error || 'No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    logger.setUserId(userId);

    // Parse request
    const { modelId, prompt, packSlug, numOutputs = 4 } = await req.json();

    if (!modelId || !prompt) {
      return NextResponse.json({
        error: 'Missing required fields: modelId and prompt'
      }, { status: 400 });
    }

    logger.logInfo('GENERATION_REQUEST_START', {
      modelId,
      prompt,
      packSlug,
      numOutputs
    });

    // Get the customer's trained model
    const { data: customerModel, error: modelError } = await supabase
      .from('models')
      .select('*')
      .eq('id', modelId)
      .eq('user_id', userId)
      .single();

    if (modelError || !customerModel) {
      logger.logError('MODEL_NOT_FOUND', modelError?.message || 'Model not found', { error: modelError });
      return NextResponse.json({
        error: 'Model not found or access denied'
      }, { status: 404 });
    }

    // Get the photographer's base style model (your DanDan style)
    const { data: styleModel, error: styleError } = await supabase
      .from('models')
      .select('*')
      .eq('type', 'raw-tune')
      .eq('status', 'finished')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (styleError || !styleModel) {
      logger.logWarning('STYLE_MODEL_NOT_FOUND', 'No photographer style model found, using default');
    }

    // Build the enhanced prompt for Replicate generation
    // Since we're using the Replicate style model, we need to use a generic approach
    // The customer's specific face training from RunPod can't be directly used with Replicate

    // Pack-specific style modifiers
    const packStyles = {
      'actor-headshots': 'professional actor headshot, dramatic lighting, cinematic, high detail',
      'corporate-headshots': 'professional corporate headshot, clean background, business attire, professional lighting',
      'creative-headshots': 'creative professional headshot, artistic lighting, modern style'
    };

    const packStyle = packStyles[packSlug as keyof typeof packStyles] || packStyles['corporate-headshots'];

    // For now, use the Replicate style model with the user's prompt
    // TODO: Implement proper RunPod model integration for personalized faces
    const enhancedPrompt = `${packStyle}, ${prompt}, professional photography, high quality, detailed`;

    logger.logInfo('PROMPT_ENHANCED', {
      originalPrompt: prompt,
      enhancedPrompt,
      styleModelFound: !!styleModel,
      packStyle
    });

    // Build enhanced prompt for FLUX.1 Dev (generic for now)
    // Note: Not using trigger word since we're testing with generic FLUX
    const finalPrompt = `${packStyle}, ${prompt}, professional photography studio lighting, high resolution, sharp focus, detailed facial features, commercial quality headshot`;

    logger.logInfo('USING_RUNPOD_GENERATION', {
      modelId: customerModel.modelId,
      finalPrompt,
      triggerWord
    });

    // Check if we have a dedicated inference endpoint
    const inferenceEndpoint = process.env.RUNPOD_INFERENCE_ENDPOINT;

    if (!inferenceEndpoint) {
      return NextResponse.json({
        error: 'RunPod inference endpoint not configured',
        message: 'Please set up a RunPod inference endpoint for generation',
        details: 'Training works, but generation requires a separate inference endpoint'
      }, { status: 503 });
    }

    // For now, we'll use FLUX.1 Dev without custom models (testing phase)
    // TODO: Later integrate custom LoRA models for personalization
    logger.logInfo('USING_FLUX_DEV_GENERIC', {
      modelName: customerModel.name,
      note: 'Using generic FLUX.1 Dev for testing - personalization coming later'
    });

    // Prepare FLUX.1 Dev inference request (text-to-image)
    const runpodPayload = {
      input: {
        prompt: finalPrompt,
        width: 1024,
        height: 1024,
        num_inference_steps: 28,
        guidance: 5.0, // Good for portraits
        seed: -1, // Random seed
        negative_prompt: "blurry, low quality, distorted, bad anatomy, deformed, disfigured, multiple people, crowd",
        image_format: "webp"
      }
    };

    // Send request to RunPod inference endpoint
    const runpodEndpoint = inferenceEndpoint;

    if (!runpodEndpoint || !process.env.RUNPOD_API_KEY) {
      return NextResponse.json({
        error: 'RunPod generation service not configured'
      }, { status: 500 });
    }

    const response = await fetch(runpodEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(runpodPayload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.logError('RUNPOD_GENERATION_FAILED', `HTTP ${response.status}`, {
        error: errorData,
        status: response.status
      });

      return NextResponse.json({
        error: 'Generation request failed',
        details: errorData.error || `HTTP ${response.status}`
      }, { status: 500 });
    }

    const generationResult = await response.json();

    logger.logSuccess('GENERATION_COMPLETED', {
      generationId: generationResult.id,
      status: generationResult.status
    });

    // Store generation job in database
    const { data: generationJob, error: jobError } = await supabase
      .from('generation_jobs')
      .insert({
        user_id: userId,
        status: 'processing',
        style: packSlug || 'corporate-headshots',
        poses: [prompt],
        runpod_job_id: generationResult.id,
        model_id: modelId
      })
      .select()
      .single();

    if (jobError) {
      logger.logWarning('GENERATION_JOB_SAVE_FAILED', jobError.message || 'Failed to save generation job', { error: jobError });
    }

    return NextResponse.json({
      success: true,
      generationId: generationResult.id,
      status: generationResult.status,
      jobId: generationJob?.id,
      enhancedPrompt: finalPrompt,
      message: 'Generating professional headshots with FLUX.1 Dev',
      estimatedTime: '30-60 seconds',
      note: 'Testing phase: Using generic FLUX model. Personalization will be added next.',
      modelUsed: 'FLUX.1 Dev (Generic)'
    });

  } catch (error) {
    logger.logError('GENERATION_REQUEST_ERROR', error);

    return NextResponse.json({
      error: 'Generation request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}