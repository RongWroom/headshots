import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasRunpodEndpoint: !!process.env.RUNPOD_TRAINING_ENDPOINT,
    hasRunpodApiKey: !!process.env.RUNPOD_API_KEY,
    endpointLength: process.env.RUNPOD_TRAINING_ENDPOINT?.length || 0,
    apiKeyLength: process.env.RUNPOD_API_KEY?.length || 0,
    // Don't expose actual values for security
    endpointPreview: process.env.RUNPOD_TRAINING_ENDPOINT?.substring(0, 20) + '...',
    apiKeyPreview: process.env.RUNPOD_API_KEY?.substring(0, 10) + '...'
  });
}