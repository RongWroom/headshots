import { Database } from "@/types/supabase";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import crypto from "crypto";
import { headers } from "next/headers";
import { Logger } from "@/lib/logger";
import { alertTrainingFailure } from "@/lib/alerting";

// Define types inline since we're having issues with the generated types
type ModelStatus = 'pending' | 'training' | 'finished' | 'failed';

// Enhanced type for model updates with progress tracking
interface ModelUpdate {
  status: ModelStatus;
  updated_at?: string;
  replicate_model_id?: string | null;
  error?: string | null;
  progress?: number | null;
  training_started_at?: string | null;
  training_completed_at?: string | null;
  training_duration?: number | null;
  webhook_events?: any[] | null;
}

// Minimal type for model with user email
interface ModelWithUserEmail {
  id: string;
  name: string;
  user_id: string;
  user_email?: string;
  status: ModelStatus;
}

const resendApiKey = process.env.RESEND_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = process.env.REPLICATE_WEBHOOK_SECRET;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseServiceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
if (!webhookSecret) throw new Error("Missing REPLICATE_WEBHOOK_SECRET");

interface ModelWithUserEmail {
  id: string;
  name: string;
  user_id: string;
  user_email?: string;
  status: ModelStatus;
}

export async function POST(request: Request) {
  const logger = new Logger('TRAINING_WEBHOOK');
  
  // Initialize variables outside try block for error handling
  let userId: string | undefined;
  let modelId: string | undefined;
  
  try {
    logger.logInfo('WEBHOOK_REQUEST_START', {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    });

    // Get signature from header
    const headersList = await headers();
    const signature = headersList.get("replicate-signature");
    
    if (!signature) {
      logger.logError('WEBHOOK_AUTH_FAILED', 'Missing signature');
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    // Get raw body for signature verification
    const body = await request.text();
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret as crypto.BinaryLike)
      .update(body)
      .digest("hex");

    // Verify signature
    if (signature !== `sha256=${expectedSignature}`) {
      logger.logError('WEBHOOK_AUTH_FAILED', 'Invalid signature', {
        providedSignature: signature,
        expectedPrefix: 'sha256='
      });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse webhook payload
    const payload = JSON.parse(body);
    logger.logSuccess('WEBHOOK_PAYLOAD_PARSED', {
      event: payload.event,
      status: payload.status,
      id: payload.id,
      hasOutput: !!payload.output,
      hasError: !!payload.error
    });

    // Get IDs from query params
    const url = new URL(request.url);
    userId = url.searchParams.get("user_id")?.toString();
    modelId = url.searchParams.get("model_id")?.toString();

    if (!userId || !modelId) {
      logger.logError('WEBHOOK_VALIDATION_FAILED', 'Missing required parameters', {
        userId: !!userId,
        modelId: !!modelId,
        queryParams: Object.fromEntries(url.searchParams.entries())
      });
      return NextResponse.json(
        { error: "Missing user_id or model_id" },
        { status: 400 }
      );
    }

    logger.setUserId(userId);
    logger.logInfo('WEBHOOK_PARAMS_VALIDATED', { userId, modelId });

    // Type assertion for model status
    const assertModelStatus = (status: string): ModelStatus => {
      if (['pending', 'training', 'finished', 'failed'].includes(status)) {
        return status as ModelStatus;
      }
      return 'failed';
    };

    // Connect to Supabase with type assertion for the service key
    const supabase = createClient(
      supabaseUrl as string,
      supabaseServiceRoleKey as string
    );

    // Helper function to update model status with enhanced tracking
    const updateModel = async (status: ModelStatus, data: Partial<ModelUpdate> = {}) => {
      // Get current model data to append webhook events
      const { data: currentModel, error: fetchError } = await supabase
        .from('models')
        .select('webhook_events')
        .eq('id', modelId)
        .eq('user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // Ignore "not found" errors
        logger.logWarning('MODEL_FETCH_WARNING', 'Could not fetch current model data', { fetchError });
      }

      // Append new webhook event to history
      const existingEvents = currentModel?.webhook_events || [];
      const newEvent = {
        timestamp: new Date().toISOString(),
        event: payload.event,
        status: payload.status,
        payload: payload,
        processed_at: new Date().toISOString()
      };

      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
        webhook_events: [...existingEvents, newEvent],
        ...data
      };

      logger.logInfo('MODEL_UPDATE_START', { status, updateData: { ...updateData, webhook_events: `${updateData.webhook_events.length} events` } });

      const { error } = await supabase
        .from('models')
        .update(updateData)
        .eq('id', modelId)
        .eq('user_id', userId);

      if (error) {
        logger.logError('MODEL_UPDATE_FAILED', error.message || 'Failed to update model', { error, modelId, userId, status });
        throw error;
      }

      logger.logSuccess('MODEL_UPDATE_SUCCESS', { modelId, status, eventsCount: updateData.webhook_events.length });
    };

    // Enhanced webhook event processing with detailed tracking
    switch (payload.event) {
      case 'start':
        logger.logInfo('TRAINING_STARTED', { modelId, replicateId: payload.id });
        await updateModel('training', {
          training_started_at: new Date().toISOString(),
          progress: 0,
          error: null
        });
        break;

      case 'logs':
        // Handle training progress logs
        logger.logInfo('TRAINING_LOGS', { 
          modelId, 
          logs: payload.logs?.slice(-200) // Last 200 chars of logs
        });
        
        // Try to extract progress from logs if available
        let progress = null;
        if (payload.logs && typeof payload.logs === 'string') {
          const progressMatch = payload.logs.match(/(\d+)%/);
          if (progressMatch) {
            progress = parseInt(progressMatch[1], 10);
          }
        }
        
        await updateModel('training', {
          progress: progress,
          ...(payload.logs && { last_log: payload.logs.slice(-500) }) // Store last 500 chars
        });
        break;

      case 'completed': {
        const trainingStartTime = await getTrainingStartTime(supabase, modelId, userId);
        const trainingDuration = trainingStartTime ? Date.now() - new Date(trainingStartTime).getTime() : null;
        
        logger.logSuccess('TRAINING_COMPLETED', { 
          modelId, 
          replicateId: payload.id,
          trainingDuration: trainingDuration ? `${Math.round(trainingDuration / 1000)}s` : 'unknown',
          hasOutput: !!payload.output
        });

        const trainedModelId = payload.output?.version;
        await updateModel('finished', {
          replicate_model_id: trainedModelId || null,
          error: null,
          progress: 100,
          training_completed_at: new Date().toISOString(),
          training_duration: trainingDuration
        });

        // Send enhanced email notification
        await sendTrainingCompletionNotification(supabase, modelId, userId, logger, trainingDuration);
        break;
      }

      case 'failed':
        const errorMessage = payload.error || 'Training failed';
        logger.logError('TRAINING_FAILED', errorMessage, { 
          modelId, 
          replicateId: payload.id,
          error: payload.error 
        });

        await updateModel('failed', {
          error: errorMessage,
          training_completed_at: new Date().toISOString()
        });

        // Send alert for training failure
        await alertTrainingFailure(modelId, errorMessage, {
          userId,
          replicateId: payload.id,
          payload
        });

        // Send failure notification email
        await sendTrainingFailureNotification(supabase, modelId, userId, errorMessage, logger);
        break;

      default:
        logger.logWarning('UNKNOWN_WEBHOOK_EVENT', `Unknown event type: ${payload.event}`, {
          event: payload.event,
          payload
        });
        
        // Still update with the event for tracking
        await updateModel(payload.status as ModelStatus || 'pending', {
          error: `Unknown event: ${payload.event}`
        });
        break;
    }

    logger.logSuccess('WEBHOOK_PROCESSED_SUCCESSFULLY', {
      event: payload.event,
      modelId,
      userId
    });

    return NextResponse.json({ 
      success: true,
      event: payload.event,
      modelId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.logError("WEBHOOK_PROCESSING_ERROR", error, {
      modelId: modelId || 'unknown',
      userId: userId || 'unknown'
    });

    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Get training start time from model record
 */
async function getTrainingStartTime(supabase: any, modelId: string, userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('training_started_at')
      .eq('id', modelId)
      .eq('user_id', userId)
      .single();

    if (error) return null;
    return data?.training_started_at || null;
  } catch {
    return null;
  }
}

/**
 * Send enhanced training completion notification
 */
async function sendTrainingCompletionNotification(
  supabase: any, 
  modelId: string, 
  userId: string, 
  logger: Logger,
  trainingDuration: number | null
) {
  if (!resendApiKey) {
    logger.logInfo('EMAIL_NOTIFICATION_SKIPPED', 'Resend API key not configured');
    return;
  }

  try {
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('name, user_email')
      .eq('id', modelId)
      .single();

    if (modelError) {
      logger.logError('EMAIL_MODEL_FETCH_FAILED', modelError.message || 'Failed to fetch model for email', { error: modelError });
      return;
    }

    const modelData = model as { name: string; user_email?: string } | null;

    if (modelData?.user_email) {
      const resend = new Resend(resendApiKey);
      
      const durationText = trainingDuration 
        ? `Training completed in ${Math.round(trainingDuration / 60000)} minutes.`
        : 'Training completed successfully.';

      await resend.emails.send({
        from: 'Headshots AI <notifications@headshotsai.com>',
        to: modelData.user_email,
        subject: '🎉 Your AI headshot model is ready!',
        html: `
          <h2>Great news! Your AI model is ready</h2>
          <p>Your headshot model "<strong>${modelData.name}</strong>" has been successfully trained and is ready to generate professional headshots.</p>
          <p>${durationText}</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://yourapp.com'}/dashboard" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Start Generating Headshots</a></p>
          <p>Happy creating!</p>
        `,
        text: `Your model "${modelData.name}" has been successfully trained and is ready to use. ${durationText} Visit your dashboard to start generating headshots.`,
      });

      logger.logSuccess('EMAIL_NOTIFICATION_SENT', {
        recipient: modelData.user_email,
        modelName: modelData.name,
        trainingDuration
      });
    }
  } catch (emailError) {
    logger.logError('EMAIL_NOTIFICATION_FAILED', emailError);
    // Continue even if email fails
  }
}

/**
 * Send training failure notification
 */
async function sendTrainingFailureNotification(
  supabase: any,
  modelId: string,
  userId: string,
  errorMessage: string,
  logger: Logger
) {
  if (!resendApiKey) return;

  try {
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('name, user_email')
      .eq('id', modelId)
      .single();

    if (modelError || !model) return;

    const modelData = model as { name: string; user_email?: string };

    if (modelData.user_email) {
      const resend = new Resend(resendApiKey);

      await resend.emails.send({
        from: 'Headshots AI <notifications@headshotsai.com>',
        to: modelData.user_email,
        subject: '❌ Training failed for your AI model',
        html: `
          <h2>Training Issue</h2>
          <p>Unfortunately, training failed for your model "<strong>${modelData.name}</strong>".</p>
          <p><strong>Error:</strong> ${errorMessage}</p>
          <p>Don't worry! You can try training again with different images or contact our support team for assistance.</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://yourapp.com'}/dashboard" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Try Again</a></p>
        `,
        text: `Training failed for your model "${modelData.name}". Error: ${errorMessage}. You can try training again from your dashboard.`,
      });

      logger.logSuccess('FAILURE_EMAIL_SENT', {
        recipient: modelData.user_email,
        modelName: modelData.name,
        error: errorMessage
      });
    }
  } catch (emailError) {
    logger.logError('FAILURE_EMAIL_FAILED', emailError);
  }
}

export const dynamic = "force-dynamic";