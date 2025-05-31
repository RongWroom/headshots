import { NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { imageUrl, analysisType } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Use Replicate's image analysis model
    const output = await replicate.run(
      'yorickvp/llava-13b:6bc1c7bb0d2a34e413301fee8f7cc728d2d4e75bfab186aa995f63292bda92fc',
      {
        input: {
          image: imageUrl,
          prompt: `Analyze this image for ${analysisType}. Provide details about the person's appearance, including age, gender, facial features, hair, and any accessories.`,
        }
      }
    );

    // Process the output to match our expected format
    const result = {
      status: 'success',
      analysis: output
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Image analysis failed:', error);
    return NextResponse.json(
      { error: 'Failed to analyze image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
