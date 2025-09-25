import { NextRequest, NextResponse } from 'next/server';
import { TrainingDataProcessor, ProcessingOptions } from '@/lib/training-data-processor';
import { z } from 'zod';

const ValidationRequestSchema = z.object({
  imageUrls: z.array(z.string().url()).min(1).max(20),
  options: z.object({
    targetResolution: z.number().min(512).max(2048).optional(),
    minResolution: z.number().min(256).max(1024).optional(),
    maxResolution: z.number().min(1024).max(4096).optional(),
    requireFaceDetection: z.boolean().optional(),
    minFaceSize: z.number().min(50).max(200).optional(),
    maxFaceSize: z.number().min(400).max(1000).optional(),
    qualityThreshold: z.number().min(0.1).max(1.0).optional(),
    enableEnhancement: z.boolean().optional(),
    enableDeduplication: z.boolean().optional(),
    outputFormat: z.enum(['jpeg', 'png', 'webp']).optional(),
    outputQuality: z.number().min(70).max(100).optional(),
    cropToFace: z.boolean().optional(),
    facePadding: z.number().min(0.1).max(0.8).optional()
  }).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const validationResult = ValidationRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { imageUrls, options = {} } = validationResult.data;

    // Initialize processor
    const processor = new TrainingDataProcessor();

    // Process training data
    const result = await processor.processTrainingData(imageUrls, options);

    // Return results
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Training data validation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const processor = new TrainingDataProcessor();
    const stats = await processor.getProcessingStats();

    return NextResponse.json({
      success: true,
      data: {
        stats,
        defaultOptions: {
          targetResolution: 1024,
          minResolution: 512,
          maxResolution: 2048,
          requireFaceDetection: true,
          minFaceSize: 80,
          maxFaceSize: 800,
          qualityThreshold: 0.6,
          enableEnhancement: true,
          enableDeduplication: true,
          outputFormat: 'jpeg',
          outputQuality: 95,
          cropToFace: true,
          facePadding: 0.3
        }
      }
    });

  } catch (error) {
    console.error('Training data stats error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}