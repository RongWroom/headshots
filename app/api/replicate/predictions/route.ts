import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = "force-dynamic";

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request
    const { modelId, prompt, packSlug, numOutputs = 4 } = await req.json();
    if (!modelId || !prompt) {
      return NextResponse.json({
        error: 'Missing required fields: modelId and prompt'
      }, { status: 400 });
    }

    // Get the customer's trained model (for trigger word)
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

    // Use user's face model (daniel-spencer) as base
    const faceModel = 'rongwroom/daniel-spencer:9a871ed08348f254bb5597dd94d73916c67f183cdef1c275b2686af607bbb363';
    
    // Build prompt with correct trigger words
    const faceTrigger = 'sksdani'; // User's face
    const styleTrigger = 'ACTOR'; // Photography style
    
    const finalPrompt = `A professional headshot portrait of ${faceTrigger}, a male ${styleTrigger}. The subject is a man centered with a professional expression, wearing a simple outfit, body angled 45 degrees away from camera, The background is softly blurred with muted tones, creating a cinematic and sophisticated atmosphere, The lighting is soft and directional, highlighting the subject's facial features, detailed hair, relaxed portrait photography capturing photorealistic skin textures, sharp eyes, natural hair color, and subtle shadows, The overall mood is serious and contemplative, emphasizing the subject's presence and character, High-quality photography, cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8`;

    // Use Replicate with all your working settings
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: faceModel.split(':')[1],
        input: {
          prompt: finalPrompt,
          aspect_ratio: "custom",
          width: 540,
          height: 720,
          num_outputs: numOutputs,
          guidance_scale: 1.5,
          num_inference_steps: 30,
          output_format: "jpg",
          output_quality: 100,
          go_fast: false,
          megapixels: "1",
          model: "dev",
          lora_scale: 1,
          // Add your photography style as extra LoRA
          extra_lora: "https://replicate.delivery/xezq/6PAYweu7FiWbUaLfpGX3Y0vPIex3Kr6SN2uMccFTe7Lem1fJF/trained_model.tar",
          extra_lora_scale: 1
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json({
        error: 'Generation request failed',
        details: errorData.detail || `HTTP ${response.status}`
      }, { status: 500 });
    }

    const result = await response.json();

    // Store generation job in database
    await supabase
      .from('generation_jobs')
      .insert({
        user_id: user.id,
        status: 'processing',
        style: packSlug || 'actor-headshots',
        poses: [prompt],
        replicate_prediction_id: result.id
      });

    return NextResponse.json({
      success: true,
      id: result.id,
      status: result.status,
      urls: result.urls,
      message: 'Generating professional headshots with DanDan style',
      estimatedTime: '1-2 minutes'
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Generation request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}