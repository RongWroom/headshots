/**
 * RunPod Webhook Handler
 * Handles training status updates from RunPod training service
 */

import { NextRequest, NextResponse } from 'next/server';
import { trainingMonitoringService } from '@/lib/training-monitoring';
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

    // Process the webhook event
    try {
      await trainingMonitoringService.processWebhookEvent({
        provider: 'runpod',
        event_type: 'status_update',
        event_data: payload
      });

      logger.logSuccess('RUNPOD_WEBHOOK_PROCESSED', {
        trainingId: payload.id,
        status: payload.status
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