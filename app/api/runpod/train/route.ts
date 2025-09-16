import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { trainRequestSchema } from '@/types/training';
import { Logger, extractErrorDetails } from '@/lib/logger';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const logger = new Logger('RUNPOD_TRAIN_API');
  
  // Create a response object for auth cookies
  const authResponse = new NextResponse();
  
  logger.logInfo('RUNPOD_TRAINING_REQUEST_START', {
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
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
    // Authentication check
    logger.logInfo('AUTH_CHECK_START');
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      const errorResponse = logger.createErrorResponse(
        'Authentication failed',
        'Please sign in to access training services',
        'UNAUTHORIZED',
        { authError: error ? extractErrorDetails(error) : 'No user found' },
        ['Sign in to your account', 'Check if your session has expired']
      );
      
      logger.logError('AUTH_FAILED', error || 'No user found');
      
      return NextResponse.json(errorResponse, { 
        status: 401,
        headers: authResponse.headers
      });
    }

    const userId = user.id;
    logger.setUserId(userId);
    logger.logSuccess('AUTH_SUCCESS', { userId, userEmail: user.email });

    // Parse and validate request
    logger.logInfo('REQUEST_PARSING_START');
    
    let requestData;
    try {
      requestData = await req.json();
      logger.logSuccess('REQUEST_PARSED', { 
        dataKeys: Object.keys(requestData),
        imageCount: requestData.imageUrls?.length,
        modelName: requestData.modelName,
        packSlug: requestData.packSlug
      });
    } catch (parseError) {
      const errorResponse = logger.createErrorResponse(
        'Invalid JSON',
        'Request body contains invalid JSON',
        'INVALID_JSON',
        { parseError: extractErrorDetails(parseError) },
        ['Check that the request body is valid JSON']
      );
      
      logger.logError('JSON_PARSE_FAILED', parseError);
      
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: authResponse.headers
      });
    }
    
    // Validate request schema
    logger.logInfo('SCHEMA_VALIDATION_START');
    const validation = trainRequestSchema.safeParse(requestData);
    
    if (!validation.success) {
      const errorResponse = logger.createErrorResponse(
        'Validation failed',
        'Request data does not match required schema',
        'VALIDATION_ERROR',
        { 
          validationErrors: validation.error.issues,
          receivedData: requestData
        },
        [
          'Check that all required fields are present',
          'Verify imageUrls is an array of valid URLs',
          'Ensure modelName follows naming conventions'
        ]
      );
      
      logger.logError('SCHEMA_VALIDATION_FAILED', validation.error);
      
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: authResponse.headers
      });
    }

    const { imageUrls, modelName, packSlug, trainingConfig } = validation.data;
    logger.logSuccess('SCHEMA_VALIDATION_SUCCESS', {
      imageCount: imageUrls.length,
      modelName,
      packSlug
    });

    // Validate minimum requirements for high-end training
    if (imageUrls.length < 8) {
      const errorResponse = logger.createErrorResponse(
        'Insufficient training images',
        'High-end headshot training requires at least 8 high-quality images',
        'INSUFFICIENT_IMAGES',
        { 
          providedCount: imageUrls.length,
          requiredCount: 8,
          recommendation: 'Upload 8-20 high-quality photos showing your face clearly'
        },
        [
          'Upload at least 8 clear photos of your face',
          'Use well-lit, high-resolution images',
          'Include variety in angles and expressions',
          'Avoid blurry or low-quality images'
        ]
      );
      
      logger.logError('INSUFFICIENT_IMAGES', `Only ${imageUrls.length} images provided, need at least 8`);
      
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: authResponse.headers
      });
    }

    // Configure style based on pack
    logger.logInfo('STYLE_CONFIG_START', { packSlug });
    
    const styleConfig = {
      "actor-headshots": {
        style_prompt: "professional actor headshot, dramatic lighting, cinematic, high detail",
        description: "Hollywood-style actor headshots with dramatic lighting"
      },
      "corporate-headshots": {
        style_prompt: "professional corporate headshot, clean background, business attire, professional lighting",
        description: "Clean, professional business headshots"
      },
      "creative-headshots": {
        style_prompt: "creative professional headshot, artistic lighting, modern style",
        description: "Creative and artistic professional portraits"
      }
    }[packSlug || "corporate-headshots"];

    logger.logSuccess('STYLE_CONFIG_SELECTED', { 
      packSlug: packSlug || "corporate-headshots",
      styleConfig 
    });

    // Prepare RunPod training request
    const triggerWord = `sks${modelName.substring(0, 6)}`;
    const runpodPayload = {
      input: {
        image_urls: imageUrls,
        trigger_word: triggerWord,
        model_name: modelName,
        style_prompt: styleConfig.style_prompt,
        training_config: {
          resolution: 1024,
          max_train_steps: 1500,  // High-end training with more steps
          lora_rank: 64,          // Higher rank for better detail preservation
          learning_rate: 1e-4,
          train_batch_size: 1,
          gradient_accumulation_steps: 4,
          mixed_precision: "bf16",
          use_8bit_adam: true,
          enable_xformers: true,
          ...trainingConfig
        }
      }
    };

    logger.logInfo('RUNPOD_REQUEST_PREPARED', {
      endpoint: process.env.RUNPOD_TRAINING_ENDPOINT,
      triggerWord,
      imageCount: imageUrls.length,
      trainingSteps: runpodPayload.input.training_config.max_train_steps,
      loraRank: runpodPayload.input.training_config.lora_rank
    });

    // Send request to RunPod
    logger.logInfo('RUNPOD_REQUEST_START');
    
    const runpodResponse = await fetch(process.env.RUNPOD_TRAINING_ENDPOINT!, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(runpodPayload)
    });

    const runpodResult = await runpodResponse.json();
    
    logger.logInfo('RUNPOD_RESPONSE_RECEIVED', {
      status: runpodResponse.status,
      statusText: runpodResponse.statusText,
      hasResult: !!runpodResult
    });

    if (!runpodResponse.ok) {
      const errorResponse = logger.createErrorResponse(
        'RunPod training request failed',
        'Failed to start high-end training on RunPod',
        'RUNPOD_REQUEST_FAILED',
        { 
          runpodError: runpodResult,
          statusCode: runpodResponse.status,
          statusText: runpodResponse.statusText
        },
        [
          'Check RunPod service status',
          'Verify API credentials are correct',
          'Ensure training endpoint is deployed',
          'Try again in a few moments'
        ]
      );
      
      logger.logError('RUNPOD_REQUEST_FAILED', `HTTP ${runpodResponse.status}`, {
        runpodError: runpodResult
      });
      
      return NextResponse.json(errorResponse, { 
        status: runpodResponse.status,
        headers: authResponse.headers
      });
    }

    // Success response
    const successResponse = {
      success: true,
      trainingId: runpodResult.id,
      status: 'training_started',
      message: 'High-end FLUX Dev LoRA training started successfully',
      details: {
        modelName,
        triggerWord,
        styleDescription: styleConfig.description,
        imageCount: imageUrls.length,
        estimatedTime: '20-30 minutes',
        trainingSteps: runpodPayload.input.training_config.max_train_steps,
        loraRank: runpodPayload.input.training_config.lora_rank,
        capabilities: {
          maxResolution: '4096x4096',
          facePreservation: 'high',
          detailLevel: 'professional'
        }
      },
      runpodResponse: runpodResult
    };

    logger.logSuccess('TRAINING_STARTED_SUCCESSFULLY', {
      trainingId: runpodResult.id,
      modelName,
      triggerWord,
      imageCount: imageUrls.length
    });

    const response = NextResponse.json(successResponse);
    
    // Copy auth cookies to the success response
    for (const [key, value] of authResponse.headers.entries()) {
      response.headers.set(key, value);
    }

    return response;

  } catch (error) {
    const errorResponse = logger.createErrorResponse(
      'Training request failed',
      'An unexpected error occurred while starting training',
      'TRAINING_REQUEST_ERROR',
      { 
        error: extractErrorDetails(error),
        timestamp: new Date().toISOString()
      },
      [
        'Check your internet connection',
        'Verify all required environment variables are set',
        'Try again in a few moments',
        'Contact support if the issue persists'
      ]
    );
    
    logger.logError('TRAINING_REQUEST_ERROR', error);
    
    const response = NextResponse.json(errorResponse, { status: 500 });

    // Copy auth cookies to the error response
    for (const [key, value] of authResponse.headers.entries()) {
      response.headers.set(key, value);
    }

    return response;
  }
}