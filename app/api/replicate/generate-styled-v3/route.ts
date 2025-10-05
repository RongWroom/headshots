import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Single-step Seedream with DanDan style keywords
 * Uses multiple reference images + detailed style prompt
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
    const { modelId, prompt, packSlug, numOutputs = 4, referenceImages } = requestBody;

    if (!modelId || !prompt || !referenceImages || referenceImages.length === 0) {
      return NextResponse.json({
        error: 'Missing required fields'
      }, { status: 400 });
    }

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

    // Detailed DanDan style prompt with all the photography keywords
    const seedreamPrompt = `A professional headshot portrait in dandan photography style. The subject has a ${selectedPose}, looking directly at the camera, making eye contact with the viewer, centered composition, wearing a simple outfit, body angled 45 degrees away from camera but face turned toward camera. The background is softly blurred with muted tones (brown, gray, green, or blue), creating a cinematic and sophisticated atmosphere. The lighting is soft and directional, highlighting the subject's facial features with subtle shadows. Relaxed portrait photography capturing photorealistic skin textures, sharp eyes looking at camera, natural hair color. The overall mood is serious and contemplative, emphasizing the subject's presence and character. High-quality photography, cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8, professional studio lighting, muted color palette, film grain texture`;

    console.log('Generating with Seedream + DanDan style keywords...');
    
    const seedreamResponse = await fetch('https://api.replicate.com/v1/models/bytedance/seedream-4/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt: seedreamPrompt,
          image_input: referenceImages, // All your reference photos
          size: "2K",
          width: 1728,
          height: 2304,
          aspect_ratio: "3:4",
          max_images: numOutputs,
          sequential_image_generation: "disabled",
          prompt_strength: 0.9 // Very high - force the style
        }
      })
    });

    if (!seedreamResponse.ok) {
      const errorData = await seedreamResponse.json().catch(() => ({}));
      return NextResponse.json({
        error: 'Seedream generation failed',
        details: errorData
      }, { status: 500 });
    }

    const seedreamResult = await seedreamResponse.json();
    console.log('Seedream generation started:', seedreamResult.id);

    // Poll until complete
    let finalImages = null;
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusResponse = await fetch(seedreamResult.urls.get, {
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        }
      });

      const status = await statusResponse.json();

      if (status.status === 'succeeded') {
        finalImages = status.output;
        console.log('Seedream completed:', finalImages.length, 'images');
        break;
      } else if (status.status === 'failed') {
        return NextResponse.json({
          error: 'Seedream generation failed',
          details: status.error
        }, { status: 500 });
      }

      attempts++;
    }

    if (!finalImages) {
      return NextResponse.json({
        error: 'Seedream generation timed out'
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
        reference_images: referenceImages,
        num_outputs: numOutputs,
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      jobId: generationJob?.id,
      images: finalImages,
      message: 'Generated professional headshots with Seedream + DanDan style',
      approach: 'Single-step Seedream with detailed style keywords',
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
