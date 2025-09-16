import { NextResponse } from 'next/server';
import { TrainingInputValidator } from '@/lib/validation';

export const dynamic = "force-dynamic";

/**
 * Endpoint to validate training inputs before submitting to Replicate
 * This helps catch issues early and provide better error messages
 */
export async function POST(req: Request) {
  try {
    const requestData = await req.json();
    
    // Perform comprehensive validation
    const validationResult = await TrainingInputValidator.validateTrainingInputs(requestData);
    
    // Also validate API configurations
    const replicateConfig = TrainingInputValidator.validateReplicateConfig();
    const blobConfig = TrainingInputValidator.validateBlobConfig();
    
    const response = {
      validation: validationResult,
      configuration: {
        replicate: replicateConfig,
        blob: blobConfig
      },
      timestamp: new Date().toISOString(),
      canProceed: validationResult.isValid && replicateConfig.isValid && blobConfig.isValid
    };
    
    // Return 400 if validation fails, 200 if successful
    const statusCode = response.canProceed ? 200 : 400;
    
    return NextResponse.json(response, { 
      status: statusCode,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('Validation endpoint error:', error);
    
    return NextResponse.json(
      {
        error: 'Validation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check validation service health
 */
export async function GET() {
  try {
    // Test validation with sample data
    const sampleData = {
      imageUrls: ['https://example.com/test.jpg'],
      modelName: 'test-model',
      trainingConfig: {
        trigger_word: 'test'
      }
    };
    
    const validationResult = TrainingInputValidator.validateRequestSchema(sampleData);
    const replicateConfig = TrainingInputValidator.validateReplicateConfig();
    const blobConfig = TrainingInputValidator.validateBlobConfig();
    
    return NextResponse.json({
      status: 'healthy',
      message: 'Validation service is operational',
      schemaValidation: validationResult.isValid,
      configuration: {
        replicate: replicateConfig,
        blob: blobConfig
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        message: 'Validation service error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}