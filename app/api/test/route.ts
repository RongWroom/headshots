import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString(),
    env: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasRunpodKey: !!process.env.RUNPOD_API_KEY,
      hasRunpodEndpoint: !!process.env.RUNPOD_INFERENCE_ENDPOINT
    }
  });
}