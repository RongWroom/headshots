import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';
import { Logger, extractErrorDetails } from '@/lib/logger';
import crypto from 'crypto';

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for webhook processing

// Webhook payload interface from Replicate
interface ReplicateWebhookPayload {
  id: string; // Replicate prediction ID
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: string[] | null; // Array of image URLs from Replicate
  error: string | null;
  metrics?: {
    predict_time?: number;
  };
}

// Rate limiting store (in-memory, simple implementation)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max 100 requests per minute per IP

// Webhook payload store for idempotency
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
    // Replicate uses sha256=<hash> format
    const signatureValue = signature.replace(/^sha256=/, '');
    
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    if (signatureValue.length !== expectedSignature.length) {
      return false;
    }
    
    const signatureBuffer = Buffer.from(signatureValue, 'hex');
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
function checkIdempotency(predictionId: string, status: string): boolean {
  const key = `${predictionId}-${status}`;
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
 * Store webhook payload for idempotency
 */
function storeWebhookPayload(predictionId: string, status: string, payload: any): void {
  const key = `${predictionId}-${status}`;
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
 * Download image from URL with retry logic
 */
async function downloadImage(
  url: string,
  logger: Logger,
  maxRetries: number = 3
): Promise<Buffer | null> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logger.logInfo('IMAGE_DOWNLOAD_ATTEMPT', {
        url,
        attempt: attempt + 1,
        maxRetries
      });
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      logger.logSuccess('IMAGE_DOWNLOAD_SUCCESS', {
        url,
        sizeBytes: buffer.length,
        attempt: attempt + 1
      });
      
      return buffer;
    } catch (error) {
      lastError = error as Error;
      logger.logWarning('IMAGE_DOWNLOAD_FAILED', 'Image download attempt failed', {
        url,
        attempt: attempt + 1,
        error: extractErrorDetails(error)
      });
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  logger.logError('IMAGE_DOWNLOAD_ALL_ATTEMPTS_FAILED', {
    url,
    error: lastError ? extractErrorDetails(lastError) : 'Unknown error'
  });
  
  return null;
}

/**
 * Upload image buffer to Vercel Blob Storage
 */
async function uploadImageToBlob(
  imageBuffer: Buffer,
  userId: string,
  jobId: string,
  index: number,
  logger: Logger,
  maxRetries: number = 3
): Promise<string | null> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Generate unique filename with timestamp to avoid collisions
      const timestamp = Date.now();
      const filename = `seedream-outputs/${userId}/${jobId}/${index}-${timestamp}.jpg`;
      
      logger.logInfo('BLOB_UPLOAD_ATTEMPT', {
        jobId,
        index,
        filename,
        sizeBytes: imageBuffer.length,
        attempt: attempt + 1
      });
      
      // Upload to Vercel Blob
      const blob = await put(filename, imageBuffer, {
        access: 'public',
        contentType: 'image/jpeg',
      });
      
      logger.logSuccess('BLOB_UPLOAD_SUCCESS', {
        jobId,
        index,
        url: blob.url,
        attempt: attempt + 1
      });
      
      return blob.url;
    } catch (error) {
      lastError = error as Error;
      logger.logWarning('BLOB_UPLOAD_FAILED', 'Blob upload attempt failed', {
        jobId,
        index,
        attempt: attempt + 1,
        error: extractErrorDetails(error)
      });
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  logger.logError('BLOB_UPLOAD_ALL_ATTEMPTS_FAILED', {
    jobId,
    index,
    error: lastError ? extractErrorDetails(lastError) : 'Unknown error'
  });
  
  return null;
}

/**
 * Process webhook from Replicate
 */
