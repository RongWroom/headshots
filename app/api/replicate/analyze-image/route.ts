import { NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

type AnalysisResponse = {
  status: string;
  analysis: string[];
  metadata?: {
    width: number;
    height: number;
    size: number;
    type: string;
  };
};

export async function POST(request: Request) {
  try {
    const { imageUrl, analysisType } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Use Replicate's image analysis model with a more structured prompt
    const prompt = `You are a professional photographer analyzing a headshot. Provide a detailed analysis of the image with the following aspects:

1. Person Description:
   - Gender (man/woman/person)
   - Approximate age
   - Ethnicity (if discernible)
   - Eye color
   - Hair color, length, and style
   - Facial hair (if any)
   - Baldness (if applicable)

2. Image Quality:
   - Is the image blurry or clear?
   - Is it a selfie or professionally taken?
   - Is it a close-up or full-body shot?
   - Is the lighting good?

3. Accessories:
   - Is the person wearing glasses or sunglasses?
   - Is the person wearing a hat or head covering?
   - Any other notable accessories?

4. Composition:
   - Is the person centered in the frame?
   - Is the background clean and professional?
   - Any distracting elements?

5. Expression:
   - Is the expression neutral, smiling, or other?
   - Does the person look professional?

6. Other Notes:
   - Anything else notable about the image
   - Any potential issues with the photo

Be concise and specific in your analysis.`;

    const output = await replicate.run(
      'yorickvp/llava-13b:6bc1c7bb0d2a34e413301fee8f7cc728d2d4e75bfab186aa995f63292bda92fc',
      {
        input: {
          image: imageUrl,
          prompt: prompt,
          max_tokens: 500,
          temperature: 0.2,
        }
      }
    );

    // Ensure output is an array of strings
    const analysis = Array.isArray(output) 
      ? output.filter(Boolean).map(String) 
      : [String(output).trim()];

    const result: AnalysisResponse = {
      status: 'success',
      analysis,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Image analysis failed:', error);
    
    // Return a more detailed error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        status: 'error',
        error: 'Failed to analyze image',
        message: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}
