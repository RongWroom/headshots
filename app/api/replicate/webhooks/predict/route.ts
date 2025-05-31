import { Database } from "@/types/supabase";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { headers } from "next/headers";

// Define types inline since we're having issues with the generated types
type PredictionStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Minimal type for prediction updates
interface PredictionUpdate {
  status: PredictionStatus;
  output?: any;
  error?: string | null;
  completed_at?: string | null;
  updated_at?: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = process.env.REPLICATE_WEBHOOK_SECRET;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseServiceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
if (!webhookSecret) throw new Error("Missing REPLICATE_WEBHOOK_SECRET");

interface PredictionWithUser {
  id: string;
  user_id: string;
  status: PredictionStatus;
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
    console.log("Prediction webhook payload:", payload);

    // Get IDs from query params
    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id")?.toString();
    const predictionId = url.searchParams.get("prediction_id")?.toString();

    if (!userId || !predictionId) {
      return NextResponse.json(
        { error: "Missing user_id or prediction_id" },
        { status: 400 }
      );
    }

    // Type assertion for prediction status
    const assertPredictionStatus = (status: string): PredictionStatus => {
      if (['pending', 'processing', 'completed', 'failed'].includes(status)) {
        return status as PredictionStatus;
      }
      return 'failed';
    };

    // Connect to Supabase with type assertion for the service key
    const supabase = createClient(
      supabaseUrl as string,
      supabaseServiceRoleKey as string
    );

    // Helper function to update prediction
    const updatePrediction = async (status: PredictionStatus, data: Partial<PredictionUpdate> = {}) => {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
        ...(status === 'completed' || status === 'failed' 
          ? { completed_at: new Date().toISOString() } 
          : { completed_at: null }),
        ...data
      };

      const { error } = await supabase
        .from('predictions')
        .update(updateData)
        .eq('id', predictionId)
        .eq('user_id', userId);

      if (error) throw error;
    };

    // Handle different prediction statuses
    switch (payload.status) {
      case 'succeeded':
        await updatePrediction('completed', {
          output: payload.output,
          error: null
        });
        break;

      case 'failed':
        await updatePrediction('failed', {
          error: payload.error || 'Prediction failed'
        });
        break;

      case 'processing':
      case 'starting':
        await updatePrediction(
          payload.status === 'processing' ? 'processing' : 'pending'
        );
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Prediction webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