export async function POST(req: Request) {
  const logger = new Logger('SEEDREAM_WEBHOOK');
  
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
      logger.logError('RATE_LIMIT_EXCEEDED', { ip });
      
      return NextResponse.json({
        error: 'Rate limit exceeded',
        message: 'Too many webhook requests from this IP'
      }, { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
          'Retry-After': '60'
        }
      });
    }
    
    // Get webhook secret
    const webhookSecret = process.env.REPLICATE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      logger.logError('WEBHOOK_SECRET_NOT_CONFIGURED', 'Missing REPLICATE_WEBHOOK_SECRET');
      
      return NextResponse.json({
        error: 'Webhook not configured'
      }, { status: 500 });
    }
    
    // Get request body as text for signature validation
    const rawBody = await req.text();
    
    // Validate webhook signature
    const signature = req.headers.get('replicate-signature');
    
    if (!signature) {
      logger.logError('WEBHOOK_NO_SIGNATURE', 'Webhook received without signature');
      
      return NextResponse.json({
        error: 'Missing signature'
      }, { status: 401 });
    }
    
    const isValid = validateWebhookSignature(rawBody, signature, webhookSecret);
    
    if (!isValid) {
      logger.logError('INVALID_WEBHOOK_SIGNATURE', { hasSignature: !!signature });
      
      return NextResponse.json({
        error: 'Invalid signature'
      }, { status: 401 });
    }
    
    logger.logSuccess('WEBHOOK_SIGNATURE_VALID');
    
    // Parse webhook payload
    let payload: ReplicateWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
      logger.logSuccess('WEBHOOK_PAYLOAD_PARSED', {
        predictionId: payload.id,
        status: payload.status,
        hasOutput: !!payload.output,
        hasError: !!payload.error
      });
    } catch (parseError) {
      logger.logError('WEBHOOK_JSON_PARSE_FAILED', parseError);
      
      return NextResponse.json({
        error: 'Invalid JSON'
      }, { status: 400 });
    }
    
    // Validate required fields
    if (!payload.id || !payload.status) {
      logger.logError('WEBHOOK_INVALID_PAYLOAD', { payload });
      
      return NextResponse.json({
        error: 'Missing required fields: id or status'
      }, { status: 400 });
    }
    
    // Check idempotency - have we already processed this exact webhook?
    if (checkIdempotency(payload.id, payload.status)) {
      logger.logInfo('WEBHOOK_DUPLICATE_DETECTED', {
        predictionId: payload.id,
        status: payload.status
      });
      
      // Return success for duplicate webhooks (idempotent)
      return NextResponse.json({
        success: true,
        message: 'Webhook already processed',
        duplicate: true
      });
    }
    
    // Store webhook payload for future idempotency checks
    storeWebhookPayload(payload.id, payload.status, payload);
    
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
    
    // Find job by Replicate prediction ID
    const { data: job, error: jobError } = await supabase
      .from('seedream_jobs')
      .select('id, user_id, status')
      .eq('replicate_prediction_id', payload.id)
      .single();
    
    if (jobError || !job) {
      logger.logError('JOB_NOT_FOUND', {
        predictionId: payload.id,
        error: jobError ? extractErrorDetails(jobError) : 'No job found'
      });
      
      return NextResponse.json({
        error: 'Job not found',
        predictionId: payload.id
      }, { status: 404 });
    }
    
    logger.logInfo('JOB_FOUND', {
      jobId: job.id,
      userId: job.user_id,
      currentStatus: job.status,
      newStatus: payload.status
    });
    
    // Prepare update data based on webhook status
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    // Map Replicate status to our status
    if (payload.status === 'starting' || payload.status === 'processing') {
      updateData.status = 'processing';
      updateData.progress = payload.status === 'starting' ? 10 : 50;
    } else if (payload.status === 'succeeded') {
      updateData.status = 'completed';
      updateData.progress = 100;
      
      // Add generation metrics
      if (payload.metrics?.predict_time) {
        updateData.generation_time_seconds = payload.metrics.predict_time;
      }
      
      // Calculate estimated cost (Replicate Seedream pricing)
      // Estimated: $0.10 per generation (10 outputs)
      updateData.estimated_cost_usd = 0.10;
      
    } else if (payload.status === 'failed' || payload.status === 'canceled') {
      updateData.status = 'failed';
      updateData.error_message = payload.error || `Generation ${payload.status}`;
    }
    
    // Handle successful generation - download and upload images
    if (payload.status === 'succeeded' && payload.output && payload.output.length > 0) {
      logger.logInfo('IMAGE_PROCESSING_START', {
        jobId: job.id,
        imageCount: payload.output.length
      });
      
      const outputUrls: string[] = [];
      
      // Process each image
      for (let i = 0; i < payload.output.length; i++) {
        const replicateUrl = payload.output[i];
        
        logger.logInfo('PROCESSING_IMAGE', {
          jobId: job.id,
          index: i,
          replicateUrl
        });
        
        // Download image from Replicate
        const imageBuffer = await downloadImage(replicateUrl, logger);
        
        if (!imageBuffer) {
          logger.logWarning('IMAGE_DOWNLOAD_SKIPPED', 'Failed to download image from Replicate', {
            jobId: job.id,
            index: i,
            replicateUrl
          });
          continue;
        }
        
        // Upload to Vercel Blob
        const blobUrl = await uploadImageToBlob(
          imageBuffer,
          job.user_id,
          job.id,
          i,
          logger
        );
        
        if (blobUrl) {
          outputUrls.push(blobUrl);
        }
      }
      
      if (outputUrls.length > 0) {
        updateData.output_images = outputUrls;
        logger.logSuccess('IMAGE_PROCESSING_COMPLETE', {
          jobId: job.id,
          successCount: outputUrls.length,
          failCount: payload.output.length - outputUrls.length
        });
      } else {
        // All image uploads failed
        logger.logError('IMAGE_PROCESSING_ALL_FAILED', {
          jobId: job.id,
          attemptedCount: payload.output.length
        });
        
        updateData.status = 'failed';
        updateData.error_message = 'Failed to download and store generated images';
      }
    }
    
    // Update job in database
    logger.logInfo('DATABASE_UPDATE_START', {
      jobId: job.id,
      updateData: {
        ...updateData,
        output_images: updateData.output_images ? `${updateData.output_images.length} images` : undefined
      }
    });
    
    const { data: updatedJob, error: updateError } = await supabase
      .from('seedream_jobs')
      .update(updateData)
      .eq('id', job.id)
      .select()
      .single();
    
    if (updateError) {
      logger.logError('DATABASE_UPDATE_FAILED', {
        jobId: job.id,
        error: extractErrorDetails(updateError)
      });
      
      // Return 500 to trigger webhook retry
      return NextResponse.json({
        error: 'Database update failed'
      }, { status: 500 });
    }
    
    logger.logSuccess('DATABASE_UPDATE_SUCCESS', {
      jobId: job.id,
      status: updatedJob.status,
      progress: updatedJob.progress,
      hasImages: !!updatedJob.output_images
    });
    
    // Return success response
    const successResponse = {
      success: true,
      jobId: job.id,
      status: updatedJob.status,
      message: 'Webhook processed successfully'
    };
    
    logger.logSuccess('WEBHOOK_PROCESSED', {
      jobId: job.id,
      predictionId: payload.id,
      status: payload.status
    });
    
    return NextResponse.json(successResponse, {
      headers: {
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString()
      }
    });
    
  } catch (error) {
    logger.logError('WEBHOOK_ERROR', error);
    
    // Return 500 to trigger webhook retry
    return NextResponse.json({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
