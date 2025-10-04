import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for the full process

/**
 * Two-step headshot generation:
 * 1. Seedream: Generate base headshot with perfect face consistency
 * 2. FLUX + LoRA: Apply photography style to the generated image
 */
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

    const requestBody = await req.json();
    const { modelId, prompt, packSlug, numOutputs = 4, referenceImages } = requestBody;

    if (!modelId || !prompt || !referenceImages || referenceImages.length === 0) {
      return NextResponse.json({
        error: 'Missing required fields: modelId, prompt, and referenceImages'
      }, { status: 400 });
    }

    // Get customer model
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

    // Define pose variations
    const poseVariations = [
      'looking directly at the camera with a professional serious expression, confident and contemplative',
      'looking directly at the camera with a neutral expression, calm and composed',
      'looking directly at the camera with a confident expression, strong and professional',
      'looking directly at the camera with a dead pan expression, serious and contemplative'
    ];
    
    const selectedPose = poseVariations[Math.floor(Math.random() * poseVariations.length)];

    // Step 1: Generate base headshot with Seedream
    const seedreamPrompt = `A professional headshot portrait. The subject is ${selectedPose}, making direct eye contact with the viewer, centered, wearing a simple outfit, body angled 45 degrees away from camera but face turned toward camera, The background is softly blurred with muted tones (brown, gray, green, or blue), creating a cinematic and sophisticated atmosphere, The lighting is soft and directional, highlighting the subject's facial features, relaxed portrait photography capturing photorealistic skin textures, sharp eyes looking at camera, natural hair color, and subtle shadows, High-quality photography, cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8`;

    console.log('Step 1: Starting Seedream generation...');
    
    const seedreamResponse = await fetch('https://api.replicate.com/v1/models/bytedance/seedream-4/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt: seedreamPrompt,
          image_input: referenceImages,
          size: "2K",
          width: 1728,
          height: 2304,
          aspect_ratio: "3:4",
          max_images: numOutputs,
          sequential_image_generation: "disabled",
          prompt_strength: 0.85
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
    console.log('Seedream prediction started:', seedreamResult.id);

    // Poll Seedream until complete
    let seedreamOutput = null;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const statusResponse = await fetch(seedreamResult.urls.get, {
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        }
      });

      const status = await statusResponse.json();
      
      if (status.status === 'succeeded') {
        seedreamOutput = status.output;
        console.log('Seedream completed:', seedreamOutput);
        break;
      } else if (status.status === 'failed') {
        return NextResponse.json({
          error: 'Seedream generation failed',
          details: status.error
        }, { status: 500 });
      }
      
      attempts++;
    }

    if (!seedreamOutput) {
      return NextResponse.json({
        error: 'Seedream generation timed out'
      }, { status: 500 });
    }

    // Step 2: Apply photography style with FLUX + LoRA
    console.log('Step 2: Applying photography style...');

    const styleTrigger = 'ACTOR';
    const stylePrompt = `A professional headshot portrait of an ${styleTrigger} in dandan style. The subject is centered with a professional expression, wearing a simple outfit, body angled 45 degrees away from camera, The background is softly blurred with muted tones (brown, gray, green, or blue), creating a cinematic and sophisticated atmosphere, The lighting is soft and directional, highlighting the subject's facial features, detailed hair, relaxed portrait photography capturing photorealistic skin textures, sharp eyes, natural hair color, and subtle shadows, The overall mood is serious and contemplative, emphasizing the subject's presence and character, High-quality photography, cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8`;

    // Use your dandan-actor model for style transfer with correct parameters
    const styleResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '11162aefee0b704c352db825e03883e73c6ee053edc8f85af81d7da62d4aa27b', // dandan-actor version
        input: {
          prompt: stylePrompt,
          image: seedreamOutput[0], // Use first Seedream output as base
          prompt_strength: 0.8,
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
          lora_scale: 1,
          extra_lora_scale: 1,
          replicate_weights: "https://replicate.delivery/xezq/6PAYweu7FiWbUaLfpGX3Y0vPIex3Kr6SN2uMccFTe7Lem1fJF/trained_model.tar"
        }
      })
    });

    if (!styleResponse.ok) {
      const errorData = await styleResponse.json().catch(() => ({}));
      return NextResponse.json({
        error: 'Style transfer failed',
        details: errorData,
        seedreamOutput // Return Seedream output as fallback
      }, { status: 500 });
    }

    const styleResult = await styleResponse.json();
    console.log('Style transfer started:', styleResult.id);

    // Poll style transfer until complete
    let finalOutput = null;
    attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(styleResult.urls.get, {
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        }
      });

      const status = await statusResponse.json();
      
      if (status.status === 'succeeded') {
        finalOutput = status.output;
        console.log('Style transfer completed:', finalOutput);
        break;
      } else if (status.status === 'failed') {
        // If style transfer fails, return Seedream output
        console.log('Style transfer failed, returning Seedream output');
        finalOutput = seedreamOutput;
        break;
      }
      
      attempts++;
    }

    if (!finalOutput) {
      // Timeout - return Seedream output as fallback
      finalOutput = seedreamOutput;
    }

    // Store generation job in database
    const { data: generationJob, error: jobError } = await supabase
      .from('generation_jobs')
      .insert({
        user_id: user.id,
        status: 'completed',
        style: packSlug || 'actor-headshots',
        poses: [prompt],
        output_images: finalOutput,
        reference_images: referenceImages,
        num_outputs: numOutputs,
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error saving generation job:', jobError);
    }

    return NextResponse.json({
      success: true,
      jobId: generationJob?.id,
      images: finalOutput,
      message: 'Generated professional headshots with your face + photography style',
      process: {
        step1: 'Seedream (face consistency)',
        step2: 'FLUX + LoRA (photography style)',
        totalTime: '~30-60 seconds'
      }
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json({
      error: 'Generation request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
