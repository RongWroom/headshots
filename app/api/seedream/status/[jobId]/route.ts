import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Logger, extractErrorDetails } from '@/lib/logger';
import { seedreamService } from '@/lib/seedream-service';
import { webhookFallbackPoll } from '@/lib/error-utils';

export const dynamic = "force-dynamic";

// Rate limiting: Track last request time per job
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 2000; // 2 seconds

// Webhook delay threshold: If webhook hasn't arrived after 30 seconds, poll Replicate
const WEBHOOK_DELAY_THRESHOLD_MS = 30 * 1000; // 30 seconds

// Job expiration: Jobs older than 24 hours are considered expired
const JOB_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StatusResponse {
  success?: boolean;
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  estimatedTimeRemaining?: string;
  outputs?: Array<{
    url: string;
    thumbnail: string;
  }>;
  error?: string;
  errorCode?: string;
  suggestions?: string[];
  generationTime?: number;
  createdAt: string;
  completedAt?: string;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const logger = new Logger('SEEDREAM_STATUS_API');
  
  const { jobId } = await params;
  
  logger.logInfo('STATUS_REQUEST_START', {
    jobId,
    url: req.url,
    timestamp: new Date().toISOString()
  });
  
  // Rate limiting check
  const now = Date.now();
  const lastRequestTime = rateLimitMap.get(jobId);
  
  if (lastRequestTime && (now - lastRequestTime) < RATE_LIMIT_MS) {
    const waitTime = Math.ceil((RATE_LIMIT_MS - (now - lastRequestTime)) / 1000);
    
    logger.logError('RATE_LIMIT_EXCEEDED', {
      jobId,
      waitTime,
      lastRequestTime: new Date(lastRequestTime).toISOString()
    });
    
    return NextResponse.json({
      success: false,
      error: 'Rate limit exceeded',
      message: `Please wait ${waitTime} seconds before polling again`,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      suggestions: [
        `Wait ${waitTime} seconds before making another request`,
        'Reduce polling frequency to once every 3 seconds'
      ]
    }, { 
      status: 429,
      headers: {
        'Retry-After': waitTime.toString()
      }
    });
  }
  
  // Update rate limit tracker
  rateLimitMap.set(jobId, now);
  
  // Clean up old rate limit entries (older than 5 minutes)
  const fiveMinutesAgo = now - (5 * 60 * 1000);
  for (const [key, time] of rateLimitMap.entries()) {
    if (time < fiveMinutesAgo) {
      rateLimitMap.delete(key);
    }
  }
  
  // Get cookies for Supabase client
  const cookieStore = await cookies();
  
  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
  
  try {
    // Authentication check
    logger.logInfo('AUTH_CHECK_START');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      const errorResponse = {
        success: false,
        error: 'Authentication failed',
        message: 'Please sign in to view job status',
        errorCode: 'UNAUTHORIZED',
        details: { authError: authError ? extractErrorDetails(authError) : 'No user found' },
        suggestions: ['Sign in to your account', 'Check if your session has expired']
      };
      
      logger.logError('AUTH_FAILED', authError || 'No user found');
      
      return NextResponse.json(errorResponse, { 
        status: 401
      });
    }

    const userId = user.id;
    logger.setUserId(userId);
    logger.logSuccess('AUTH_SUCCESS', { userId, userEmail: user.email });

    // Validate jobId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(jobId)) {
      const errorResponse = {
        success: false,
        error: 'Invalid job ID',
        message: 'The provided job ID is not valid',
        errorCode: 'INVALID_JOB_ID',
        details: { jobId },
        suggestions: ['Check that the job ID is correct']
      };
      
      logger.logError('INVALID_JOB_ID', { jobId });
      
      return NextResponse.json(errorResponse, { 
        status: 400
      });
    }

    // Query seedream_jobs table
    logger.logInfo('DATABASE_QUERY_START', { jobId });
    
    const { data: job, error: dbError } = await supabase
      .from('seedream_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (dbError) {
      const errorResponse = {
        success: false,
        error: 'Database error',
        message: 'Failed to retrieve job status',
        errorCode: 'DATABASE_ERROR',
        details: { dbError: extractErrorDetails(dbError) },
        suggestions: ['Try again in a few moments', 'Contact support if the issue persists']
      };
      
      logger.logError('DATABASE_QUERY_FAILED', dbError);
      
      return NextResponse.json(errorResponse, { 
        status: 500
      });
    }

    if (!job) {
      const errorResponse = {
        success: false,
        error: 'Job not found',
        message: 'No generation job found with the provided ID',
        errorCode: 'JOB_NOT_FOUND',
        details: { jobId },
        suggestions: ['Check that the job ID is correct', 'The job may have been deleted']
      };
      
      logger.logError('JOB_NOT_FOUND', { jobId });
      
      return NextResponse.json(errorResponse, { 
        status: 404
      });
    }

    // Verify user owns the job (RLS should handle this, but double-check)
    if (job.user_id !== userId) {
      const errorResponse = {
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to view this job',
        errorCode: 'FORBIDDEN',
        details: { jobId, userId, jobUserId: job.user_id },
        suggestions: ['You can only view your own generation jobs']
      };
      
      logger.logError('ACCESS_DENIED', { 
        jobId, 
        userId, 
        jobUserId: job.user_id 
      });
      
      return NextResponse.json(errorResponse, { 
        status: 403
      });
    }

    logger.logSuccess('JOB_RETRIEVED', {
      jobId,
      status: job.status,
      progress: job.progress
    });

    // Check if job is expired (older than 24 hours)
    const jobAge = now - new Date(job.created_at).getTime();
    if (jobAge > JOB_EXPIRATION_MS && job.status !== 'completed' && job.status !== 'failed') {
      logger.logInfo('JOB_EXPIRED', { jobId, jobAge, createdAt: job.created_at });
      
      // Update job status to failed
      await supabase
        .from('seedream_jobs')
        .update({
          status: 'failed',
          error_message: 'Job expired after 24 hours without completion'
        })
        .eq('id', jobId);
      
      return NextResponse.json({
        success: false,
        jobId: job.id,
        status: 'failed',
        progress: job.progress,
        error: 'Job expired after 24 hours without completion',
        errorCode: 'JOB_EXPIRED',
        suggestions: [
          'Try creating a new generation job',
          'Contact support if this issue persists'
        ],
        createdAt: job.created_at
      } as StatusResponse, { status: 200 });
    }

    // Fallback polling: If job is processing and webhook hasn't arrived after 2 minutes, poll Replicate
    let shouldPollReplicate = false;
    
    if ((job.status === 'pending' || job.status === 'processing') && job.replicate_prediction_id) {
      const timeSinceCreation = now - new Date(job.created_at).getTime();
      const timeSinceUpdate = now - new Date(job.updated_at).getTime();
      
      // Poll if webhook is delayed (no update in 2 minutes)
      if (timeSinceUpdate > WEBHOOK_DELAY_THRESHOLD_MS || timeSinceCreation > WEBHOOK_DELAY_THRESHOLD_MS) {
        shouldPollReplicate = true;
        logger.logInfo('WEBHOOK_DELAYED_POLLING_REPLICATE', {
          jobId,
          replicatePredictionId: job.replicate_prediction_id,
          timeSinceCreation,
          timeSinceUpdate
        });
      }
    }

    // Poll Replicate if needed
    if (shouldPollReplicate && job.replicate_prediction_id) {
      try {
        logger.logInfo('POLLING_REPLICATE', { 
          jobId, 
          replicatePredictionId: job.replicate_prediction_id 
        });
        
        const prediction = await seedreamService.getPrediction(job.replicate_prediction_id);
        
        logger.logInfo('REPLICATE_POLL_SUCCESS', {
          jobId,
          replicatePredictionId: job.replicate_prediction_id,
          replicateStatus: prediction.status
        });
        
        // Update job status based on Replicate response
        if (prediction.status === 'succeeded' && prediction.output) {
          // Note: In a real implementation, we would download and store images here
          // For now, just update the status
          await supabase
            .from('seedream_jobs')
            .update({
              status: 'completed',
              progress: 100,
              output_images: prediction.output.map((url, index) => ({
                url,
                thumbnail: url // In production, generate thumbnails
              }))
            })
            .eq('id', jobId);
          
          logger.logSuccess('JOB_UPDATED_FROM_POLL', { jobId, status: 'completed' });
          
          // Return updated status
          return NextResponse.json({
            success: true,
            jobId: job.id,
            status: 'completed',
            progress: 100,
            outputs: prediction.output.map((url, index) => ({
              url,
              thumbnail: url
            })),
            generationTime: prediction.metrics?.predict_time,
            createdAt: job.created_at,
            completedAt: new Date().toISOString()
          } as StatusResponse);
          
        } else if (prediction.status === 'failed') {
          await supabase
            .from('seedream_jobs')
            .update({
              status: 'failed',
              error_message: prediction.error || 'Generation failed'
            })
            .eq('id', jobId);
          
          logger.logError('JOB_FAILED_FROM_POLL', { 
            jobId, 
            error: prediction.error 
          });
          
          return NextResponse.json({
            success: false,
            jobId: job.id,
            status: 'failed',
            progress: job.progress,
            error: prediction.error || 'Generation failed',
            errorCode: 'GENERATION_FAILED',
            suggestions: [
              'Try generating again with different images',
              'Check that your images meet the requirements',
              'Contact support if the issue persists'
            ],
            createdAt: job.created_at
          } as StatusResponse);
          
        } else if (prediction.status === 'processing' || prediction.status === 'starting') {
          // Update progress if still processing
          const newProgress = prediction.status === 'starting' ? 10 : 50;
          
          await supabase
            .from('seedream_jobs')
            .update({
              status: 'processing',
              progress: Math.max(job.progress, newProgress)
            })
            .eq('id', jobId);
          
          logger.logInfo('JOB_STILL_PROCESSING', { jobId, progress: newProgress });
        }
        
      } catch (pollError) {
        logger.logError('REPLICATE_POLL_FAILED', pollError);
        // Continue with database status if polling fails
      }
    }

    // Build response based on current status
    const statusResponse: StatusResponse = {
      success: true,
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.created_at,
    };

    // Add status-specific fields
    if (job.status === 'pending') {
      statusResponse.estimatedTimeRemaining = '60-90 seconds';
      
    } else if (job.status === 'processing') {
      // Calculate estimated time remaining based on progress
      const elapsed = now - new Date(job.started_at || job.created_at).getTime();
      const elapsedSeconds = Math.floor(elapsed / 1000);
      
      if (job.progress > 0) {
        const estimatedTotal = (elapsedSeconds / job.progress) * 100;
        const remaining = Math.max(0, estimatedTotal - elapsedSeconds);
        statusResponse.estimatedTimeRemaining = `${Math.ceil(remaining)} seconds`;
      } else {
        statusResponse.estimatedTimeRemaining = '60-90 seconds';
      }
      
    } else if (job.status === 'completed') {
      // Add output images
      if (job.output_images) {
        statusResponse.outputs = job.output_images as Array<{
          url: string;
          thumbnail: string;
        }>;
      }
      
      // Add generation time
      if (job.generation_time_seconds) {
        statusResponse.generationTime = job.generation_time_seconds;
      }
      
      // Add completion timestamp
      if (job.completed_at) {
        statusResponse.completedAt = job.completed_at;
      }
      
    } else if (job.status === 'failed') {
      // Add error details
      statusResponse.error = job.error_message || 'Generation failed';
      statusResponse.errorCode = 'GENERATION_FAILED';
      statusResponse.suggestions = [
        'Try generating again with different images',
        'Check that your images meet the requirements (JPEG, PNG, WebP, max 10MB)',
        'Ensure images contain clear faces',
        'Contact support if the issue persists'
      ];
    }

    // Set caching headers based on job status
    const headers = new Headers();
    
    if (job.status === 'completed' || job.status === 'failed') {
      // Cache completed/failed jobs for 1 hour
      headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      logger.logInfo('CACHE_HEADERS_SET', { 
        jobId, 
        status: job.status,
        cacheControl: 'public, max-age=3600'
      });
    } else {
      // No caching for in-progress jobs
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      logger.logInfo('CACHE_HEADERS_SET', { 
        jobId, 
        status: job.status,
        cacheControl: 'no-store'
      });
    }

    logger.logSuccess('STATUS_REQUEST_SUCCESS', {
      jobId,
      status: job.status,
      progress: job.progress
    });

    return NextResponse.json(statusResponse, { headers });

  } catch (error) {
    const errorResponse = {
      success: false,
      error: 'Status request failed',
      message: 'An unexpected error occurred while retrieving job status',
      errorCode: 'STATUS_REQUEST_ERROR',
      details: { 
        error: extractErrorDetails(error),
        jobId,
        timestamp: new Date().toISOString()
      },
      suggestions: [
        'Check your internet connection',
        'Try again in a few moments',
        'Contact support if the issue persists'
      ]
    };
    
    logger.logError('STATUS_REQUEST_ERROR', error);
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
