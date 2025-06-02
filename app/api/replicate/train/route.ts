import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { trainRequestSchema } from '@/types/training';

export async function POST(req: Request) {
  try {
    // Verify authentication with Supabase
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse and validate request body
    const requestData = await req.json();
    const validation = trainRequestSchema.safeParse(requestData);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { imageUrls, modelName, packSlug, trainingConfig } = validation.data;

    // Determine style based on pack
    const styleConfig = {
      "actor-headshots": {
        style_prompt: "professional actor headshot, dramatic lighting, cinematic, high detail, 85mm",
        lora_type: "style" as const
      },
      "corporate-headshots": {
        style_prompt: "professional corporate headshot, clean background, business attire, professional lighting",
        lora_type: "style" as const
      }
    }[packSlug || "corporate-headshots"];

    // Prepare training configuration
    const trainingInput = {
      input_images: imageUrls,
      model_name: modelName,
      ...trainingConfig,
      ...styleConfig,
      lora_type: styleConfig.lora_type,
      trigger_word: trainingConfig?.trigger_word || `sks${modelName.substring(0, 4)}`,
    };

    // Call Replicate API to start training
    const response = await fetch("https://api.replicate.com/v1/models/replicate/flux-fast-trainer/versions/8b10794665aed907bb98a1a5324cd1d3a8bea0e9b31e65210967fb9c9e2e08ed/trainings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`
      },
      body: JSON.stringify({
        destination: `${process.env.REPLICATE_USERNAME || 'your-username'}/${modelName}`,
        input: trainingInput
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Replicate API error:', error);
      return NextResponse.json(
        { error: "Failed to start training", details: error },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      trainingId: result.id,
      status: 'training_started',
      message: 'Training job started successfully'
    });

  } catch (error) {
    console.error('Training error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start training',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
