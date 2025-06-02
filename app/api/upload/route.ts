import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

// Debug the environment variable - will be logged on server startup
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
const tokenLength = blobToken ? blobToken.length : 0;
const tokenStart = blobToken ? blobToken.substring(0, 10) : 'not-set';
const tokenEnd = blobToken && blobToken.length > 10 ? blobToken.substring(blobToken.length - 10) : '';

console.log(`Blob token status: ${blobToken ? 'Set' : 'Not Set'}, Length: ${tokenLength}, Format: ${tokenStart}...${tokenEnd}`);

export const runtime = 'edge';

export async function POST(request: Request) {
  // Debug: Log Blob token status
  console.log('Blob token exists:', !!process.env.BLOB_READ_WRITE_TOKEN);
  console.log('Blob token prefix:', process.env.BLOB_READ_WRITE_TOKEN?.slice(0, 17));
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name || !file.size) {
      return NextResponse.json(
        { error: 'Invalid file format' },
        { status: 400 }
      );
    }

    // Get file details for better debugging
    console.log(`Uploading file: ${file.name}, Size: ${(file.size / (1024 * 1024)).toFixed(2)}MB, Type: ${file.type}`);

    // Handle potential file size limitations
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds the 10MB limit' },
        { status: 400 }
      );
    }

    // Upload the file to Vercel Blob Storage with a unique name to prevent collisions
    // Adding timestamp to prevent name collisions
    const uniqueFileName = `${Date.now()}-${file.name}`;
    const blob = await put(uniqueFileName, file, {
      access: 'public',
    });

    if (!blob || !blob.url) {
      throw new Error('Blob storage returned an invalid response');
    }

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('Upload error:', error);
    // Provide more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to upload file',
        message: errorMessage,
        // Include stack trace in development only
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500 }
    );
  }
}
