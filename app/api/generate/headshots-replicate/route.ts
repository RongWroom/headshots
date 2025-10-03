import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Logger } from '@/lib/logger';

export const dynamic = "force-dynamic";

const logger = new Logger('GENERATE_HEADSHOTS_REPLICATE');

export async function POST(req: Request) {
  try {
    logger.logInfo('API_REQUEST_START', 'Starting Replicate headshots generation');

    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'Replicate API not configured' }, { status: 500 });
    }

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request
    const { modelId, prompt, packSlug, numOutputs = 4 } = await req.json();
    if (!modelId || !prompt) {
      return NextResponse.json({
        error: 'Missing required fields: modelId and prompt'
      }, { status: 400 });
    }

    // Get the customer's trained model
    const { data: customerModel, error: modelError } = await supabase
      .from('models')
      .select('*')
      .eq('id', modelId)
      .eq('user_id', user.id)
      .single();

    if (modelError || !customerModel) {
      return NextResponse.json({
        error: 'Model not found or access denied'
      }, { status: 404 });
    }

    // Pack-specific style modifiers
    const packStyles = {
      'actor-headshots': 'professional actor headshot, dramatic lighting, cinematic, high detail',
      'corporate-headshots': 'professional corporate headshot, clean background, business attire, professional lighting',
      'creative-headshots': 'creative professional headshot, artistic lighting, modern style'
    };

    const packStyle = packStyles[packSlug as keyof typeof packStyles] || packStyles['corporate-headshots'];
    
    // Build prompt with trigger word
    const triggerWord = customerModel.name ? `sks${customerModel.name.substring(0, 6)}` : 'sks';
    const finalPrompt = `${packStyle} of ${triggerWord}, ${prompt}, professional photography, high quality, detailed`;

    logger.logInfo('REPLICATE_GENERATION_START', {
      modelName: customerModel.name,
      triggerWord,
      finalPrompt
    });

    // Use the configured Replicate model
    const replicateModel = process.env.REPLICATE_STYLE_LORA_MODEL_ID || 'rongwroom/dandan-actor:11162aefee0b704c352db825e03883e73c6ee053edc8f85af81d7da62d4aa27b';

    const replicatePayload = {
      version: replicateModel.split(':')[1],
      input: {
        prompt: finalPrompt,
        negative_prompt: "blurry, low quality, distorted, bad anatomy, deformed, disfigured, multiple people, crowd",
        width: 1024,
        height: 1024,
        num_outputs: numOutputs,
        guidance_scale: 7.5,
        num_inference_steps: 25,
        scheduler: "DPMSolverMultistep"
      }
    };

    // Send request to Replicate
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(replicatePayload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.logError('REPLICATE_GENERATION_FAILED', `HTTP ${response.status}`, {
        error: errorData,
        status: response.status
      });

      return NextResponse.json({
        error: 'Generation request failed',
        details: errorData.detail || `HTTP ${response.status}`
      }, { status: 500 });
    }

    const generationResult = await response.json();

    logger.logSuccess('REPLICATE_GENERATION_STARTED', {
      predictionId: generationResult.id,
      status: generationResult.status
    });

    // Store generation job in database
    const { data: generationJob, error: jobError } = await supabase
      .from('generation_jobs')
      .insert({
        user_id: user.id,
        status: 'processing',
        style: packSlug || 'corporate-headshots',
        poses: [prompt],
        replicate_prediction_id: generationResult.id,
        model_id: modelId
      })
      .select()
      .single();

    if (jobError) {
      logger.logWarning('GENERATION_JOB_SAVE_FAILED', jobError.message);
    }

    return NextResponse.json({
      success: true,
      predictionId: generationResult.id,
      status: generationResult.status,
      jobId: generationJob?.id,
      finalPrompt,
      triggerWord,
      message: 'Generating personalized headshots with Replicate',
      estimatedTime: '1-2 minutes',
      urls: generationResult.urls
    });

  } catch (error) {
    logger.logError('GENERATION_REQUEST_ERROR', error);
    return NextResponse.json({
      error: 'Generation request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}