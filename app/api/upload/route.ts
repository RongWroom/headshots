import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Get the filename from the X-Filename header
    const filename = request.headers.get('X-Filename') || request.headers.get('x-filename');

    console.log('Upload request received for filename:', filename);
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    console.log('BLOB_READ_WRITE_TOKEN exists:', !!process.env.BLOB_READ_WRITE_TOKEN);
    
    if (!filename) {
      const error = 'Filename is required in X-Filename header';
      console.error('Upload error:', error);
      return NextResponse.json(
        { error, message: 'Missing required X-Filename header' },
        { status: 400 }
      );
    }
    
    // Check if request body exists
    if (!request.body) {
      const error = 'Request body is empty';
      console.error('Upload error:', error);
      return NextResponse.json(
        { error, message: 'No file data received' },
        { status: 400 }
      );
    }

    // Add timestamp to prevent name collisions
    const uniqueFilename = `${Date.now()}-${filename}`;
    
    try {
      console.log('Attempting to upload to Vercel Blob:', uniqueFilename);
      // Upload the file to Vercel Blob Storage
      const blob = await put(uniqueFilename, request.body as ReadableStream, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        contentType: request.headers.get('content-type') || 'application/octet-stream',
      });
      
      console.log('Upload successful:', blob.url);
      return NextResponse.json(blob);
    } catch (blobError) {
      console.error('Vercel Blob upload failed:', blobError);
      throw new Error(`Blob upload failed: ${blobError instanceof Error ? blobError.message : String(blobError)}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Upload error:', {
      message: errorMessage,
      stack: errorStack,
      error: error
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to upload file',
        message: errorMessage,
        // Only include stack trace in development
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}
