import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Get the filename from the URL query parameters
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required as a query parameter' },
        { status: 400 }
      );
    }

    // Add timestamp to prevent name collisions
    const uniqueFilename = `${Date.now()}-${filename}`;
    
    // Upload the file to Vercel Blob Storage
    const blob = await put(uniqueFilename, request.body as ReadableStream, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: request.headers.get('content-type') || 'application/octet-stream',
    });

    return NextResponse.json(blob);
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to upload file',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && {
          stack: error instanceof Error ? error.stack : undefined
        })
      },
      { status: 500 }
    );
  }
}
