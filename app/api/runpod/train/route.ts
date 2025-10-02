import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { trainRequestSchema } from '@/types/training';
import { Logger, extractErrorDetails } from '@/lib/logger';
import { ParameterOptimizationService } from '@/lib/parameter-optimization';
import { runPodService, RunPodTrainingRequest } from '@/lib/runpod-service';
import { costTrackingService } from '@/lib/cost-tracking';

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

    // Optimize training parameters using the parameter optimization service
    logger.logInfo('PARAMETER_OPTIMIZATION_START');
    const parameterOptimizer = new ParameterOptimizationService();
    
    const optimizationResult = await parameterOptimizer.optimizeParameters({
      imageUrls,
      packSlug,
      userPreference: trainingConfig?.user_preference,
      userId,
      qualityPreset: trainingConfig?.quality_preset,
      enableABTesting: true // Enable A/B testing for parameter optimization
    });

    logger.logSuccess('PARAMETER_OPTIMIZATION_COMPLETE', {
      selectedPreset: optimizationResult.parameterSet.name,
      qualityLevel: optimizationResult.parameterSet.qualityLevel,
      estimatedTime: optimizationResult.costEstimate.estimatedMinutes,
      estimatedCost: optimizationResult.costEstimate.estimatedCost,
      abTestParticipant: !!optimizationResult.abTestInfo,
      validationErrors: optimizationResult.validation.errors.length,
      validationWarnings: optimizationResult.validation.warnings.length
    });

    // Check for validation errors
    if (!optimizationResult.validation.isValid) {
      const errorResponse = logger.createErrorResponse(
        'Parameter validation failed',
        'The optimized training parameters failed validation',
        'PARAMETER_VALIDATION_ERROR',
        { 
          validationErrors: optimizationResult.validation.errors,
          validationWarnings: optimizationResult.validation.warnings
        },
        optimizationResult.validation.errors
      );
      
      logger.logError('PARAMETER_VALIDATION_FAILED', optimizationResult.validation.errors);
      
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: authResponse.headers
      });
    }

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
      "raw-tune": {
        style_prompt: "professional headshot photography, signature lighting style, high-end portrait photography, masterful composition",
        description: "Custom photography style training for signature aesthetic"
      },
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

    // Prepare RunPod training request with optimized parameters
    // For customer models, auto-generate trigger word; for photographer training, use provided trigger word
    const triggerWord = packSlug === "raw-tune" 
      ? (trainingConfig?.trigger_word || `sks${modelName.substring(0, 6)}`)
      : `sks${modelName.substring(0, 6)}`;
    const runpodPayload = {
      input: {
        image_urls: imageUrls,
        trigger_word: triggerWord,
        model_name: modelName,
        style_prompt: styleConfig.style_prompt,
        training_config: {
          // Use optimized parameters from the parameter optimization service
          resolution: optimizationResult.selectedParameters.resolution,
          max_train_steps: optimizationResult.selectedParameters.max_train_steps,
          lora_rank: optimizationResult.selectedParameters.lora_rank,
          lora_alpha: optimizationResult.selectedParameters.lora_alpha,
          learning_rate: optimizationResult.selectedParameters.learning_rate,
          train_batch_size: optimizationResult.selectedParameters.train_batch_size,
          gradient_accumulation_steps: optimizationResult.selectedParameters.gradient_accumulation_steps,
          mixed_precision: optimizationResult.selectedParameters.mixed_precision,
          use_8bit_adam: optimizationResult.selectedParameters.use_8bit_adam,
          enable_xformers: optimizationResult.selectedParameters.enable_xformers,
          save_steps: optimizationResult.selectedParameters.save_steps,
          warmup_steps: optimizationResult.selectedParameters.warmup_steps,
          scheduler_type: optimizationResult.selectedParameters.scheduler_type,
          weight_decay: optimizationResult.selectedParameters.weight_decay,
          max_grad_norm: optimizationResult.selectedParameters.max_grad_norm,
          // Include A/B testing metadata if applicable
          ab_test_id: optimizationResult.abTestInfo?.testId,
          variant_id: optimizationResult.abTestInfo?.variantId
        }
      }
    };

    logger.logInfo('RUNPOD_REQUEST_PREPARED', {
      endpoint: process.env.RUNPOD_TRAINING_ENDPOINT,
      triggerWord,
      imageCount: imageUrls.length,
      trainingSteps: runpodPayload.input.training_config.max_train_steps,
      loraRank: runpodPayload.input.training_config.lora_rank,
      learningRate: runpodPayload.input.training_config.learning_rate,
      resolution: runpodPayload.input.training_config.resolution,
      parameterSet: optimizationResult.parameterSet.name,
      qualityLevel: optimizationResult.parameterSet.qualityLevel,
      abTestInfo: optimizationResult.abTestInfo
    });

    // Generate cost estimate before starting training
    logger.logInfo('COST_ESTIMATE_START');
    let costEstimate;
    try {
      costEstimate = await costTrackingService.generateCostEstimate({
        serviceProvider: 'runpod',
        imageCount: imageUrls.length,
        trainingParameters: {
          resolution: optimizationResult.selectedParameters.resolution,
          maxTrainSteps: optimizationResult.selectedParameters.max_train_steps,
          loraRank: optimizationResult.selectedParameters.lora_rank,
          trainBatchSize: optimizationResult.selectedParameters.train_batch_size,
          gpuType: 'RTX 4090' // Default GPU type for RunPod
        },
        userId
      });
      
      logger.logSuccess('COST_ESTIMATE_GENERATED', {
        estimateId: costEstimate.id,
        estimatedCost: costEstimate.estimatedCost,
        estimatedTime: costEstimate.estimatedTrainingTimeMinutes
      });
    } catch (costError: any) {
      logger.logWarning('COST_ESTIMATE_FAILED', 'Continuing without cost estimate', {
        error: extractErrorDetails(costError)
      });
      // Continue without cost estimate - don't fail the training
    }

    // Send request to RunPod using the enhanced service with retry logic and error handling
    logger.logInfo('RUNPOD_REQUEST_START');
    
    let runpodResult;
    try {
      runpodResult = await runPodService.startTraining(runpodPayload as RunPodTrainingRequest);
      
      logger.logSuccess('RUNPOD_REQUEST_SUCCESS', {
        trainingId: runpodResult.id,
        status: runpodResult.status
      });
      
    } catch (runpodError: any) {
      // The RunPod service already handles retries and provides user-friendly error messages
      const errorResponse = logger.createErrorResponse(
        'RunPod training request failed',
        runpodError.message || 'Failed to start training on RunPod',
        runpodError.code || 'RUNPOD_REQUEST_FAILED',
        { 
          runpodError: extractErrorDetails(runpodError),
          retryable: runpodError.retryable,
          details: runpodError.details
        },
        runpodError.actionableSteps || [
          'Check RunPod service status',
          'Verify API credentials are correct',
          'Try again in a few moments'
        ]
      );
      
      logger.logError('RUNPOD_REQUEST_FAILED', runpodError);
      
      // Use appropriate HTTP status code based on error type
      let statusCode = 500;
      if (runpodError.code === 'AUTH_ERROR') statusCode = 401;
      else if (runpodError.code === 'QUOTA_EXCEEDED') statusCode = 429;
      else if (runpodError.code === 'INVALID_IMAGES' || runpodError.code === 'INSUFFICIENT_IMAGES') statusCode = 400;
      else if (runpodError.code === 'SERVICE_UNAVAILABLE') statusCode = 503;
      
      return NextResponse.json(errorResponse, { 
        status: statusCode,
        headers: authResponse.headers
      });
    }

    // Success response with optimization details
    const successResponse = {
      success: true,
      trainingId: runpodResult.id,
      status: runpodResult.status || 'training_started',
      message: 'Optimized FLUX Dev LoRA training started successfully',
      details: {
        modelName,
        triggerWord,
        styleDescription: styleConfig.description,
        imageCount: imageUrls.length,
        estimatedTime: costEstimate ? `${costEstimate.estimatedTrainingTimeMinutes} minutes` : `${optimizationResult.costEstimate.estimatedMinutes} minutes`,
        estimatedCost: costEstimate ? costEstimate.estimatedCost : optimizationResult.costEstimate.estimatedCost,
        costBreakdown: costEstimate?.costBreakdown,
        trainingSteps: runpodPayload.input.training_config.max_train_steps,
        loraRank: runpodPayload.input.training_config.lora_rank,
        learningRate: runpodPayload.input.training_config.learning_rate,
        resolution: runpodPayload.input.training_config.resolution,
        parameterSet: {
          name: optimizationResult.parameterSet.name,
          qualityLevel: optimizationResult.parameterSet.qualityLevel,
          description: optimizationResult.parameterSet.description
        },
        qualityAssessment: {
          overallQuality: optimizationResult.qualityAssessment.overallQuality,
          recommendedPreset: optimizationResult.qualityAssessment.recommendedPreset,
          faceDetectionScore: optimizationResult.qualityAssessment.faceDetectionScore
        },
        optimization: {
          validationWarnings: optimizationResult.validation.warnings,
          recommendations: optimizationResult.recommendations,
          abTestParticipant: !!optimizationResult.abTestInfo
        },
        capabilities: {
          maxResolution: optimizationResult.selectedParameters.resolution >= 1024 ? '4096x4096' : '2048x2048',
          facePreservation: optimizationResult.parameterSet.qualityLevel === 'premium' ? 'excellent' : 
                           optimizationResult.parameterSet.qualityLevel === 'high' ? 'high' : 'good',
          detailLevel: optimizationResult.parameterSet.qualityLevel
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

    // Save model to database immediately after training starts
    logger.logInfo('DATABASE_SAVE_START');
    try {
      const { data: savedModel, error: dbError } = await supabase
        .from('models')
        .insert({
          name: modelName,
          user_id: userId,
          status: 'processing',
          modelId: runpodResult.id,
          type: packSlug || 'corporate-headshots',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        logger.logError('DATABASE_SAVE_FAILED', dbError);
        // Don't fail the request, just log the error
      } else {
        logger.logSuccess('DATABASE_SAVE_SUCCESS', {
          modelDatabaseId: savedModel.id,
          trainingId: runpodResult.id
        });
      }
    } catch (dbSaveError) {
      logger.logError('DATABASE_SAVE_ERROR', dbSaveError);
      // Don't fail the request, just log the error
    }

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