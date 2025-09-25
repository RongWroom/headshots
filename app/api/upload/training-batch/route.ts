import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { TrainingDataIntegration } from '@/lib/training-data-integration';
import { z } from 'zod';

const BatchUploadSchema = z.object({
  files: z.array(z.object({
    name: z.string(),
    data: z.string(), // base64 encoded
    type: z.string()
  })).min(1).max(20),
  modelName: z.string().min(1).max(50),
  options: z.object({
    requireFaceDetection: z.boolean().optional().default(true),
    enableEnhancement: z.boolean().optional().default(true),
    enableDeduplication: z.boolean().optional().default(true),
    qualityThreshold: z.number().min(0.1).max(1.0).optional().default(0.6),
    targetResolution: z.number().min(512).max(2048).optional().default(1024)
  }).optional().default({})
});

export async function POST(request: NextRequest) {
  const requestId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`[${requestId}] Starting batch training data upload`);
    
    const body = await request.json();
    
    // Validate request
    const validationResult = BatchUploadSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.errors,
          requestId
        },
        { status: 400 }
      );
    }

    const { files, modelName, options } = validationResult.data;
    
    console.log(`[${requestId}] Processing ${files.length} files for model: ${modelName}`);

    // Step 1: Upload files to blob storage
    const uploadedUrls: string[] = [];
    const uploadErrors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Validate file format
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
          uploadErrors.push(`File ${file.name}: Invalid type ${file.type}`);
          continue;
        }

        // Decode base64 data
        const buffer = Buffer.from(file.data, 'base64');
        
        // Validate file size (10MB limit)
        if (buffer.length > 10 * 1024 * 1024) {
          uploadErrors.push(`File ${file.name}: Too large (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
          continue;
        }

        // Generate unique filename
        const timestamp = Date.now();
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const uniqueFilename = `${modelName}/training/${timestamp}-${i}-${file.name}`;

        // Upload to blob storage
        const blob = await put(uniqueFilename, buffer, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN,
          contentType: file.type,
        });

        uploadedUrls.push(blob.url);
        console.log(`[${requestId}] Uploaded file ${i + 1}/${files.length}: ${blob.url}`);

      } catch (error) {
        uploadErrors.push(`File ${file.name}: Upload failed - ${error}`);
        console.error(`[${requestId}] Upload error for ${file.name}:`, error);
      }
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json(
        {
          error: 'No files uploaded successfully',
          details: uploadErrors,
          requestId
        },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] Successfully uploaded ${uploadedUrls.length} files`);

    // Step 2: Validate and process training data
    const integration = new TrainingDataIntegration();
    
    console.log(`[${requestId}] Starting training data validation and processing`);
    
    const processingResult = await integration.prepareTrainingData(uploadedUrls, options);

    // Step 3: Generate training configurations
    let trainingConfigs = null;
    if (processingResult.isReady) {
      const triggerWord = `sks${modelName.substring(0, 6).toLowerCase()}`;
      trainingConfigs = integration.generateTrainingConfig(
        processingResult,
        modelName,
        triggerWord
      );
    }

    // Step 4: Prepare response
    const response = {
      success: true,
      requestId,
      uploadSummary: {
        totalFiles: files.length,
        uploadedFiles: uploadedUrls.length,
        uploadErrors: uploadErrors.length,
        uploadedUrls
      },
      validation: {
        isReady: processingResult.isReady,
        totalImages: processingResult.validationResult.totalImages,
        validImages: processingResult.validationResult.validImages,
        duplicatesRemoved: processingResult.validationResult.duplicatesRemoved,
        lowQualityRemoved: processingResult.validationResult.lowQualityRemoved,
        noFaceRemoved: processingResult.validationResult.noFaceRemoved,
        overallQualityScore: processingResult.validationResult.overallQualityScore,
        processedImageUrls: processingResult.processedImageUrls
      },
      optimization: {
        recommendedParameters: processingResult.optimizedParameters,
        estimatedTrainingTime: processingResult.estimatedTrainingTime,
        estimatedCost: processingResult.estimatedCost
      },
      trainingConfigs,
      recommendations: processingResult.validationResult.recommendations,
      warnings: [
        ...processingResult.warnings,
        ...processingResult.validationResult.warnings,
        ...uploadErrors
      ],
      errors: [
        ...processingResult.errors,
        ...processingResult.validationResult.errors
      ]
    };

    console.log(`[${requestId}] Batch processing completed:`, {
      ready: processingResult.isReady,
      validImages: processingResult.validationResult.validImages,
      qualityScore: processingResult.validationResult.overallQualityScore
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error(`[${requestId}] Batch upload error:`, error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const integration = new TrainingDataIntegration();
    const stats = await integration.getProcessingStats();

    return NextResponse.json({
      success: true,
      data: {
        processingStats: stats,
        supportedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        limits: {
          maxFiles: 20,
          maxFileSize: '10MB',
          minImages: 8,
          recommendedImages: '12-20'
        },
        defaultOptions: {
          requireFaceDetection: true,
          enableEnhancement: true,
          enableDeduplication: true,
          qualityThreshold: 0.6,
          targetResolution: 1024
        }
      }
    });

  } catch (error) {
    console.error('Batch upload stats error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}