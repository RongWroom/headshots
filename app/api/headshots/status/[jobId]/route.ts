import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Logger, extractErrorDetails } from '@/lib/logger';

export const dynamic = "force-dynamic";

interface StatusResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  images?: string[];
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export async function GET(
  req: Request,
  { params }: { params: { jobId: string } }
) {
  const logger = new Logger('HEADSHOTS_STATUS_API');
  
  const { jobId } = params;
  
  logger.logInfo('STATUS_REQUEST_START', {
    jobId,
    url: req.url,
    timestamp: new Date().toISOString()
  });
  
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
      const errorResponse = logger.createErrorResponse(
        'Authentication failed',
        'Please sign in to view job status',
        'UNAUTHORIZED',
        { authError: authError ? extractErrorDetails(authError) : 'No user found' },
        ['Sign in to your account', 'Check if your session has expired']
      );
      
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
      const errorResponse = logger.createErrorResponse(
        'Invalid job ID',
        'The provided job ID is not valid',
        'INVALID_JOB_ID',
        { jobId },
        ['Check that the job ID is correct']
      );
      
      logger.logError('INVALID_JOB_ID', { jobId });
      
      return NextResponse.json(errorResponse, { 
        status: 400
      });
    }

    // Query generation_jobs table
    logger.logInfo('DATABASE_QUERY_START', { jobId });
    
    const { data: job, error: dbError } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (dbError) {
      const errorResponse = logger.createErrorResponse(
        'Database error',
        'Failed to retrieve job status',
        'DATABASE_ERROR',
        { dbError: extractErrorDetails(dbError) },
        ['Try again in a few moments', 'Contact support if the issue persists']
      );
      
      logger.logError('DATABASE_QUERY_FAILED', dbError);
      
      return NextResponse.json(errorResponse, { 
        status: 500
      });
    }

    if (!job) {
      const errorResponse = logger.createErrorResponse(
        'Job not found',
        'No generation job found with the provided ID',
        'JOB_NOT_FOUND',
        { jobId },
        ['Check that the job ID is correct', 'The job may have been deleted']
      );
      
      logger.logError('JOB_NOT_FOUND', { jobId });
      
      return NextResponse.json(errorResponse, { 
        status: 404
      });
    }

    // Verify user owns the job
    if (job.user_id !== userId) {
      const errorResponse = logger.createErrorResponse(
        'Access denied',
        'You do not have permission to view this job',
        'FORBIDDEN',
        { jobId, userId, jobUserId: job.user_id },
        ['You can only view your own generation jobs']
      );
      
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

    // Build response
    const statusResponse: StatusResponse = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      message: job.progress_message || 'Processing',
      createdAt: job.created_at,
    };

    // Add images if completed
    if (job.status === 'completed' && job.output_images) {
      statusResponse.images = job.output_images;
    }

    // Add error if failed
    if (job.status === 'failed' && job.error_message) {
      statusResponse.error = job.error_message;
    }

    // Add completedAt if job is finished
    if (job.completed_at) {
      statusResponse.completedAt = job.completed_at;
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
    const errorResponse = logger.createErrorResponse(
      'Status request failed',
      'An unexpected error occurred while retrieving job status',
      'STATUS_REQUEST_ERROR',
      { 
        error: extractErrorDetails(error),
        jobId,
        timestamp: new Date().toISOString()
      },
      [
        'Check your internet connection',
        'Try again in a few moments',
        'Contact support if the issue persists'
      ]
    );
    
    logger.logError('STATUS_REQUEST_ERROR', error);
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
