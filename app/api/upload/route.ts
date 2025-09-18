import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { blobOperationWithRetry, blobCircuitBreaker } from '@/lib/retry-utils';

export const runtime = 'edge';

// Structured error response interface
interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  timestamp: string;
  requestId: string;
  details?: any;
  stack?: string;
  suggestions?: string[];
}

// Generate unique request ID for tracking
function generateRequestId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create structured error response
function createErrorResponse(
  error: string,
  message: string,
  code: string,
  requestId: string,
  details?: any,
  suggestions?: string[]
): ErrorResponse {
  return {
    error,
    message,
    code,
    timestamp: new Date().toISOString(),
    requestId,
    details,
    suggestions,
    ...(process.env.NODE_ENV === 'development' && details?.stack && { stack: details.stack })
  };
}

// Enhanced logging function
function logError(requestId: string, stage: string, error: any, context?: any) {
  const logData = {
    requestId,
    stage,
    timestamp: new Date().toISOString(),
    error: {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    },
    context
  };
  
  console.error(`[UPLOAD_ERROR] ${stage}:`, JSON.stringify(logData, null, 2));
}

// Enhanced success logging
function logSuccess(requestId: string, stage: string, data: any) {
  const logData = {
    requestId,
    stage,
    timestamp: new Date().toISOString(),
    data
  };
  
  console.log(`[UPLOAD_SUCCESS] ${stage}:`, JSON.stringify(logData, null, 2));
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = generateRequestId();
  
  try {
    // Log request initiation
    logSuccess(requestId, 'REQUEST_START', {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries())
    });

    // Get the filename and model name from headers
    const filename = request.headers.get('X-Filename') || request.headers.get('x-filename');
    const modelName = request.headers.get('X-Model-Name') || request.headers.get('x-model-name') || 'default';
    const contentType = request.headers.get('content-type');
    const contentLength = request.headers.get('content-length');

    // Enhanced request logging
    const requestContext = {
      filename,
      modelName,
      contentType,
      contentLength,
      hasBody: !!request.body,
      hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN
    };

    logSuccess(requestId, 'REQUEST_PARSED', requestContext);
    
    // Validate filename
    if (!filename) {
      const errorResponse = createErrorResponse(
        'Missing filename',
        'Filename is required in X-Filename header',
        'MISSING_FILENAME',
        requestId,
        { providedHeaders: Object.fromEntries(request.headers.entries()) },
        [
          'Include X-Filename header with the file name',
          'Ensure the header name is exactly "X-Filename" (case-sensitive)',
          'Check that the filename includes a valid file extension'
        ]
      );
      
      logError(requestId, 'VALIDATION_FAILED', 'Missing filename header', requestContext);
      
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate file format
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const fileExtension = filename.split('.').pop()?.toLowerCase();
    
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      const errorResponse = createErrorResponse(
        'Invalid file format',
        `File format '${fileExtension || 'unknown'}' is not supported`,
        'INVALID_FILE_FORMAT',
        requestId,
        { 
          filename,
          detectedExtension: fileExtension,
          allowedExtensions,
          contentType
        },
        [
          `Use one of the supported formats: ${allowedExtensions.join(', ')}`,
          'Ensure the file extension matches the actual file format',
          'Convert your image to a supported format before uploading'
        ]
      );
      
      logError(requestId, 'VALIDATION_FAILED', 'Invalid file format', { filename, fileExtension, allowedExtensions });
      
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate file size (individual file limit)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const fileSizeStr = contentLength;
    const fileSize = fileSizeStr ? parseInt(fileSizeStr, 10) : 0;
    
    if (fileSize > maxFileSize) {
      const errorResponse = createErrorResponse(
        'File too large',
        `File size ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds the maximum allowed size of ${maxFileSize / 1024 / 1024}MB`,
        'FILE_TOO_LARGE',
        requestId,
        { 
          fileSize,
          maxFileSize,
          fileSizeMB: (fileSize / 1024 / 1024).toFixed(2),
          maxFileSizeMB: maxFileSize / 1024 / 1024
        },
        [
          'Compress your image to reduce file size',
          'Use a lower resolution or quality setting',
          'Try uploading a different image'
        ]
      );
      
      logError(requestId, 'VALIDATION_FAILED', 'File too large', { fileSize, maxFileSize });
      
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate content type
    const allowedContentTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (contentType && !allowedContentTypes.includes(contentType)) {
      const errorResponse = createErrorResponse(
        'Invalid content type',
        `Content type '${contentType}' is not supported`,
        'INVALID_CONTENT_TYPE',
        requestId,
        { 
          contentType,
          allowedContentTypes,
          filename
        },
        [
          `Use one of the supported content types: ${allowedContentTypes.join(', ')}`,
          'Ensure your file is actually an image',
          'Check that the file is not corrupted'
        ]
      );
      
      logError(requestId, 'VALIDATION_FAILED', 'Invalid content type', { contentType, allowedContentTypes });
      
      return NextResponse.json(errorResponse, { status: 400 });
    }
    
    // Validate request body
    if (!request.body) {
      const errorResponse = createErrorResponse(
        'Empty request body',
        'No file data received in request body',
        'EMPTY_BODY',
        requestId,
        { contentLength, contentType },
        [
          'Ensure file data is included in the request body',
          'Check that the file is not empty',
          'Verify the request is using POST method with proper content-type'
        ]
      );
      
      logError(requestId, 'VALIDATION_FAILED', 'Empty request body', requestContext);
      
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate environment configuration
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const errorResponse = createErrorResponse(
        'Configuration error',
        'Blob storage not configured',
        'MISSING_BLOB_TOKEN',
        requestId,
        undefined,
        [
          'Configure BLOB_READ_WRITE_TOKEN environment variable',
          'Contact system administrator if this persists'
        ]
      );
      
      logError(requestId, 'CONFIG_ERROR', 'Missing BLOB_READ_WRITE_TOKEN', requestContext);
      
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFilename = `${modelName}/${timestamp}-${filename}`;
    
    logSuccess(requestId, 'FILENAME_GENERATED', {
      originalFilename: filename,
      uniqueFilename,
      modelName,
      timestamp
    });
    
    try {
      // Attempt blob upload with retry logic and circuit breaker
      logSuccess(requestId, 'BLOB_UPLOAD_START', {
        filename: uniqueFilename,
        contentType: contentType || 'application/octet-stream'
      });

      const uploadResult = await blobCircuitBreaker.execute(async () => {
        return await blobOperationWithRetry(async () => {
          return await put(uniqueFilename, request.body as ReadableStream, {
            access: 'public',
            token: process.env.BLOB_READ_WRITE_TOKEN,
            contentType: contentType || 'application/octet-stream',
          });
        }, {
          maxRetries: 3,
          baseDelay: 1000,
          onRetry: (attempt, error) => {
            logError(requestId, `BLOB_UPLOAD_RETRY_${attempt}`, error, {
              filename: uniqueFilename,
              attempt,
              error: error.message
            });
          }
        });
      });

      if (!uploadResult.success) {
        throw uploadResult.error;
      }

      const blob = uploadResult.data!;
      
      // Log successful upload
      logSuccess(requestId, 'BLOB_UPLOAD_SUCCESS', {
        url: blob.url,
        downloadUrl: blob.downloadUrl,
        pathname: blob.pathname,
        size: blob.size,
        attempts: uploadResult.attempts,
        totalTime: uploadResult.totalTime
      });
      
      // Return success response with additional metadata
      return NextResponse.json({
        ...blob,
        requestId,
        timestamp: new Date().toISOString(),
        originalFilename: filename,
        modelName,
        uploadMetadata: {
          attempts: uploadResult.attempts,
          totalTime: uploadResult.totalTime
        }
      });
      
    } catch (blobError) {
      const errorDetails = {
        blobError: blobError instanceof Error ? {
          message: blobError.message,
          name: blobError.name,
          stack: blobError.stack
        } : String(blobError),
        uploadAttempt: {
          filename: uniqueFilename,
          contentType: contentType || 'application/octet-stream',
          hasToken: !!process.env.BLOB_READ_WRITE_TOKEN
        }
      };
      
      logError(requestId, 'BLOB_UPLOAD_FAILED', blobError, errorDetails);
      
      const errorResponse = createErrorResponse(
        'Upload failed',
        `Failed to upload file to blob storage: ${blobError instanceof Error ? blobError.message : String(blobError)}`,
        'BLOB_UPLOAD_ERROR',
        requestId,
        errorDetails,
        [
          'Check if the file size is within limits',
          'Verify blob storage configuration',
          'Try uploading a smaller file to test',
          'Contact support if the issue persists'
        ]
      );
      
      return NextResponse.json(errorResponse, { status: 500 });
    }

  } catch (error) {
    const errorDetails = {
      error: error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : String(error),
      request: {
        url: request.url,
        method: request.method
      }
    };
    
    logError(requestId, 'UNEXPECTED_ERROR', error, errorDetails);
    
    const errorResponse = createErrorResponse(
      'Unexpected error',
      error instanceof Error ? error.message : 'An unexpected error occurred',
      'INTERNAL_ERROR',
      requestId,
      errorDetails,
      [
        'Try the request again',
        'Check if all required headers are present',
        'Contact support if the issue persists'
      ]
    );
    
    return NextResponse.json(errorResponse, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }
}
