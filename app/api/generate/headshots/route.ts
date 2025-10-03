import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Logger } from '@/lib/logger';
import { createSimpleFluxWorkflow } from '@/lib/comfyui-workflows';

export const dynamic = "force-dynamic";

const logger = new Logger('GENERATE_HEADSHOTS_API');

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'generate/headshots',
    timestamp: new Date().toISOString()
  });
}

export async function POST(req: Request) {
  const debugSteps: string[] = [];

  try {
    debugSteps.push('1. API request started');
    logger.logInfo('API_REQUEST_START', 'Starting headshots generation request');
    console.log('🚀 CHECKPOINT 1: API request started');

    // Validate environment variables
    debugSteps.push('2. Validating environment variables');
    console.log('🚀 CHECKPOINT 2: Validating environment variables');
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      logger.logError('ENV_MISSING', 'Missing Supabase environment variables');
      return NextResponse.json({
        error: 'Server configuration error',
        debugSteps,
        failedAt: 'Environment validation'
      }, { status: 500 });
    }
    debugSteps.push('2. ✅ Environment variables OK');
    console.log('✅ CHECKPOINT 2: Environment variables OK');

    // Create Supabase client
    debugSteps.push('3. Creating Supabase client');
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
    debugSteps.push('3. ✅ Supabase client created');

    // Authentication check
    debugSteps.push('4. Checking authentication');
    console.log('🚀 CHECKPOINT 3: Checking authentication');
    const { data: { user }, error } = await supabase.auth.getUser();
    console.log('🚀 CHECKPOINT 3.1: Auth result:', { hasUser: !!user, hasError: !!error });

    if (error || !user) {
      logger.logError('AUTH_FAILED', error || 'No user found', {
        error: error?.message,
        hasAuthHeader: !!req.headers.get('authorization'),
        hasCookieHeader: !!req.headers.get('cookie')
      });
      return NextResponse.json({
        error: 'Unauthorized',
        details: 'User authentication failed',
        debug: {
          hasAuthHeader: !!req.headers.get('authorization'),
          hasCookieHeader: !!req.headers.get('cookie'),
          errorMessage: error?.message
        }
      }, { status: 401 });
    }

    const userId = user.id;
    logger.setUserId(userId);
    logger.logInfo('USER_AUTHENTICATED', { userId });

    // Parse request
    console.log('🚀 CHECKPOINT 4: Parsing request body');
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('✅ CHECKPOINT 4: Request parsed successfully');
      logger.logInfo('REQUEST_PARSED', {
        hasModelId: !!requestBody.modelId,
        hasPrompt: !!requestBody.prompt,
        packSlug: requestBody.packSlug,
        numOutputs: requestBody.numOutputs
      });
    } catch (parseError) {
      logger.logError('REQUEST_PARSE_FAILED', parseError);
      return NextResponse.json({
        error: 'Invalid request body',
        details: 'Request body must be valid JSON'
      }, { status: 400 });
    }

    const { modelId, prompt, packSlug, numOutputs = 4 } = requestBody;

    // Enhanced validation with type checking
    logger.logInfo('REQUEST_VALIDATION', {
      modelId,
      modelIdType: typeof modelId,
      prompt,
      promptType: typeof prompt,
      packSlug,
      numOutputs,
      fullRequestBody: requestBody
    });

    if (!modelId || !prompt) {
      logger.logError('MISSING_REQUIRED_FIELDS', { modelId, prompt });
      return NextResponse.json({
        error: 'Missing required fields: modelId and prompt',
        received: { modelId, prompt, packSlug, numOutputs },
        types: {
          modelId: typeof modelId,
          prompt: typeof prompt
        }
      }, { status: 400 });
    }

    // Convert modelId to number if it's a string
    const numericModelId = typeof modelId === 'string' ? parseInt(modelId, 10) : modelId;
    if (isNaN(numericModelId)) {
      logger.logError('INVALID_MODEL_ID', { modelId, numericModelId });
      return NextResponse.json({
        error: 'Invalid model ID format',
        received: { modelId, type: typeof modelId }
      }, { status: 400 });
    }

    logger.logInfo('GENERATION_REQUEST_START', {
      modelId: numericModelId,
      originalModelId: modelId,
      prompt,
      packSlug,
      numOutputs
    });

    // Get the customer's trained model
    logger.logInfo('LOOKING_FOR_MODEL', { modelId: numericModelId, userId });

    const { data: customerModel, error: modelError } = await supabase
      .from('models')
      .select('*')
      .eq('id', numericModelId)
      .eq('user_id', userId)
      .single();

    if (modelError || !customerModel) {
      logger.logError('MODEL_NOT_FOUND', modelError?.message || 'Model not found', {
        error: modelError,
        modelId: numericModelId,
        userId
      });

      // Check if model exists but belongs to different user
      const { data: anyModel, error: anyError } = await supabase
        .from('models')
        .select('id, name, user_id, status')
        .eq('id', numericModelId)
        .single();

      if (anyModel) {
        logger.logWarning('MODEL_BELONGS_TO_DIFFERENT_USER', 'Model exists but belongs to different user', {
          modelId: numericModelId,
          requestedUserId: userId,
          actualUserId: anyModel.user_id,
          modelName: anyModel.name
        });
      }

      return NextResponse.json({
        error: 'Model not found or access denied',
        details: modelError?.message || 'Model not found',
        debug: {
          modelId: numericModelId,
          originalModelId: modelId,
          userId,
          modelExists: !!anyModel,
          actualOwner: anyModel?.user_id
        }
      }, { status: 404 });
    }

    logger.logInfo('MODEL_FOUND', {
      modelId: customerModel.id,
      modelName: customerModel.name,
      modelStatus: customerModel.status,
      modelType: customerModel.type
    });

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
    const finalPrompt = `${packStyle}, ${prompt}, professional photography studio lighting, high resolution, sharp focus, detailed facial features, commercial quality headshot, realistic skin texture, natural lighting, photorealistic, clean shaven, bald head`;

    logger.logInfo('USING_RUNPOD_GENERATION', {
      modelId: customerModel.modelId,
      finalPrompt
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

    // Use ComfyUI workflow for FLUX generation
    const workflow = createSimpleFluxWorkflow(
      finalPrompt,
      1024, // width
      1024, // height
      28,   // steps
      5.0,  // guidance
      -1    // seed (random)
    );

    const runpodPayload = {
      input: {
        workflow: workflow
      }
    };

    // Send request to RunPod inference endpoint (fallback to training endpoint if needed)
    const runpodEndpoint = inferenceEndpoint || process.env.RUNPOD_TRAINING_ENDPOINT;

    if (!runpodEndpoint || !process.env.RUNPOD_API_KEY) {
      logger.logError('RUNPOD_CONFIG_MISSING', 'RunPod endpoint or API key not configured');
      return NextResponse.json({
        error: 'RunPod generation service not configured'
      }, { status: 500 });
    }

    logger.logInfo('SENDING_RUNPOD_REQUEST', {
      endpoint: runpodEndpoint,
      workflowKeys: Object.keys(workflow)
    });

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
        runpod_job_id: generationResult.id
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

    // Enhanced error response for debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({
      error: 'Generation request failed',
      details: errorDetails.message,
      debugSteps: debugSteps || ['Error occurred before debug steps were initialized'],
      debug: {
        errorName: errorDetails.name,
        errorMessage: errorDetails.message,
        timestamp: errorDetails.timestamp,
        stack: errorDetails.stack,
        nodeEnv: process.env.NODE_ENV,
        lastStep: debugSteps ? debugSteps[debugSteps.length - 1] : 'Unknown'
      }
    }, { status: 500 });
  }
}