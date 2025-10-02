import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateImage } from '@/lib/replicate';
import { Logger, extractErrorDetails } from '@/lib/logger';

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

    // Build the enhanced prompt with style injection
    const baseStyleTrigger = styleModel ? 'sksdan-' : ''; // Your style trigger word
    const customerTrigger = `sks${customerModel.name?.substring(0, 6) || 'user'}`;
    
    // Pack-specific style modifiers
    const packStyles = {
      'actor-headshots': 'professional actor headshot, dramatic lighting, cinematic, high detail',
      'corporate-headshots': 'professional corporate headshot, clean background, business attire, professional lighting',
      'creative-headshots': 'creative professional headshot, artistic lighting, modern style'
    };

    const packStyle = packStyles[packSlug as keyof typeof packStyles] || packStyles['corporate-headshots'];
    
    // Combine all elements: customer face + photographer style + pack style
    const enhancedPrompt = styleModel 
      ? `${packStyle} of ${customerTrigger}, ${baseStyleTrigger} style, ${prompt}`
      : `${packStyle} of ${customerTrigger}, ${prompt}`;

    logger.logInfo('PROMPT_ENHANCED', {
      originalPrompt: prompt,
      enhancedPrompt,
      customerTrigger,
      styleModelFound: !!styleModel,
      packStyle
    });

    // Generate images using the customer's model with style injection
    const modelVersion = customerModel.modelId; // This should be the Replicate model version
    
    if (!modelVersion) {
      return NextResponse.json({ 
        error: 'Model version not found. Model may not be fully trained.' 
      }, { status: 400 });
    }

    const generationResult = await generateImage(
      modelVersion,
      enhancedPrompt,
      "blurry, low quality, distorted, bad anatomy", // negative prompt
      numOutputs
    );

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
      enhancedPrompt,
      message: styleModel 
        ? 'Generating headshots with your photographer\'s signature style'
        : 'Generating headshots with default style',
      estimatedTime: '2-3 minutes'
    });

  } catch (error) {
    logger.logError('GENERATION_REQUEST_ERROR', error);
    
    return NextResponse.json({
      error: 'Generation request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}