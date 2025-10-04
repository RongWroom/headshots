import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Logger, extractErrorDetails } from '@/lib/logger';

export const dynamic = "force-dynamic";

const logger = new Logger('RUNPOD_GENERATE_API');

export async function POST(req: Request) {
  try {
    // Create Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.headers.get('cookie')?.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1];
          },
          set() {},
          remove() {},
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

    logger.logInfo('RUNPOD_GENERATION_REQUEST_START', {
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

    if (customerModel.status !== 'finished') {
      return NextResponse.json({ 
        error: 'Model is not ready for generation. Please wait for training to complete.' 
      }, { status: 400 });
    }

    // Pack-specific style modifiers
    const packStyles = {
      'actor-headshots': 'professional actor headshot, dramatic lighting, cinematic, high detail',
      'corporate-headshots': 'professional corporate headshot, clean background, business attire, professional lighting',
      'creative-headshots': 'creative professional headshot, artistic lighting, modern style'
    };

    const packStyle = packStyles[packSlug as keyof typeof packStyles] || packStyles['corporate-headshots'];
    
    // Build the prompt with the customer's trigger word
    const triggerWord = `sks${customerModel.name?.substring(0, 6) || 'user'}`;
    const enhancedPrompt = `${packStyle} of ${triggerWord}, ${prompt}, professional photography, high quality, detailed`;

    logger.logInfo('PROMPT_ENHANCED', {
      originalPrompt: prompt,
      enhancedPrompt,
      triggerWord,
      packStyle
    });

    // Prepare RunPod FLUX generation request
    const runpodPayload = {
      input: {
        prompt: enhancedPrompt,
        negative_prompt: "blurry, low quality, distorted, bad anatomy, deformed, disfigured",
        width: 1024,
        height: 1024,
        num_outputs: numOutputs,
        guidance_scale: 7.5,
        num_inference_steps: 25,
        seed: Math.floor(Math.random() * 1000000),
        // For LoRA support (your trained model)
        lora_url: `https://your-model-storage/${customerModel.modelId}.safetensors`, // We'll need to figure out where your model is stored
        lora_scale: 0.8
      }
    };

    logger.logInfo('RUNPOD_GENERATION_REQUEST_PREPARED', {
      modelId: customerModel.modelId,
      prompt: enhancedPrompt,
      numOutputs
    });

    // Send request to RunPod inference endpoint (separate from training)
    const runpodEndpoint = process.env.RUNPOD_INFERENCE_ENDPOINT;
    
    if (!runpodEndpoint || !process.env.RUNPOD_API_KEY) {
      return NextResponse.json({ 
        error: 'RunPod inference endpoint not configured',
        message: 'Please set up RUNPOD_INFERENCE_ENDPOINT environment variable'
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

    logger.logSuccess('RUNPOD_GENERATION_STARTED', {
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
      enhancedPrompt,
      message: 'Generating personalized headshots with your trained model',
      estimatedTime: '1-2 minutes',
      triggerWord
    });

  } catch (error) {
    logger.logError('RUNPOD_GENERATION_REQUEST_ERROR', error);
    
    return NextResponse.json({
      error: 'Generation request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}