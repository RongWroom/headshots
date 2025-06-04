import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { trainRequestSchema } from '@/types/training';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Create a response object for auth cookies
  const authResponse = new NextResponse();
  
  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.headers.get('cookie')?.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1];
        },
        set(name: string, value: string, options: any) {
          authResponse.cookies.set(name, value, options);
        },
        remove(name: string, options: any) {
          authResponse.cookies.set(name, '', options);
        },
      },
    }
  );
  
  try {
    
    // Get the current user
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { 
          status: 401,
          headers: authResponse.headers
        }
      );
    }

    const userId = user.id;

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
    const response = await fetch("https://api.replicate.com/v1/trainings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`
      },
      body: JSON.stringify({
        version: "replicate/flux-fast-trainer:latest",
        destination: `${process.env.REPLICATE_USERNAME || 'your-username'}/${modelName}`,
        input: trainingInput
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Replicate API error:', error);
      return NextResponse.json(
        { error: "Failed to start training", details: error },
        { 
          status: response.status,
          headers: authResponse.headers
        }
      );
    }

    const result = await response.json();

    const successResponse = NextResponse.json({
      success: true,
      trainingId: result.id,
      status: 'training_started',
      message: 'Training job started successfully'
    });

    // Copy auth cookies to the success response
    for (const [key, value] of authResponse.headers.entries()) {
      successResponse.headers.set(key, value);
    }

    return successResponse;

  } catch (error) {
    console.error('Training error:', error);
    const errorResponse = NextResponse.json(
      { 
        error: 'Failed to start training',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );

    // Copy auth cookies to the error response
    for (const [key, value] of authResponse.headers.entries()) {
      errorResponse.headers.set(key, value);
    }

    return errorResponse;
  }
}
