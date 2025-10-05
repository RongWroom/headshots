import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Logger, extractErrorDetails } from '@/lib/logger';

export const dynamic = "force-dynamic";

// Request validation schema
interface GenerateHeadshotsRequest {
  referenceImages: string[];
  numOutputs?: number;
  styleIntensity?: number;
}

// Validation helper
function validateRequest(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate referenceImages
  if (!data.referenceImages || !Array.isArray(data.referenceImages)) {
    errors.push('referenceImages must be an array');
  } else if (data.referenceImages.length < 5 || data.referenceImages.length > 10) {
    errors.push('referenceImages must contain between 5-10 URLs');
  } else {
    // Validate each URL is from Vercel Blob
    for (const url of data.referenceImages) {
      if (typeof url !== 'string') {
        errors.push('All referenceImages must be valid URL strings');
        break;
      }
      // Check if URL is from Vercel Blob storage
      if (!url.includes('blob.vercel-storage.com') && !url.includes('public.blob.vercel-storage.com')) {
        errors.push('All image URLs must be from Vercel Blob Storage');
        break;
      }
    }
  }

  // Validate numOutputs (optional, default 4)
  if (data.numOutputs !== undefined) {
    if (typeof data.numOutputs !== 'number' || data.numOutputs < 1 || data.numOutputs > 10) {
      errors.push('numOutputs must be a number between 1-10');
    }
  }

  // Validate styleIntensity (optional, default 0.8)
  if (data.styleIntensity !== undefined) {
    if (typeof data.styleIntensity !== 'number' || data.styleIntensity < 0 || data.styleIntensity > 1) {
      errors.push('styleIntensity must be a number between 0-1');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export async function POST(req: Request) {
  const logger = new Logger('HEADSHOTS_GENERATE_API');
  
  // Create a response object for auth cookies
  const authResponse = new NextResponse();
  
  logger.logInfo('HEADSHOT_GENERATION_REQUEST_START', {
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
        imageCount: requestData.referenceImages?.length
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
      referenceImages, 
      numOutputs = 4, 
      styleIntensity = 0.8 
    } = requestData as GenerateHeadshotsRequest;
    
    logger.logSuccess('REQUEST_VALIDATION_SUCCESS', {
      imageCount: referenceImages.length,
      numOutputs,
      styleIntensity
    });

    // Create job record in database
    logger.logInfo('DATABASE_JOB_CREATE_START');
    
    const { data: job, error: dbError } = await supabase
      .from('generation_jobs')
      .insert({
        user_id: userId,
        status: 'queued',
        progress: 0,
        progress_message: 'Queued',
        reference_images: referenceImages,
        num_outputs: numOutputs,
        style_intensity: styleIntensity,
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

    // Call RunPod endpoint asynchronously
    logger.logInfo('RUNPOD_REQUEST_START', { jobId: job.id });
    
    const runpodEndpoint = process.env.RUNPOD_COMFYUI_ENDPOINT;
    const runpodApiKey = process.env.RUNPOD_API_KEY;
    
    if (!runpodEndpoint || !runpodApiKey) {
      const errorResponse = logger.createErrorResponse(
        'Configuration error',
        'RunPod endpoint not configured',
        'RUNPOD_NOT_CONFIGURED',
        { missingVars: { runpodEndpoint: !runpodEndpoint, runpodApiKey: !runpodApiKey } },
        ['Contact administrator to configure RunPod endpoint']
      );
      
      logger.logError('RUNPOD_NOT_CONFIGURED', 'Missing environment variables');
      
      // Update job status to failed
      await supabase
        .from('generation_jobs')
        .update({
          status: 'failed',
          error_message: 'Service configuration error',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);
      
      return NextResponse.json(errorResponse, { 
        status: 500,
        headers: authResponse.headers
      });
    }

    // Prepare RunPod request payload
    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL || process.env.DEPLOYMENT_URL}/api/headshots/webhook`;
    
    const runpodPayload = {
      input: {
        reference_images: referenceImages,
        num_outputs: numOutputs,
        style_intensity: styleIntensity,
        webhook_url: webhookUrl,
        job_id: job.id
      }
    };

    logger.logInfo('RUNPOD_PAYLOAD_PREPARED', {
      jobId: job.id,
      webhookUrl,
      imageCount: referenceImages.length
    });

    // Make async request to RunPod (fire and forget)
    // We don't await this - it will call our webhook when complete
    fetch(runpodEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${runpodApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(runpodPayload),
    })
      .then(async (response) => {
        const data = await response.json();
        
        if (!response.ok) {
          logger.logError('RUNPOD_REQUEST_FAILED', {
            jobId: job.id,
            status: response.status,
            error: data
          });
          
          // Update job status to failed
          await supabase
            .from('generation_jobs')
            .update({
              status: 'failed',
              error_message: data.error || 'RunPod request failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id);
        } else {
          logger.logSuccess('RUNPOD_REQUEST_SUCCESS', {
            jobId: job.id,
            runpodId: data.id
          });
          
          // Update job with RunPod ID if provided
          if (data.id) {
            await supabase
              .from('generation_jobs')
              .update({
                status: 'processing',
                progress: 10,
                progress_message: 'Processing started',
                updated_at: new Date().toISOString()
              })
              .eq('id', job.id);
          }
        }
      })
      .catch(async (error) => {
        logger.logError('RUNPOD_REQUEST_ERROR', {
          jobId: job.id,
          error: extractErrorDetails(error)
        });
        
        // Update job status to failed
        await supabase
          .from('generation_jobs')
          .update({
            status: 'failed',
            error_message: 'Failed to communicate with generation service',
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
      });

    // Return success response immediately
    const pollUrl = `/api/headshots/status/${job.id}`;
    const estimatedTime = '60-120 seconds';
    
    const successResponse = {
      success: true,
      jobId: job.id,
      status: 'queued',
      estimatedTime,
      pollUrl,
      message: 'Headshot generation job created successfully'
    };

    logger.logSuccess('GENERATION_JOB_CREATED', {
      jobId: job.id,
      pollUrl,
      estimatedTime
    });

    // Record success metric for monitoring
    await logger.recordMetric('generate_headshots', true);

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
    await logger.recordMetric('generate_headshots', false, extractErrorDetails(error).message);
    
    const response = NextResponse.json(errorResponse, { status: 500 });

    // Copy auth cookies to the error response
    for (const [key, value] of authResponse.headers.entries()) {
      response.headers.set(key, value);
    }

    return response;
  }
}
