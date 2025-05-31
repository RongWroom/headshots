import { Database } from "@/types/supabase";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import crypto from "crypto";
import { headers } from "next/headers";

// Define types inline since we're having issues with the generated types
type ModelStatus = 'pending' | 'training' | 'finished' | 'failed';

// Minimal type for model updates
interface ModelUpdate {
  status: ModelStatus;
  updated_at?: string;
  replicate_model_id?: string | null;
  error?: string | null;
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
  try {
    // Get signature from header
    const headersList = await headers();
    const signature = headersList.get("replicate-signature");
    
    if (!signature) {
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
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse webhook payload
    const payload = JSON.parse(body);
    console.log("Training webhook payload:", payload);

    // Get IDs from query params
    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id")?.toString();
    const modelId = url.searchParams.get("model_id")?.toString();

    if (!userId || !modelId) {
      return NextResponse.json(
        { error: "Missing user_id or model_id" },
        { status: 400 }
      );
    }

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

    // Helper function to update model status
    const updateModel = async (status: ModelStatus, data: Partial<ModelUpdate> = {}) => {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
        ...data
      };

      const { error } = await supabase
        .from('models')
        .update(updateData)
        .eq('id', modelId)
        .eq('user_id', userId);

      if (error) throw error;
    };

    switch (payload.event) {
      case 'start':
        await updateModel('training');
        break;

      case 'completed': {
        const trainedModelId = payload.output?.version;
        await updateModel('finished', {
          replicate_model_id: trainedModelId || null,
          error: null
        });

        // Send email notification if configured
        if (resendApiKey) {
          try {
            const { data: model, error: modelError } = await supabase
              .from('models')
              .select('name, user_email')
              .eq('id', modelId!)
              .single();

            if (modelError) throw modelError;

            // Type assertion for the model data
            const modelData = model as { name: string; user_email?: string } | null;

            if (modelData?.user_email) {
              const resend = new Resend(resendApiKey);
              await resend.emails.send({
                from: 'Your App <notifications@yourapp.com>',
                to: modelData.user_email,
                subject: '🎉 Your AI model is ready!',
                text: `Your model "${modelData.name}" has been successfully trained and is ready to use.`,
              });
            }
          } catch (emailError) {
            console.error('Email notification error:', emailError);
            // Continue even if email fails
          }
        }
        break;
      }

      case 'failed':
        await updateModel('failed', {
          error: payload.error || 'Training failed'
        });
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Training webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";