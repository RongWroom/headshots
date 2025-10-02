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
    logger.logInfo('USING_RUNPOD_GENERATION', {
      modelId: customerModel.modelId,
      enhancedPrompt
    });

    // Forward to RunPod generation endpoint
    const runpodGenerationResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/runpod/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') || ''
      },
      body: JSON.stringify({
        modelId,
        prompt,
        packSlug,
        numOutputs
      })
    });

    if (!runpodGenerationResponse.ok) {
      const errorData = await runpodGenerationResponse.json().catch(() => ({}));
      logger.logError('RUNPOD_GENERATION_FAILED', errorData.error || 'Generation failed');

      return NextResponse.json({
        error: errorData.error || 'Generation failed',
        details: errorData.details
      }, { status: runpodGenerationResponse.status });
    }

    const generationResult = await runpodGenerationResponse.json();

    logger.logSuccess('GENERATION_COMPLETED', {
      generationId: generationResult.generationId,
      status: generationResult.status
    });

    // Return the result from RunPod generation
    return NextResponse.json(generationResult);

  } catch (error) {
    logger.logError('GENERATION_REQUEST_ERROR', error);

    return NextResponse.json({
      error: 'Generation request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}