import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { put } from '@vercel/blob';
import { Logger, extractErrorDetails } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const MIN_FILES = 1;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

interface UploadedImage {
  filename: string;
  blobUrl: string;
  size: number;
}

// Validation helper
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File "${file.name}" exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File "${file.name}" has invalid type "${file.type}". Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
    };
  }

  // Check file extension
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `File "${file.name}" has invalid extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }

  return { valid: true };
}

export async function POST(req: Request) {
  const logger = new Logger('SEEDREAM_UPLOAD_API');
  
  // Create a response object for auth cookies
  const authResponse = new NextResponse();
  
  logger.logInfo('UPLOAD_REQUEST_START', {
    url: req.url,
    method: req.method,
    contentType: req.headers.get('content-type')
  });
  
  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.headers.get('cookie')?.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1];
        },
        set(name: string, value: string, options: any) {
          authResponse.cookies.set(name, value, options);
        },
        remove(name: string, options: any) {
          authResponse.cookies.set(name, '', options);
        },
      },
    }
  );
  
  try {
    // Authentication check
    logger.logInfo('AUTH_CHECK_START');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      const errorResponse = logger.createErrorResponse(
        'Authentication failed',
        'Please sign in to upload images',
        'UNAUTHORIZED',
        { authError: authError ? extractErrorDetails(authError) : 'No user found' },
        ['Sign in to your account', 'Check if your session has expired']
      );
      
      logger.logError('AUTH_FAILED', authError || 'No user found');
      
      return NextResponse.json(errorResponse, { 
        status: 401,
        headers: authResponse.headers
      });
    }

    const userId = user.id;
    logger.setUserId(userId);
    logger.logSuccess('AUTH_SUCCESS', { userId, userEmail: user.email });

    // Parse multipart form data
    logger.logInfo('FORM_DATA_PARSING_START');
    
    let formData: FormData;
    try {
      formData = await req.formData();
      logger.logSuccess('FORM_DATA_PARSED', {
        fieldCount: Array.from(formData.keys()).length
      });
    } catch (parseError) {
      const errorResponse = logger.createErrorResponse(
        'Invalid form data',
        'Failed to parse multipart form data',
        'INVALID_FORM_DATA',
        { parseError: extractErrorDetails(parseError) },
        ['Ensure Content-Type is multipart/form-data', 'Check that files are properly attached']
      );
      
      logger.logError('FORM_DATA_PARSE_FAILED', parseError);
      
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: authResponse.headers
      });
    }

    // Extract files from form data
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        files.push(value);
      }
    }

    logger.logInfo('FILES_EXTRACTED', { fileCount: files.length });

    // Validate file count
    if (files.length < MIN_FILES || files.length > MAX_FILES) {
      const errorResponse = logger.createErrorResponse(
        'Invalid file count',
        `Please upload between ${MIN_FILES} and ${MAX_FILES} images`,
        'INVALID_FILE_COUNT',
        { fileCount: files.length, minFiles: MIN_FILES, maxFiles: MAX_FILES },
        [`Upload at least ${MIN_FILES} image(s)`, `Upload no more than ${MAX_FILES} images`]
      );
      
      logger.logError('INVALID_FILE_COUNT', { fileCount: files.length });
      
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: authResponse.headers
      });
    }

    // Validate each file
    logger.logInfo('FILE_VALIDATION_START');
    
    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        const errorResponse = logger.createErrorResponse(
          'File validation failed',
          validation.error!,
          'INVALID_FILE',
          { 
            filename: file.name,
            size: file.size,
            type: file.type
          },
          [
            'Ensure all files are images (JPEG, PNG, or WebP)',
            `Ensure each file is under ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            'Remove any corrupted or invalid files'
          ]
        );
        
        logger.logError('FILE_VALIDATION_FAILED', validation.error);
        
        return NextResponse.json(errorResponse, { 
          status: 400,
          headers: authResponse.headers
        });
      }
    }

    logger.logSuccess('FILE_VALIDATION_SUCCESS', {
      validFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0)
    });

    // Validate Blob storage configuration
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const errorResponse = logger.createErrorResponse(
        'Configuration error',
        'Blob storage not configured',
        'MISSING_BLOB_TOKEN',
        undefined,
        ['Contact system administrator']
      );
      
      logger.logError('BLOB_NOT_CONFIGURED', 'Missing BLOB_READ_WRITE_TOKEN');
      
      return NextResponse.json(errorResponse, { 
        status: 500,
        headers: authResponse.headers
      });
    }

    // Generate unique upload ID
    const uploadId = crypto.randomUUID();
    const timestamp = Date.now();
    
    logger.logInfo('BLOB_UPLOAD_START', { uploadId, fileCount: files.length });

    // Upload files to Vercel Blob
    const uploadedImages: UploadedImage[] = [];
    const uploadErrors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const blobPath = `seedream-uploads/${userId}/${uploadId}/${timestamp}-${i}-${sanitizedFilename}`;
      
      try {
        logger.logInfo(`BLOB_UPLOAD_FILE_${i}`, {
          filename: file.name,
          blobPath,
          size: file.size
        });

        const blob = await put(blobPath, file, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN,
          contentType: file.type,
        });

        uploadedImages.push({
          filename: file.name,
          blobUrl: blob.url,
          size: file.size
        });

        logger.logSuccess(`BLOB_UPLOAD_FILE_${i}_SUCCESS`, {
          filename: file.name,
          url: blob.url
        });

      } catch (uploadError) {
        const errorMsg = `Failed to upload ${file.name}: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`;
        uploadErrors.push(errorMsg);
        
        logger.logError(`BLOB_UPLOAD_FILE_${i}_FAILED`, uploadError, {
          filename: file.name,
          blobPath
        });
      }
    }

    // If any uploads failed, cleanup successful uploads and return error
    if (uploadErrors.length > 0) {
      logger.logError('BLOB_UPLOAD_PARTIAL_FAILURE', uploadErrors, {
        successCount: uploadedImages.length,
        failureCount: uploadErrors.length
      });

      // TODO: Implement cleanup of successfully uploaded files
      // This would require importing @vercel/blob's del function
      
      const errorResponse = logger.createErrorResponse(
        'Upload failed',
        'One or more files failed to upload',
        'BLOB_UPLOAD_ERROR',
        { 
          uploadErrors,
          successfulUploads: uploadedImages.length,
          failedUploads: uploadErrors.length
        },
        [
          'Try uploading fewer files',
          'Check your internet connection',
          'Ensure all files are valid images',
          'Try again in a few moments'
        ]
      );
      
      return NextResponse.json(errorResponse, { 
        status: 500,
        headers: authResponse.headers
      });
    }

    logger.logSuccess('BLOB_UPLOAD_ALL_SUCCESS', {
      uploadId,
      fileCount: uploadedImages.length,
      totalSize: uploadedImages.reduce((sum, img) => sum + img.size, 0)
    });

    // Store upload metadata in Supabase
    logger.logInfo('DATABASE_INSERT_START', { uploadId });
    
    const { data: uploadRecord, error: dbError } = await supabase
      .from('seedream_uploads')
      .insert({
        id: uploadId,
        user_id: userId,
        images: uploadedImages
      })
      .select()
      .single();

    if (dbError || !uploadRecord) {
      const errorResponse = logger.createErrorResponse(
        'Database error',
        'Failed to save upload metadata',
        'DATABASE_ERROR',
        { dbError: dbError ? extractErrorDetails(dbError) : 'No record returned' },
        ['Try again in a few moments', 'Contact support if the issue persists']
      );
      
      logger.logError('DATABASE_INSERT_FAILED', dbError);
      
      // TODO: Cleanup uploaded blobs since database insert failed
      
      return NextResponse.json(errorResponse, { 
        status: 500,
        headers: authResponse.headers
      });
    }

    logger.logSuccess('DATABASE_INSERT_SUCCESS', {
      uploadId: uploadRecord.id,
      imageCount: uploadedImages.length
    });

    // Return success response
    const successResponse = {
      success: true,
      uploadId: uploadRecord.id,
      images: uploadedImages,
      expiresAt: uploadRecord.expires_at,
      message: `Successfully uploaded ${uploadedImages.length} image(s)`
    };

    logger.logSuccess('UPLOAD_COMPLETE', {
      uploadId: uploadRecord.id,
      imageCount: uploadedImages.length,
      expiresAt: uploadRecord.expires_at
    });

    // Record success metric
    await logger.recordMetric('upload_images', true);

    const response = NextResponse.json(successResponse);
    
    // Copy auth cookies to the success response
    for (const [key, value] of authResponse.headers.entries()) {
      response.headers.set(key, value);
    }

    return response;

  } catch (error) {
    const errorResponse = logger.createErrorResponse(
      'Upload request failed',
      'An unexpected error occurred during upload',
      'UPLOAD_REQUEST_ERROR',
      { 
        error: extractErrorDetails(error),
        timestamp: new Date().toISOString()
      },
      [
        'Check your internet connection',
        'Ensure all files are valid images',
        'Try uploading fewer files',
        'Try again in a few moments',
        'Contact support if the issue persists'
      ]
    );
    
    logger.logError('UPLOAD_REQUEST_ERROR', error);
    
    // Record failure metric
    await logger.recordMetric('upload_images', false, extractErrorDetails(error).message);
    
    const response = NextResponse.json(errorResponse, { status: 500 });

    // Copy auth cookies to the error response
    for (const [key, value] of authResponse.headers.entries()) {
      response.headers.set(key, value);
    }

    return response;
  }
}
