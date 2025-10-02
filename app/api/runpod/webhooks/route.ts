/**
 * RunPod Webhook Handler
 * Handles training status updates from RunPod training service
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Logger } from '@/lib/logger';
import { RunPodWebhookPayload } from '@/types/training-monitoring';

export const dynamic = "force-dynamic";

const logger = new Logger('RUNPOD_WEBHOOK');

/**
 * Handle RunPod webhook events
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature if configured
    const signature = request.headers.get('x-runpod-signature');
    const webhookSecret = process.env.RUNPOD_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      const isValid = await verifyWebhookSignature(request, signature, webhookSecret);
      if (!isValid) {
        logger.logError('WEBHOOK_SIGNATURE_INVALID', 'Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    const payload: RunPodWebhookPayload = await request.json();
    
    logger.logInfo('RUNPOD_WEBHOOK_RECEIVED', {
      trainingId: payload.id,
      status: payload.status,
      hasOutput: !!payload.output,
      hasError: !!payload.error
    });

    // Validate required fields
    if (!payload.id || !payload.status) {
      logger.logError('WEBHOOK_INVALID_PAYLOAD', 'Missing required fields', { payload });
      return NextResponse.json(
        { error: 'Invalid payload: missing id or status' },
        { status: 400 }
      );
    }

    // Process the webhook event - update model status in database
    try {
      // Create Supabase client for database operations with service role key
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            get() { return undefined; },
            set() {},
            remove() {},
          },
        }
      );

      // Map RunPod status to our database status
      const statusMapping = {
        'IN_QUEUE': 'processing',
        'IN_PROGRESS': 'processing', 
        'COMPLETED': 'finished',
        'FAILED': 'failed',
        'CANCELLED': 'failed'
      };

      const dbStatus = statusMapping[payload.status as keyof typeof statusMapping] || 'processing';

      // Update model status in database
      const { data: updatedModel, error: updateError } = await supabase
        .from('models')
        .update({ 
          status: dbStatus
        })
        .eq('modelId', payload.id)
        .select()
        .single();

      if (updateError) {
        logger.logError('MODEL_UPDATE_FAILED', updateError.message || 'Failed to update model', {
          error: updateError,
          trainingId: payload.id,
          status: payload.status,
          dbStatus
        });
      } else {
        logger.logSuccess('MODEL_UPDATED', {
          trainingId: payload.id,
          status: payload.status,
          dbStatus,
          modelDatabaseId: updatedModel?.id
        });
      }

      // If training completed successfully, we could also save the model URL here
      if (payload.status === 'COMPLETED' && payload.output?.model_url) {
        logger.logInfo('TRAINING_COMPLETED', {
          trainingId: payload.id,
          modelUrl: payload.output.model_url
        });
      }

      logger.logSuccess('RUNPOD_WEBHOOK_PROCESSED', {
        trainingId: payload.id,
        status: payload.status,
        dbStatus
      });

      return NextResponse.json({ 
        success: true,
        message: 'Webhook processed successfully'
      });

    } catch (processingError) {
      logger.logError('WEBHOOK_PROCESSING_FAILED', processingError, {
        trainingId: payload.id,
        status: payload.status
      });

      // Return success to prevent webhook retries, but log the error
      return NextResponse.json({ 
        success: true,
        message: 'Webhook received but processing failed',
        error: processingError instanceof Error ? processingError.message : 'Unknown error'
      });
    }

  } catch (error) {
    logger.logError('RUNPOD_WEBHOOK_ERROR', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET requests for webhook endpoint verification
 */
export async function GET() {
  return NextResponse.json({
    service: 'RunPod Webhook Handler',
    status: 'active',
    timestamp: new Date().toISOString()
  });
}

/**
 * Verify webhook signature using HMAC
 */
async function verifyWebhookSignature(
  request: NextRequest,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const body = await request.text();
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Remove 'sha256=' prefix if present
    const receivedSignature = signature.replace(/^sha256=/, '');
    
    return expectedSignature === receivedSignature;
  } catch (error) {
    logger.logError('WEBHOOK_SIGNATURE_VERIFICATION_FAILED', error);
    return false;
  }
}