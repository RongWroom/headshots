import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Dual LoRA generation:
 * - DanDan-Actor LoRA (photography style)
 * - Face LoRA (your facial features)
 */
export async function POST(req: Request) {
  try {
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

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestBody = await req.json();
    const { modelId, prompt, packSlug, numOutputs = 4 } = requestBody;

    if (!modelId || !prompt) {
      return NextResponse.json({
        error: 'Missing required fields'
      }, { status: 400 });
    }

    // Your trained face LoRA
    const faceLoraUrl = 'https://replicate.delivery/xezq/YCyZm0lH767AH9iOfL5XrbfRbjV3lAYcdmyzSWMk7kybIempA/flux-lora.tar';

    const { data: customerModel } = await supabase
      .from('models')
      .select('*')
      .eq('id', modelId)
      .eq('user_id', user.id)
      .single();

    if (!customerModel) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    // Pose variations
    const poseVariations = [
      'professional serious expression, confident and contemplative',
      'neutral expression, calm and composed',
      'confident expression, strong and professional',
      'dead pan expression, serious and contemplative'
    ];
    
    const selectedPose = poseVariations[Math.floor(Math.random() * poseVariations.length)];

    // Prompt with BOTH trigger words
    const styleTrigger = 'ACTOR'; // DanDan style trigger
    const faceTrigger = 'sksdani'; // Your face trigger from trained LoRA
    
    const dualLoraPrompt = `A professional headshot portrait of ${faceTrigger} as an ${styleTrigger} in dandan style. The subject is centered with a ${selectedPose}, looking directly at the camera, making eye contact with the viewer, wearing a simple outfit, body angled 45 degrees away from camera but face turned toward camera. The background is softly blurred with muted tones (brown, gray, green, or blue), creating a cinematic and sophisticated atmosphere. The lighting is soft and directional, highlighting the subject's facial features, relaxed portrait photography capturing photorealistic skin textures, sharp eyes looking at camera, natural hair color, and subtle shadows. The overall mood is serious and contemplative, emphasizing the subject's presence and character. High-quality photography, cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8`;

    console.log('Generating with dual LoRAs (style + face)...');
    
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '11162aefee0b704c352db825e03883e73c6ee053edc8f85af81d7da62d4aa27b', // FLUX dev
        input: {
          prompt: dualLoraPrompt,
          aspect_ratio: "custom",
          width: 540,
          height: 720,
          guidance_scale: 1.5,
          num_inference_steps: 30,
          num_outputs: numOutputs,
          output_format: "jpg",
          output_quality: 100,
          go_fast: false,
          megapixels: "1",
          model: "dev",
          lora_scale: 1, // DanDan style LoRA strength
          extra_lora: faceLoraUrl, // Your face LoRA
          extra_lora_scale: 1, // Face LoRA strength
          replicate_weights: "https://replicate.delivery/xezq/6PAYweu7FiWbUaLfpGX3Y0vPIex3Kr6SN2uMccFTe7Lem1fJF/trained_model.tar" // DanDan LoRA
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json({
        error: 'Generation failed',
        details: errorData
      }, { status: 500 });
    }

    const result = await response.json();
    console.log('Dual LoRA generation started:', result.id);

    // Poll until complete
    let finalImages = null;
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusResponse = await fetch(result.urls.get, {
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        }
      });

      const status = await statusResponse.json();

      if (status.status === 'succeeded') {
        finalImages = status.output;
        console.log('Generation completed:', finalImages.length, 'images');
        break;
      } else if (status.status === 'failed') {
        return NextResponse.json({
          error: 'Generation failed',
          details: status.error
        }, { status: 500 });
      }

      attempts++;
    }

    if (!finalImages) {
      return NextResponse.json({
        error: 'Generation timed out'
      }, { status: 500 });
    }

    // Store in database
    const { data: generationJob } = await supabase
      .from('generation_jobs')
      .insert({
        user_id: user.id,
        status: 'completed',
        style: packSlug || 'actor-headshots',
        poses: [prompt],
        output_images: finalImages,
        num_outputs: numOutputs,
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      jobId: generationJob?.id,
      images: finalImages,
      message: 'Generated with your photography style + your face',
      approach: 'Dual LoRA (DanDan style + Face)',
      estimatedTime: '15-30 seconds'
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json({
      error: 'Generation request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
