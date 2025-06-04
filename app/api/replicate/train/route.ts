import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { trainRequestSchema } from '@/types/training';
import JSZip from 'jszip';
import { put } from '@vercel/blob';
import axios from 'axios';

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

    // Log modelName and destination
    console.log(`Attempting to train with modelName: "${modelName}"`);
    const destination = `${process.env.REPLICATE_USERNAME || 'your-username'}/${modelName}`;
    console.log(`Replicate destination: "${destination}"`);

    // Step 1: Attempt to create the Replicate model destination
    console.log(`Attempting to create Replicate model destination: ${destination}`);
    try {
      const createModelResponse = await fetch("https://api.replicate.com/v1/models", {
        method: "POST",
        headers: {
          "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          owner: process.env.REPLICATE_USERNAME,
          name: modelName,
          visibility: "private",
          hardware: "gpu-t4", // General purpose GPU for model placeholder
        }),
      });

      if (createModelResponse.ok) { // Typically 200 OK or 201 Created
        const newModel = await createModelResponse.json();
        console.log('Successfully created/ensured Replicate model destination:', newModel.url);
      } else {
        const errorData = await createModelResponse.json();
        // Check common Replicate error patterns for "already exists"
        let modelExists = false;
        const errorMessage = errorData.detail || (errorData.errors && errorData.errors[0]?.detail) || errorData.message || '';
        if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes("already exists")) {
            modelExists = true;
        }

        if (modelExists) {
          console.log(`Replicate model destination ${destination} already exists. Proceeding with training.`);
        } else {
          console.error('Failed to create Replicate model destination:', JSON.stringify(errorData, null, 2));
          return NextResponse.json(
            { error: "Failed to create Replicate model destination", details: errorData },
            { status: createModelResponse.status, headers: authResponse.headers }
          );
        }
      }
    } catch (modelCreationError) {
      console.error('Error during Replicate model destination creation:', modelCreationError);
      const errorResponse = NextResponse.json(
        { 
          error: 'Error during Replicate model destination creation', 
          details: modelCreationError instanceof Error ? modelCreationError.message : 'Unknown error' 
        },
        { status: 500 }
      );
      for (const [key, value] of authResponse.headers.entries()) {
        errorResponse.headers.set(key, value);
      }
      return errorResponse;
    }

    // Step 2: Fetch images, create ZIP, and upload to Vercel Blob
    let zipBlobUrl = '';
    try {
      console.log('Fetching images and creating ZIP...');
      const zip = new JSZip();
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        try {
          const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          const filename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
          zip.file(filename, response.data);
          console.log(`Added ${filename} to ZIP.`);
        } catch (fetchError) {
          console.error(`Failed to fetch image ${imageUrl}:`, fetchError);
          // Optionally, decide if one failed image should stop the whole process
          // For now, we'll log and continue, Replicate might handle missing images gracefully or error out
        }
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      console.log('ZIP file created. Uploading to Vercel Blob...');

      const blobFilename = `training-images-${userId}-${Date.now()}.zip`;
      const blob = await put(blobFilename, zipBuffer, {
        access: 'public',
        contentType: 'application/zip',
      });
      zipBlobUrl = blob.url;
      console.log(`ZIP file uploaded to Vercel Blob: ${zipBlobUrl}`);

    } catch (zipError) {
      console.error('Error creating or uploading ZIP file:', zipError);
      const errorResponse = NextResponse.json(
        { 
          error: 'Error creating or uploading ZIP file for training images', 
          details: zipError instanceof Error ? zipError.message : 'Unknown error' 
        },
        { status: 500 }
      );
      for (const [key, value] of authResponse.headers.entries()) {
        errorResponse.headers.set(key, value);
      }
      return errorResponse;
    }

    // Step 3: Prepare the input payload for Replicate training
    const replicatePayloadInput = {
      input_images: zipBlobUrl, // URL to the ZIP file on Vercel Blob
      trigger_word: trainingConfig?.trigger_word || `sks${modelName.substring(0, 4)}`,
      lora_type: styleConfig.lora_type, // 'style' or 'subject'
    };
    console.log('Replicate payload input:', JSON.stringify(replicatePayloadInput, null, 2));

    // Call Replicate API to start training
    const response = await fetch("https://api.replicate.com/v1/models/replicate/fast-flux-trainer/versions/8b10794665aed907bb98a1a5324cd1d3a8bea0e9b31e65210967fb9c9e2e08ed/trainings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`
      },
      body: JSON.stringify({
        destination: destination,
        input: replicatePayloadInput
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
