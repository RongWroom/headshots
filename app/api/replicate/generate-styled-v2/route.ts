import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Reversed two-step generation:
 * 1. DanDan-Actor: Generate professional headshot in your photography style
 * 2. Face Swap: Replace face with user's face while keeping style
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

    // Step 1: Apply photography style using img2img (preserves gender/ethnicity)
    console.log('Step 1: Applying DanDan photography style via img2img...');

    const styleTrigger = 'ACTOR';
    const stylePrompt = `A professional headshot portrait of an ${styleTrigger} in dandan style. The subject is centered with a ${selectedPose}, looking directly at the camera, making eye contact with the viewer, wearing a simple outfit, body angled 45 degrees away from camera but face turned toward camera, The background is softly blurred with muted tones (brown, gray, green, or blue), creating a cinematic and sophisticated atmosphere, The lighting is soft and directional, highlighting the subject's facial features, relaxed portrait photography capturing photorealistic skin textures, sharp eyes looking at camera, natural hair color, and subtle shadows, The overall mood is serious and contemplative, emphasizing the subject's presence and character, High-quality photography, cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8`;

    const styleResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '11162aefee0b704c352db825e03883e73c6ee053edc8f85af81d7da62d4aa27b',
        input: {
          image: referenceImages[0], // Start from user's reference photo (preserves gender/ethnicity)
          prompt: stylePrompt,
          prompt_strength: 0.8, // Higher = more transformation, less original pose
          aspect_ratio: "custom",
          width: 540,
          height: 720,
          guidance_scale: 1.5,
          num_inference_steps: 30,
          num_outputs: numOutputs, // Generate multiple variations
          output_format: "jpg",
          output_quality: 100,
          go_fast: false,
          megapixels: "1",
          model: "dev",
          lora_scale: 1,
          replicate_weights: "https://replicate.delivery/xezq/6PAYweu7FiWbUaLfpGX3Y0vPIex3Kr6SN2uMccFTe7Lem1fJF/trained_model.tar"
        }
      })
    });

    if (!styleResponse.ok) {
      const errorData = await styleResponse.json().catch(() => ({}));
      return NextResponse.json({
        error: 'Style generation failed',
        details: errorData
      }, { status: 500 });
    }

    const styleResult = await styleResponse.json();
    console.log('Style generation started:', styleResult.id);

    // Poll until style generation completes
    let styledImage = null;
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusResponse = await fetch(styleResult.urls.get, {
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        }
      });

      const status = await statusResponse.json();

      if (status.status === 'succeeded') {
        styledImage = status.output; // Array of images
        console.log('Style generation completed:', styledImage.length, 'images');
        break;
      } else if (status.status === 'failed') {
        return NextResponse.json({
          error: 'Style generation failed',
          details: status.error
        }, { status: 500 });
      }

      attempts++;
    }

    if (!styledImage) {
      return NextResponse.json({
        error: 'Style generation timed out'
      }, { status: 500 });
    }

    // Step 2: Use Seedream to merge styled headshot with your face
    console.log('Step 2: Merging styled headshots with your face using Seedream...');

    const finalImages = [];

    // Process each styled image
    for (let i = 0; i < styledImage.length; i++) {
      const currentImage = styledImage[i];
      console.log(`Processing image ${i + 1}/${styledImage.length}`);

      try {
        // Use Seedream with both the styled image AND your reference photo
        const seedreamMergeResponse = await fetch('https://api.replicate.com/v1/models/bytedance/seedream-4/predictions', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: {
              prompt: `A professional headshot portrait in dandan style. The subject is centered with a ${selectedPose}, looking directly at the camera, making eye contact with the viewer, wearing a simple outfit, The background is softly blurred with muted tones, creating a cinematic and sophisticated atmosphere, The lighting is soft and directional, highlighting the subject's facial features, relaxed portrait photography capturing photorealistic skin textures, sharp eyes looking at camera, natural hair color, and subtle shadows, High-quality photography, cinematic lighting, shallow depth of field`,
              image_input: [currentImage, ...referenceImages], // Styled image + your reference photos
              size: "2K",
              width: 1728,
              height: 2304,
              aspect_ratio: "3:4",
              max_images: 1,
              sequential_image_generation: "disabled",
              prompt_strength: 0.7 // Balance between style and face
            }
          })
        });

        if (!seedreamMergeResponse.ok) {
          const errorData = await seedreamMergeResponse.json().catch(() => ({}));
          console.log(`Seedream merge failed for image ${i + 1}:`, errorData);
          finalImages.push(currentImage);
          continue;
        }

        const seedreamResult = await seedreamMergeResponse.json();

        // Poll for Seedream completion
        let mergedImage = null;
        let mergeAttempts = 0;

        while (mergeAttempts < 60) { // 60 seconds max
          await new Promise(resolve => setTimeout(resolve, 1000));

          const statusResponse = await fetch(seedreamResult.urls.get, {
            headers: {
              'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
            }
          });

          const status = await statusResponse.json();

          if (status.status === 'succeeded') {
            mergedImage = status.output[0];
            console.log(`✅ Seedream merge succeeded for image ${i + 1}`);
            break;
          } else if (status.status === 'failed') {
            console.log(`❌ Seedream merge failed for image ${i + 1}:`, status.error);
            mergedImage = currentImage; // Use styled version if merge fails
            break;
          }

          mergeAttempts++;
        }

        finalImages.push(mergedImage || currentImage);
      } catch (error) {
        console.log(`Error processing image ${i + 1}:`, error);
        finalImages.push(currentImage); // Use styled version on error
      }
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
      message: 'Generated professional headshots with your face + photography style',
      process: {
        step1: 'DanDan style generation',
        step2: 'Face swap with your face',
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