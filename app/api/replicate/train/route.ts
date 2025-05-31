import { NextResponse } from 'next/server';
import { trainModel } from '@/lib/replicate';

export async function POST(request: Request) {
  try {
    const { imageUrls, modelName, trainingConfig } = await request.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'At least one image URL is required' },
        { status: 400 }
      );
    }

    if (!modelName) {
      return NextResponse.json(
        { error: 'Model name is required' },
        { status: 400 }
      );
    }

    // Start the training job with Replicate
    const training = await trainModel(imageUrls, modelName, trainingConfig);

    // Store the training ID in your database if needed
    // await storeTrainingInDatabase(training.id, modelName, imageUrls, trainingConfig);

    return NextResponse.json({
      success: true,
      trainingId: training.id,
      status: training.status,
    });

  } catch (error) {
    console.error('Training error:', error);
    return NextResponse.json(
      { error: 'Failed to start training', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
