import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // TODO: Replace with actual Replicate API call to fetch models
    const models = [
      {
        id: 'flux-dev',
        title: 'Flux Dev',
        cover_url: 'https://replicate.com/replicate/flux-dev/og_image.png',
        slug: 'flux-dev',
      },
      // Add more models as needed
    ];

    return NextResponse.json(models);
  } catch (error) {
    console.error('Error fetching Replicate models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
