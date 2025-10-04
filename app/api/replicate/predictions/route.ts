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
    const requestBody = await req.json();
    const { modelId, prompt, packSlug, numOutputs = 4, referenceImages } = requestBody;

    if (!modelId || !prompt) {
      return NextResponse.json({
        error: 'Missing required fields: modelId and prompt'
      }, { status: 400 });
    }

    // Validate reference images (Seedream supports up to 10)
    if (!referenceImages || !Array.isArray(referenceImages) || referenceImages.length === 0) {
      return NextResponse.json({
        error: 'At least one reference image is required',
        hint: 'Pass referenceImages as an array of image URLs'
      }, { status: 400 });
    }

    if (referenceImages.length > 10) {
      return NextResponse.json({
        error: 'Maximum 10 reference images allowed',
        received: referenceImages.length
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

    // Use Seedream 4.0 for superior face consistency with multiple reference images
    const userFaceImages = referenceImages;

    // Build prompt with photography style trigger
    const styleTrigger = 'ACTOR'; // Photography style

    // Define pose variations for variety (no smiling - keeps it professional)
    const poseVariations = [
      'looking directly at the camera with a professional serious expression, confident and contemplative',
      'looking directly at the camera with a neutral expression, calm and composed',
      'looking directly at the camera with a confident expression, strong and professional',
      'looking directly at the camera with a dead pan expression, serious and contemplative'
    ];

    // Randomly select a pose variation for variety
    const selectedPose = poseVariations[Math.floor(Math.random() * poseVariations.length)];

    const finalPrompt = `A professional headshot portrait of a ${styleTrigger}. The subject is ${selectedPose}, making direct eye contact with the viewer, centered, wearing a simple outfit, body angled 45 degrees away from camera but face turned toward camera, The background is softly blurred with muted tones, creating a cinematic and sophisticated atmosphere, The lighting is soft and directional, highlighting the subject's facial features, direct gaze at camera, relaxed portrait photography capturing photorealistic skin textures, sharp eyes looking at camera, natural hair color, and subtle shadows, High-quality photography, cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8`;

    // Use Seedream 4.0 via Replicate API with your exact working settings
    const response = await fetch('https://api.replicate.com/v1/models/bytedance/seedream-4/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt: finalPrompt,
          image_input: userFaceImages, // Multiple face images for better consistency
          size: "2K",
          width: 1728,
          height: 2304,
          aspect_ratio: "3:4",
          max_images: numOutputs,
          sequential_image_generation: "disabled",
          prompt_strength: 0.85 // Higher = more prompt influence, less image copying (0.5-1.0)
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

    // Store generation job in database with reference images
    const { data: generationJob, error: jobError } = await supabase
      .from('generation_jobs')
      .insert({
        user_id: user.id,
        status: 'processing',
        style: packSlug || 'actor-headshots',
        poses: [prompt],
        replicate_prediction_id: result.id,
        reference_images: userFaceImages, // Store which images were used
        num_outputs: numOutputs
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error saving generation job:', jobError);
    }

    return NextResponse.json({
      success: true,
      id: result.id,
      jobId: generationJob?.id,
      status: result.status,
      urls: result.urls,
      message: `Generating ${numOutputs} professional headshots with Seedream + DanDan style`,
      estimatedTime: '15-30 seconds',
      referenceImagesUsed: userFaceImages.length
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Generation request failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}