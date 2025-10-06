import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Logger, extractErrorDetails } from '@/lib/logger';
import { seedreamService } from '@/lib/seedream-service';
import { getStyleById, buildNegativePrompt, isValidStyleId } from '@/lib/style-catalog';
import { createErrorResponse as createStandardErrorResponse, classifyError } from '@/lib/error-utils';

export const dynamic = "force-dynamic";

// Request validation schema
interface GenerateSeedreamRequest {
  uploadId: string;
  styleId: string;
  numOutputs?: number;
  customizations?: {
    removeJewelry?: boolean;
    removeGlasses?: boolean;
    removePiercings?: boolean;
    cleanBackground?: boolean;
  };
}

// Validation helper
function validateRequest(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate uploadId
  if (!data.uploadId || typeof data.uploadId !== 'string') {
    errors.push('uploadId is required and must be a string');
  }

  // Validate styleId
  if (!data.styleId || typeof data.styleId !== 'string') {
    errors.push('styleId is required and must be a string');
  } else if (!isValidStyleId(data.styleId)) {
    errors.push(`Invalid styleId. Must be one of the available styles in the catalog`);
  }

  // Validate numOutputs (optional, default 10)
  if (data.numOutputs !== undefined) {
    if (typeof data.numOutputs !== 'number' || data.numOutputs < 1 || data.numOutputs > 10) {
      errors.push('numOutputs must be a number between 1-10');
    }
  }

  // Validate customizations (optional)
  if (data.customizations !== undefined) {
    if (typeof data.customizations !== 'object' || data.customizations === null) {
      errors.push('customizations must be an object');
    } else {
      const validKeys = ['removeJewelry', 'removeGlasses', 'removePiercings', 'cleanBackground'];
      const providedKeys = Object.keys(data.customizations);
      
      for (const key of providedKeys) {
        if (!validKeys.includes(key)) {
          errors.push(`Invalid customization key: ${key}`);
        }
        if (typeof data.customizations[key] !== 'boolean') {
          errors.push(`customizations.${key} must be a boolean`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export async function POST(req: Request) {
  const logger = new Logger('SEEDREAM_GENERATE_API');
  
  // Create a response object for auth cookies
  const authResponse = new NextResponse();
  
  logger.logInfo('SEEDREAM_GENERATION_REQUEST_START', {
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
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      const errorResponse = logger.createErrorResponse(
        'Authentication failed',
        'Please sign in to generate headshots',
        'UNAUTHORIZED',
        { authError: authError ? extractErrorDetails(authError) : 'No user found' },
        ['Sign in to your account', 'Check if your session has expired']
      );
      
      logger.logError('AUTH_FAILED', authError || 'No user found');
      
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
    
    let requestData: any;
    try {
      requestData = await req.json();
      logger.logSuccess('REQUEST_PARSED', { 
        dataKeys: Object.keys(requestData),
        uploadId: requestData.uploadId,
        styleId: requestData.styleId
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
    
    // Validate request data
    logger.logInfo('REQUEST_VALIDATION_START');
    const validation = validateRequest(requestData);
    
    if (!validation.valid) {
      const errorResponse = logger.createErrorResponse(
        'Validation failed',
        'Request data does not meet requirements',
        'VALIDATION_ERROR',
        { 
          validationErrors: validation.errors,
          receivedData: requestData
        },
        validation.errors
      );
      
      logger.logError('REQUEST_VALIDATION_FAILED', validation.errors);
      
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: authResponse.headers
      });
    }

    const { 
      uploadId, 
      styleId,
      numOutputs = 10, 
      customizations
    } = requestData as GenerateSeedreamRequest;
    
    logger.logSuccess('REQUEST_VALIDATION_SUCCESS', {
      uploadId,
      styleId,
      numOutputs,
      customizations
    });

    // Fetch upload metadata from Supabase
    logger.logInfo('FETCH_UPLOAD_METADATA_START', { uploadId });
    
    const { data: upload, error: uploadError } = await supabase
      .from('seedream_uploads')
      .select('*')
      .eq('id', uploadId)
      .eq('user_id', userId)
      .single();

    if (uploadError || !upload) {
      const errorResponse = logger.createErrorResponse(
        'Upload not found',
        'The specified upload does not exist or you do not have access to it',
        'UPLOAD_NOT_FOUND',
        { uploadError: uploadError ? extractErrorDetails(uploadError) : 'No upload found', uploadId },
        ['Verify the uploadId is correct', 'Ensure you have uploaded images first']
      );
      
      logger.logError('UPLOAD_FETCH_FAILED', uploadError || 'No upload found');
      
      return NextResponse.json(errorResponse, { 
        status: 404,
        headers: authResponse.headers
      });
    }

    // Check if upload has expired
    const expiresAt = new Date(upload.expires_at);
    if (expiresAt < new Date()) {
      const errorResponse = logger.createErrorResponse(
        'Upload expired',
        'The upload has expired. Please upload your images again.',
        'UPLOAD_EXPIRED',
        { uploadId, expiresAt: upload.expires_at },
        ['Upload your images again', 'Uploads expire after 24 hours']
      );
      
      logger.logError('UPLOAD_EXPIRED', { uploadId, expiresAt: upload.expires_at });
      
      return NextResponse.json(errorResponse, { 
        status: 410,
        headers: authResponse.headers
      });
    }

    logger.logSuccess('UPLOAD_METADATA_FETCHED', {
      uploadId,
      imageCount: upload.images?.length || 0
    });

    // Extract image URLs from upload
    const imageUrls = upload.images.map((img: any) => img.blobUrl);
    
    if (!imageUrls || imageUrls.length === 0) {
      const errorResponse = logger.createErrorResponse(
        'No images found',
        'The upload does not contain any images',
        'NO_IMAGES',
        { uploadId },
        ['Upload images before generating headshots']
      );
      
      logger.logError('NO_IMAGES_IN_UPLOAD', { uploadId });
      
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: authResponse.headers
      });
    }

    // Fetch style configuration from catalog
    logger.logInfo('FETCH_STYLE_CONFIG_START', { styleId });
    
    const style = getStyleById(styleId);
    
    if (!style) {
      const errorResponse = logger.createErrorResponse(
        'Style not found',
        'The specified style does not exist in the catalog',
        'STYLE_NOT_FOUND',
        { styleId },
        ['Use a valid styleId from the style catalog']
      );
      
      logger.logError('STYLE_NOT_FOUND', { styleId });
      
      return NextResponse.json(errorResponse, { 
        status: 404,
        headers: authResponse.headers
      });
    }

    logger.logSuccess('STYLE_CONFIG_FETCHED', {
      styleId,
      styleName: style.name,
      seed: style.seed
    });

    // Build custom negative prompt based on user customizations
    logger.logInfo('BUILD_NEGATIVE_PROMPT_START', { customizations });
    
    const negativePrompt = buildNegativePrompt(style, customizations);
    
    logger.logSuccess('NEGATIVE_PROMPT_BUILT', {
      negativePrompt: negativePrompt.substring(0, 100) + '...'
    });

    // Create job record in database
    logger.logInfo('DATABASE_JOB_CREATE_START');
    
    const { data: job, error: dbError } = await supabase
      .from('seedream_jobs')
      .insert({
        user_id: userId,
        upload_id: uploadId,
        style_id: styleId,
        num_outputs: numOutputs,
        customizations: customizations || null,
        status: 'pending',
        progress: 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError || !job) {
      const errorResponse = logger.createErrorResponse(
        'Database error',
        'Failed to create generation job',
        'DATABASE_ERROR',
        { dbError: dbError ? extractErrorDetails(dbError) : 'No job returned' },
        ['Try again in a few moments', 'Contact support if the issue persists']
      );
      
      logger.logError('DATABASE_JOB_CREATE_FAILED', dbError);
      
      return NextResponse.json(errorResponse, { 
        status: 500,
        headers: authResponse.headers
      });
    }

    logger.logSuccess('DATABASE_JOB_CREATED', {
      jobId: job.id,
      status: job.status
    });

    // Prepare webhook URL
    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL}/api/seedream/webhook`;
    
    logger.logInfo('WEBHOOK_URL_PREPARED', { webhookUrl });

    // Call Replicate API with webhook URL
    logger.logInfo('REPLICATE_API_CALL_START', { jobId: job.id });
    
    try {
      const prediction = await seedreamService.createPrediction(
        {
          image: imageUrls,
          prompt: style.prompt,
          negative_prompt: negativePrompt,
          num_outputs: numOutputs,
          seed: style.seed,
          guidance_scale: 7.5,
          num_inference_steps: 50
        },
        webhookUrl
      );

      logger.logSuccess('REPLICATE_API_CALL_SUCCESS', {
        jobId: job.id,
        predictionId: prediction.id,
        status: prediction.status
      });

      // Update job with Replicate prediction ID and status
      const { error: updateError } = await supabase
        .from('seedream_jobs')
        .update({
          replicate_prediction_id: prediction.id,
          status: 'processing',
          progress: 10,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (updateError) {
        logger.logError('JOB_UPDATE_FAILED', updateError);
        // Don't fail the request, just log the error
      } else {
        logger.logSuccess('JOB_UPDATED_WITH_PREDICTION_ID', {
          jobId: job.id,
          predictionId: prediction.id
        });
      }

    } catch (replicateError) {
      logger.logError('REPLICATE_API_CALL_FAILED', replicateError);
      
      // Update job status to failed
      await supabase
        .from('seedream_jobs')
        .update({
          status: 'failed',
          error_message: extractErrorDetails(replicateError).message,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      const errorResponse = logger.createErrorResponse(
        'Replicate API error',
        'Failed to start headshot generation',
        'REPLICATE_ERROR',
        { error: extractErrorDetails(replicateError) },
        ['Try again in a few moments', 'Contact support if the issue persists']
      );
      
      return NextResponse.json(errorResponse, { 
        status: 500,
        headers: authResponse.headers
      });
    }

    // Return success response immediately
    const pollUrl = `/api/seedream/status/${job.id}`;
    const estimatedTime = '60-90 seconds';
    
    const successResponse = {
      success: true,
      jobId: job.id,
      status: 'pending',
      estimatedTime,
      pollUrl,
      message: 'Seedream headshot generation job created successfully'
    };

    logger.logSuccess('GENERATION_JOB_CREATED', {
      jobId: job.id,
      pollUrl,
      estimatedTime
    });

    // Record success metric for monitoring
    await logger.recordMetric('generate_seedream_headshots', true);

    const response = NextResponse.json(successResponse);
    
    // Copy auth cookies to the success response
    for (const [key, value] of authResponse.headers.entries()) {
      response.headers.set(key, value);
    }

    return response;

  } catch (error) {
    const errorResponse = logger.createErrorResponse(
      'Generation request failed',
      'An unexpected error occurred while creating generation job',
      'GENERATION_REQUEST_ERROR',
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
    
    logger.logError('GENERATION_REQUEST_ERROR', error);
    
    // Record failure metric for monitoring
    await logger.recordMetric('generate_seedream_headshots', false, extractErrorDetails(error).message);
    
    const response = NextResponse.json(errorResponse, { status: 500 });

    // Copy auth cookies to the error response
    for (const [key, value] of authResponse.headers.entries()) {
      response.headers.set(key, value);
    }

    return response;
  }
}
