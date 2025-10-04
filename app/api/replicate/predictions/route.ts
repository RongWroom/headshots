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

    // Use the DanDan actor style with ACTOR trigger word
    const triggerWord = 'ACTOR';
    const finalPrompt = `A professional headshot portrait of an ${triggerWord} in dandan style. The subject is centered with a professional expression, wearing business attire, body angled 45 degrees away from camera. The background is softly blurred with muted tones (brown, gray, green, or blue), creating a cinematic and sophisticated atmosphere. The lighting is soft and directional, highlighting the subject's facial features, detailed hair, relaxed portrait photography capturing photorealistic skin textures, sharp eyes, natural hair color, and subtle shadows. The overall mood is serious and contemplative, emphasizing the subject's presence and character. High-quality photography, cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8. ${prompt}`;

    // Use Replicate API
    const replicateModel = process.env.REPLICATE_STYLE_LORA_MODEL_ID || 'rongwroom/dandan-actor:11162aefee0b704c352db825e03883e73c6ee053edc8f85af81d7da62d4aa27b';

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: replicateModel.split(':')[1],
        input: {
          prompt: finalPrompt,
          negative_prompt: "blurry, low quality, distorted, bad anatomy, deformed, disfigured, multiple people, crowd, cartoon, anime, painting, drawing, illustration, digital art",
          width: 1024,
          height: 1024,
          num_outputs: numOutputs,
          guidance_scale: 8.0,
          num_inference_steps: 30,
          scheduler: "DPMSolverMultistep"
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