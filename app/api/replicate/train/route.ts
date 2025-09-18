import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { trainRequestSchema } from '@/types/training';
import JSZip from 'jszip';
import { put } from '@vercel/blob';
import axios from 'axios';
import { Logger, extractErrorDetails, logApiResponse } from '@/lib/logger';
import { 
  validateFluxTrainingInput, 
  validateTrainingModelConfig,
  getRecommendedTrainingParams 
} from '@/lib/training-validation';
import { replicateApiWithRetry, replicateCircuitBreaker, apiHealthMonitor } from '@/lib/retry-utils';
import { alertServiceDown, alertCircuitBreakerOpen, alertTrainingFailure } from '@/lib/alerting';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const logger = new Logger('TRAIN_API');
  
  // Create a response object for auth cookies
  const authResponse = new NextResponse();
  
  logger.logInfo('REQUEST_START', {
    url: req.url,
    method: req.method,
    headers: Object.fromEntries(req.headers.entries())
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
    logger.logInfo('AUTH_CHECK_START');
    
    // Get the current user
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      const errorResponse = logger.createErrorResponse(
        'Authentication failed',
        'Please sign in to access this endpoint',
        'UNAUTHORIZED',
        { authError: error ? extractErrorDetails(error) : 'No user found' },
        [
          'Sign in to your account',
          'Check if your session has expired',
          'Refresh the page and try again'
        ]
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

    // Parse and validate request body
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
        [
          'Check that the request body is valid JSON',
          'Ensure all quotes are properly escaped',
          'Verify the Content-Type header is set to application/json'
        ]
      );
      
      logger.logError('JSON_PARSE_FAILED', parseError);
      
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: authResponse.headers
      });
    }
    
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
          'Ensure modelName follows naming conventions',
          'Validate trainingConfig parameters'
        ]
      );
      
      logger.logError('SCHEMA_VALIDATION_FAILED', validation.error, {
        issues: validation.error.issues,
        receivedData: requestData
      });
      
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: authResponse.headers
      });
    }

    const { imageUrls, modelName, packSlug, trainingConfig } = validation.data;
    logger.logSuccess('SCHEMA_VALIDATION_SUCCESS', {
      imageCount: imageUrls.length,
      modelName,
      packSlug,
      trainingConfig
    });

    // Determine style based on pack
    logger.logInfo('STYLE_CONFIG_START', { packSlug });
    
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

    logger.logSuccess('STYLE_CONFIG_SELECTED', { 
      packSlug: packSlug || "corporate-headshots",
      styleConfig 
    });

    // Prepare training configuration
    const triggerWord = trainingConfig?.trigger_word || `sks${modelName.substring(0, 4)}`;
    const destination = `${process.env.REPLICATE_USERNAME || 'your-username'}/${modelName}`;
    
    const trainingInput = {
      input_images: imageUrls,
      model_name: modelName,
      ...trainingConfig,
      ...styleConfig,
      lora_type: styleConfig.lora_type,
      trigger_word: triggerWord,
    };

    logger.logSuccess('TRAINING_CONFIG_PREPARED', {
      destination,
      triggerWord,
      imageCount: imageUrls.length,
      trainingInput: {
        ...trainingInput,
        input_images: `[${imageUrls.length} URLs]` // Don't log all URLs for brevity
      }
    });

    // Comprehensive input validation using new validation utilities
    logger.logInfo('COMPREHENSIVE_INPUT_VALIDATION_START');
    
    // Validate training model configuration
    const modelValidation = validateTrainingModelConfig('replicate', 'fast-flux-trainer', '8b10794665aed907bb98a1a5324cd1d3a8bea0e9b31e65210967fb9c9e2e08ed');
    
    if (!modelValidation.isValid) {
      const errorResponse = logger.createErrorResponse(
        'Invalid training model configuration',
        'The specified model cannot be used for training',
        'INVALID_TRAINING_MODEL',
        {
          modelValidation,
          currentModel: 'replicate/fast-flux-trainer',
          modelType: modelValidation.modelType
        },
        [
          'Use a proper training model instead of an inference model',
          'Check the model documentation for training capabilities',
          'Consider using alternative training services'
        ]
      );
      
      logger.logError('INVALID_TRAINING_MODEL', 'Attempted to use inference model for training', {
        modelValidation,
        destination
      });
      
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: authResponse.headers
      });
    }
    
    // Validate FLUX training input
    const inputValidation = await validateFluxTrainingInput(
      imageUrls,
      modelName,
      trainingConfig,
      {
        minImages: 5,
        maxImages: 50,
        requireAccessibilityCheck: false // Skip for now to avoid timeout
      }
    );
    
    logger.logInfo('INPUT_VALIDATION_RESULTS', {
      isValid: inputValidation.isValid,
      errors: inputValidation.errors,
      warnings: inputValidation.warnings,
      recommendations: inputValidation.recommendations,
      estimatedTrainingTime: inputValidation.estimatedTrainingTime,
      estimatedCost: inputValidation.estimatedCost
    });
    
    if (!inputValidation.isValid) {
      const errorResponse = logger.createErrorResponse(
        'Training input validation failed',
        'The provided training inputs do not meet the requirements',
        'INVALID_TRAINING_INPUT',
        {
          validationErrors: inputValidation.errors,
          warnings: inputValidation.warnings,
          recommendations: inputValidation.recommendations,
          imageCount: inputValidation.imageCount,
          inputFormat: inputValidation.inputFormat
        },
        inputValidation.recommendations
      );
      
      logger.logError('INVALID_TRAINING_INPUT', 'Training input validation failed', {
        inputValidation,
        imageCount: imageUrls.length
      });
      
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: authResponse.headers
      });
    }
    
    // Log validation warnings if any
    if (inputValidation.warnings.length > 0) {
      logger.logWarning('INPUT_VALIDATION_WARNINGS', 'Training input has warnings', {
        warnings: inputValidation.warnings,
        recommendations: inputValidation.recommendations
      });
    }

    // Step 1: Attempt to create the Replicate model destination with retry logic
    logger.logInfo('MODEL_CREATION_START', { destination });
    
    try {
      const modelPayload = {
        owner: process.env.REPLICATE_USERNAME,
        name: modelName,
        visibility: "private",
        hardware: "gpu-t4", // General purpose GPU for model placeholder
      };
      
      logger.logInfo('MODEL_CREATION_REQUEST', { 
        url: "https://api.replicate.com/v1/models",
        payload: modelPayload,
        hasToken: !!process.env.REPLICATE_API_TOKEN
      });
      
      const createModelResult = await replicateCircuitBreaker.execute(async () => {
        return await replicateApiWithRetry("https://api.replicate.com/v1/models", {
          method: "POST",
          body: JSON.stringify(modelPayload),
        }, {
          maxRetries: 3,
          baseDelay: 2000,
          onRetry: (attempt, error) => {
            logger.logWarning('MODEL_CREATION_RETRY', `Retry attempt ${attempt}`, {
              attempt,
              error: extractErrorDetails(error),
              destination
            });
          }
        });
      });

      if (!createModelResult.success) {
        throw createModelResult.error;
      }

      const responseData = createModelResult.data;
      
      logger.logSuccess('MODEL_CREATION_RESPONSE', {
        attempts: createModelResult.attempts,
        totalTime: createModelResult.totalTime,
        responseData
      });

      logger.logSuccess('MODEL_CREATION_SUCCESS', {
        modelUrl: responseData.url,
        modelName: responseData.name,
        owner: responseData.owner,
        attempts: createModelResult.attempts,
        totalTime: createModelResult.totalTime
      });
    } catch (modelCreationError) {
      // Handle specific error types from retry logic
      let errorCode = 'MODEL_CREATION_ERROR';
      let suggestions = [
        'Check your internet connection',
        'Verify Replicate API credentials',
        'Try again in a few moments',
        'Contact support if the issue persists'
      ];

      if (modelCreationError.message?.includes('Circuit breaker is OPEN')) {
        errorCode = 'SERVICE_UNAVAILABLE';
        suggestions = [
          'Replicate service is temporarily unavailable',
          'Try again in a few minutes',
          'Check Replicate status page for service updates'
        ];
        
        // Send alert for circuit breaker
        await alertCircuitBreakerOpen('replicate', {
          operation: 'model-creation',
          destination,
          error: extractErrorDetails(modelCreationError)
        });
      } else if (modelCreationError.message?.includes('already exists')) {
        // Model already exists, continue with training
        logger.logWarning('MODEL_ALREADY_EXISTS', `Model ${destination} already exists, proceeding with training`, {
          destination,
          error: extractErrorDetails(modelCreationError)
        });
      } else {
        const errorResponse = logger.createErrorResponse(
          'Model creation error',
          'Failed to create Replicate model destination after retries',
          errorCode,
          { 
            error: extractErrorDetails(modelCreationError),
            destination,
            circuitBreakerState: replicateCircuitBreaker.getState()
          },
          suggestions
        );
        
        logger.logError('MODEL_CREATION_ERROR', modelCreationError, { 
          destination,
          circuitBreakerState: replicateCircuitBreaker.getState()
        });
        
        return NextResponse.json(errorResponse, { 
          status: 500,
          headers: authResponse.headers
        });
      }
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

    // Step 3: Research findings show that replicate/fast-flux-trainer is an INFERENCE model, not a training model
    // We need to use a different approach for FLUX training
    
    logger.logInfo('TRAINING_APPROACH_RESEARCH', {
      issue: 'replicate/fast-flux-trainer is an inference model, not a training model',
      solution: 'Need to use proper FLUX training model or service',
      currentInputFormat: 'ZIP file with images',
      requiredInputFormat: 'Individual image URLs or proper training dataset format'
    });

    // For now, return an informative error about the current limitation
    const errorResponse = logger.createErrorResponse(
      'Training model configuration issue',
      'The current training model (fast-flux-trainer) is an inference model, not a training model',
      'TRAINING_MODEL_MISCONFIGURATION',
      {
        currentModel: 'replicate/fast-flux-trainer',
        modelType: 'inference',
        requiredType: 'training',
        researchFindings: {
          issue: 'fast-flux-trainer expects pre-trained weights and text prompts for inference',
          inputSchema: { replicate_weights: 'string (uri)', txt: 'string' },
          actualNeed: 'A model that accepts training images and produces LoRA weights'
        },
        possibleSolutions: [
          'Use black-forest-labs/flux-dev-lora with proper training endpoint',
          'Switch to a different training service that supports FLUX',
          'Use a community training model with proper training capabilities'
        ]
      },
      [
        'This is a configuration issue that needs to be resolved by updating the training model',
        'The development team needs to implement a proper FLUX training solution',
        'Consider using alternative training services until this is resolved'
      ]
    );
    
    logger.logError('TRAINING_MODEL_MISCONFIGURATION', 'Attempted to use inference model for training', {
      currentModel: 'replicate/fast-flux-trainer',
      destination,
      zipBlobUrl
    });
    
    return NextResponse.json(errorResponse, { 
      status: 400,
      headers: authResponse.headers
    });

    // TODO: Implement proper FLUX training once correct model/service is identified
    // The code below shows what the implementation should look like once we have the right model:
    
    /*
    // Prepare the input payload for proper FLUX training
    const replicatePayloadInput = {
      input_images: imageUrls, // Array of individual image URLs (not ZIP)
      trigger_word: trainingConfig?.trigger_word || `sks${modelName.substring(0, 4)}`,
      lora_type: styleConfig.lora_type, // 'style' or 'subject'
      training_steps: trainingConfig?.training_steps || 1000,
      learning_rate: trainingConfig?.learning_rate || 1e-4,
      resolution: 1024
    };
    
    logger.logInfo('TRAINING_REQUEST_PREPARED', {
      inputFormat: 'individual_image_urls',
      imageCount: imageUrls.length,
      trainingConfig: replicatePayloadInput
    });

    // Call the correct training endpoint (to be determined)
    const response = await fetch("https://api.replicate.com/v1/trainings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`
      },
      body: JSON.stringify({
        version: "correct-flux-training-model:version-id",
        destination: destination,
        input: replicatePayloadInput
      })
    });
    */

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
