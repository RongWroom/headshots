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

    // Use RunPod for generation with the customer's trained model
    const triggerWord = `sks${customerModel.name?.substring(0, 6) || 'user'}`;
    const finalPrompt = `${packStyle} of ${triggerWord}, ${prompt}, professional photography, high quality, detailed`;

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

    // Get the actual model URL from RunPod training results
    const modelUrlResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/runpod/model-url?modelId=${modelId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`
      }
    });

    if (!modelUrlResponse.ok) {
      const errorData = await modelUrlResponse.json().catch(() => ({}));
      return NextResponse.json({
        error: 'Model not ready for generation',
        details: errorData.error || 'Could not retrieve model URL',
        message: 'Please wait for training to complete or try again later'
      }, { status: 503 });
    }

    const modelData = await modelUrlResponse.json();

    // Prepare FLUX kontext inference request
    const runpodPayload = {
      input: {
        prompt: finalPrompt,
        lora_url: modelData.modelUrl, // Your trained LoRA model
        lora_scale: 0.8, // LoRA strength (0.6-1.0 for good face likeness)
        width: 1024,
        height: 1024,
        num_outputs: numOutputs,
        guidance_scale: 3.5, // FLUX works better with lower guidance
        num_inference_steps: 28, // Good balance of quality/speed
        seed: -1, // Random seed
        output_format: "webp",
        output_quality: 90
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
      message: 'Generating personalized headshots with your trained model',
      estimatedTime: '1-2 minutes',
      triggerWord
    });

  } catch (error) {
    logger.logError('GENERATION_REQUEST_ERROR', error);

    return NextResponse.json({
      error: 'Generation request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}