import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';
import { Logger, extractErrorDetails } from '@/lib/logger';
import crypto from 'crypto';

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for webhook processing

// Webhook payload interface
interface WebhookPayload {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  images?: string[]; // Base64 encoded images
  error?: string;
  metadata?: {
    generation_time?: number;
    detected_features?: Record<string, any>;
  };
}

// Rate limiting store (in-memory, simple implementation)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max 100 requests per minute per IP

// Webhook payload store for debugging and idempotency
const webhookPayloadStore = new Map<string, { payload: any; processedAt: number }>();
const WEBHOOK_PAYLOAD_TTL = 3600000; // Keep payloads for 1 hour

/**
 * Validate HMAC signature for webhook security
 */
function validateWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }
    
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    return crypto.timingSafeEqual(
      new Uint8Array(signatureBuffer),
      new Uint8Array(expectedBuffer)
    );
  } catch (error) {
    return false;
  }
}

/**
 * Check rate limit for IP address
 */
function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetAt) {
    // Create new record or reset expired one
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
}

/**
 * Check if webhook has already been processed (idempotency)
 */
function checkIdempotency(jobId: string, payload: any): boolean {
  const key = `${jobId}-${payload.status}-${payload.progress}`;
  const existing = webhookPayloadStore.get(key);
  
  if (existing) {
    const age = Date.now() - existing.processedAt;
    if (age < WEBHOOK_PAYLOAD_TTL) {
      return true; // Already processed recently
    }
  }
  
  return false;
}

/**
 * Store webhook payload for debugging and idempotency
 */
function storeWebhookPayload(jobId: string, payload: any): void {
  const key = `${jobId}-${payload.status}-${payload.progress}`;
  webhookPayloadStore.set(key, {
    payload,
    processedAt: Date.now()
  });
  
  // Clean up old entries
  const now = Date.now();
  for (const [k, v] of webhookPayloadStore.entries()) {
    if (now - v.processedAt > WEBHOOK_PAYLOAD_TTL) {
      webhookPayloadStore.delete(k);
    }
  }
}

/**
 * Upload base64 image to Vercel Blob Storage
 */
async function uploadImageToBlob(
  base64Image: string,
  jobId: string,
  index: number,
  logger: Logger
): Promise<string | null> {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Generate unique filename
    const filename = `headshots/${jobId}/output-${index}-${Date.now()}.png`;
    
    logger.logInfo('BLOB_UPLOAD_START', {
      jobId,
      index,
      filename,
      sizeBytes: buffer.length
    });
    
    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/png',
    });
    
    logger.logSuccess('BLOB_UPLOAD_SUCCESS', {
      jobId,
      index,
      url: blob.url
    });
    
    return blob.url;
  } catch (error) {
    logger.logError('BLOB_UPLOAD_FAILED', {
      jobId,
      index,
      error: extractErrorDetails(error)
    });
    return null;
  }
}

