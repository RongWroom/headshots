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

    // Use the correct trigger word for dandan-actor model
    const triggerWord = 'ACTOR';
    
    // Build detailed prompt based on your successful manual prompt
    const basePrompt = `A professional headshot portrait of an ${triggerWord} in dandan style. The subject is centered with a dead pan expression, wearing a simple outfit, body angled 45 degrees away from camera. The background is softly blurred with muted tones (brown, gray, green, or blue), creating a cinematic and sophisticated atmosphere. The lighting is soft and directional, highlighting the subject's facial features, detailed hair, relaxed portrait photography capturing photorealistic skin textures, sharp eyes, natural hair color, and subtle shadows. The overall mood is serious and contemplative, emphasizing the subject's presence and character. High-quality photography, cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8`;
    
    // Pack-specific variations
    const packVariations = {
      'actor-headshots': basePrompt,
      'corporate-headshots': basePrompt.replace('dead pan expression', 'professional confident expression').replace('simple outfit', 'business attire'),
      'creative-headshots': basePrompt.replace('dead pan expression', 'artistic expression').replace('simple outfit', 'creative styling')
    };
    
    const finalPrompt = packVariations[packSlug as keyof typeof packVariations] || packVariations['actor-headshots'];

    logger.logInfo('REPLICATE_GENERATION_START', {
      modelName: customerModel.name,
      triggerWord,
      finalPrompt
    });

    // Use the dandan-actor model specifically
    const replicateModel = process.env.REPLICATE_STYLE_LORA_MODEL_ID || 'rongwroom/dandan-actor:11162aefee0b704c352db825e03883e73c6ee053edc8f85af81d7da62d4aa27b';
    
    logger.logInfo('USING_DANDAN_ACTOR_MODEL', {
      model: replicateModel,
      triggerWord,
      promptLength: finalPrompt.length
    });

    const replicatePayload = {
      version: replicateModel.split(':')[1],
      input: {
        prompt: finalPrompt,
        negative_prompt: "blurry, low quality, distorted, bad anatomy, deformed, disfigured, multiple people, crowd, cartoon, anime, painting, drawing, illustration, digital art",
        width: 1024,
        height: 1024,
        num_outputs: numOutputs,
        guidance_scale: 8.0,  // Slightly higher for better adherence to prompt
        num_inference_steps: 30,  // More steps for better quality
        scheduler: "DPMSolverMultistep",
        seed: Math.floor(Math.random() * 1000000)  // Random seed for variety
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