export async function POST(req: Request) {
  const logger = new Logger('HEADSHOTS_WEBHOOK');
  
  logger.logInfo('WEBHOOK_REQUEST_START', {
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  try {
    // Get client IP for rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
               req.headers.get('x-real-ip') || 
               'unknown';
    
    // Check rate limit
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      const errorResponse = logger.createErrorResponse(
        'Rate limit exceeded',
        'Too many webhook requests from this IP',
        'RATE_LIMIT_EXCEEDED',
        { ip, limit: RATE_LIMIT_MAX_REQUESTS },
        ['Wait a moment before retrying']
      );
      
      logger.logError('RATE_LIMIT_EXCEEDED', { ip });
      
      return NextResponse.json(errorResponse, { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
          'Retry-After': '60'
        }
      });
    }
    
    // Get webhook secret
    const webhookSecret = process.env.RUNPOD_WEBHOOK_SECRET || process.env.APP_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      logger.logError('WEBHOOK_SECRET_NOT_CONFIGURED', 'Missing webhook secret');
      
      return NextResponse.json({
        success: false,
        error: 'Webhook not configured'
      }, { status: 500 });
    }
    
    // Get request body as text for signature validation
    const rawBody = await req.text();
    
    // Validate webhook signature
    const signature = req.headers.get('x-webhook-signature') || 
                     req.headers.get('x-runpod-signature');
    
    if (signature) {
      const isValid = validateWebhookSignature(rawBody, signature, webhookSecret);
      
      if (!isValid) {
        const errorResponse = logger.createErrorResponse(
          'Invalid signature',
          'Webhook signature validation failed',
          'INVALID_SIGNATURE',
          { hasSignature: !!signature },
          ['Check webhook secret configuration']
        );
        
        logger.logError('INVALID_WEBHOOK_SIGNATURE', { hasSignature: !!signature });
        
        return NextResponse.json(errorResponse, { status: 401 });
      }
      
      logger.logSuccess('WEBHOOK_SIGNATURE_VALID');
    } else {
      // Log warning but allow (for development/testing)
      logger.logWarning('WEBHOOK_NO_SIGNATURE', 'Webhook received without signature');
    }
    
    // Parse webhook payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
      logger.logSuccess('WEBHOOK_PAYLOAD_PARSED', {
        jobId: payload.jobId,
        status: payload.status,
        progress: payload.progress
      });
    } catch (parseError) {
      const errorResponse = logger.createErrorResponse(
        'Invalid JSON',
        'Webhook payload contains invalid JSON',
        'INVALID_JSON',
        { parseError: extractErrorDetails(parseError) },
        ['Check webhook payload format']
      );
      
      logger.logError('WEBHOOK_JSON_PARSE_FAILED', parseError);
      
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    // Validate required fields
    if (!payload.jobId || !payload.status) {
      const errorResponse = logger.createErrorResponse(
        'Invalid payload',
        'Missing required fields: jobId or status',
        'INVALID_PAYLOAD',
        { payload },
        ['Ensure jobId and status are provided']
      );
      
      logger.logError('WEBHOOK_INVALID_PAYLOAD', { payload });
      
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    // Check idempotency - have we already processed this exact webhook?
    if (checkIdempotency(payload.jobId, payload)) {
      logger.logInfo('WEBHOOK_DUPLICATE_DETECTED', {
        jobId: payload.jobId,
        status: payload.status,
        progress: payload.progress
      });
      
      // Return success for duplicate webhooks (idempotent)
      return NextResponse.json({
        success: true,
        message: 'Webhook already processed',
        duplicate: true
      });
    }
    
    // Store webhook payload for debugging and future idempotency checks
    storeWebhookPayload(payload.jobId, payload);
    
    // Create Supabase client with service role for webhook updates
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    logger.logInfo('DATABASE_UPDATE_START', {
      jobId: payload.jobId,
      status: payload.status
    });
    
    // Prepare update data
    const updateData: any = {
      status: payload.status,
      updated_at: new Date().toISOString()
    };
    
    // Add progress if provided
    if (payload.progress !== undefined) {
      updateData.progress = payload.progress;
    }
    
    // Add message if provided
    if (payload.message) {
      updateData.progress_message = payload.message;
    }
    
    // Add error if provided
    if (payload.error) {
      updateData.error_message = payload.error;
    }
    
    // Add metadata if provided
    if (payload.metadata) {
      if (payload.metadata.generation_time) {
        updateData.generation_time_seconds = payload.metadata.generation_time;
      }
      if (payload.metadata.detected_features) {
        updateData.detected_features = payload.metadata.detected_features;
      }
    }
    
    // Set timestamps based on status
    if (payload.status === 'processing' && !updateData.started_at) {
      updateData.started_at = new Date().toISOString();
    }
    
    if (payload.status === 'completed' || payload.status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    // Handle image uploads if provided
    if (payload.images && payload.images.length > 0) {
      logger.logInfo('IMAGE_UPLOAD_START', {
        jobId: payload.jobId,
        imageCount: payload.images.length
      });
      
      const uploadPromises = payload.images.map((base64Image, index) =>
        uploadImageToBlob(base64Image, payload.jobId, index, logger)
      );
      
      const uploadedUrls = await Promise.all(uploadPromises);
      
      // Filter out failed uploads
      const successfulUrls = uploadedUrls.filter(url => url !== null) as string[];
      
      if (successfulUrls.length > 0) {
        updateData.output_images = successfulUrls;
        logger.logSuccess('IMAGE_UPLOAD_COMPLETE', {
          jobId: payload.jobId,
          successCount: successfulUrls.length,
          failCount: uploadedUrls.length - successfulUrls.length
        });
      } else {
        logger.logError('IMAGE_UPLOAD_ALL_FAILED', {
          jobId: payload.jobId,
          attemptedCount: payload.images.length
        });
        
        // Mark job as failed if all image uploads failed
        updateData.status = 'failed';
        updateData.error_message = 'Failed to upload generated images';
      }
    }
    
    // Update job in database
    const { data: updatedJob, error: dbError } = await supabase
      .from('generation_jobs')
      .update(updateData)
      .eq('id', payload.jobId)
      .select()
      .single();
    
    if (dbError) {
      const errorResponse = logger.createErrorResponse(
        'Database error',
        'Failed to update generation job',
        'DATABASE_ERROR',
        { 
          dbError: extractErrorDetails(dbError),
          jobId: payload.jobId
        },
        ['Webhook will be retried automatically']
      );
      
      logger.logError('DATABASE_UPDATE_FAILED', dbError);
      
      // Return 500 to trigger webhook retry
      return NextResponse.json(errorResponse, { status: 500 });
    }
    
    if (!updatedJob) {
      const errorResponse = logger.createErrorResponse(
        'Job not found',
        'No generation job found with the provided ID',
        'JOB_NOT_FOUND',
        { jobId: payload.jobId },
        ['Job may have been deleted']
      );
      
      logger.logError('JOB_NOT_FOUND', { jobId: payload.jobId });
      
      return NextResponse.json(errorResponse, { status: 404 });
    }
    
    logger.logSuccess('DATABASE_UPDATE_SUCCESS', {
      jobId: payload.jobId,
      status: updatedJob.status,
      progress: updatedJob.progress,
      hasImages: !!updatedJob.output_images
    });
    
    // Return success response
    const successResponse = {
      success: true,
      jobId: payload.jobId,
      status: updatedJob.status,
      message: 'Webhook processed successfully'
    };
    
    logger.logSuccess('WEBHOOK_PROCESSED', {
      jobId: payload.jobId,
      status: payload.status,
      progress: payload.progress
    });
    
    return NextResponse.json(successResponse, {
      headers: {
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString()
      }
    });
    
  } catch (error) {
    const errorResponse = logger.createErrorResponse(
      'Webhook processing failed',
      'An unexpected error occurred while processing webhook',
      'WEBHOOK_ERROR',
      { 
        error: extractErrorDetails(error),
        timestamp: new Date().toISOString()
      },
      ['Webhook will be retried automatically']
    );
    
    logger.logError('WEBHOOK_ERROR', error);
    
    // Return 500 to trigger webhook retry
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
