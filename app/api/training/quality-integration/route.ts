import { NextRequest, NextResponse } from 'next/server';
import { TrainingQualityIntegration, DEFAULT_TRAINING_QUALITY_CONFIG } from '@/lib/training-quality-integration';

export async function POST(request: NextRequest) {
  try {
    const {
      modelId,
      generatedImageUrl,
      originalImageUrls,
      config = DEFAULT_TRAINING_QUALITY_CONFIG,
    } = await request.json();

    if (!modelId || !generatedImageUrl || !originalImageUrls) {
      return NextResponse.json(
        { error: 'Missing required parameters: modelId, generatedImageUrl, originalImageUrls' },
        { status: 400 }
      );
    }

    if (!Array.isArray(originalImageUrls) || originalImageUrls.length === 0) {
      return NextResponse.json(
        { error: 'originalImageUrls must be a non-empty array' },
        { status: 400 }
      );
    }

    const qualityIntegration = new TrainingQualityIntegration();
    const result = await qualityIntegration.assessTrainingCompletion(
      modelId,
      generatedImageUrl,
      originalImageUrls,
      config
    );

    return NextResponse.json({
      success: true,
      modelId,
      qualityAssessment: result.qualityResult,
      monitoringAlerts: result.monitoringAlerts,
      retrainingRecommended: result.retrainingRecommended,
      actions: result.actions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Training quality integration error:', error);
    return NextResponse.json(
      { error: 'Failed to integrate quality assessment', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const action = searchParams.get('action');

    if (!modelId) {
      return NextResponse.json(
        { error: 'Missing required parameter: modelId' },
        { status: 400 }
      );
    }

    const qualityIntegration = new TrainingQualityIntegration();

    if (action === 'report') {
      // Get comprehensive quality report
      const report = await qualityIntegration.getQualityReport(modelId);
      
      return NextResponse.json({
        success: true,
        modelId,
        report,
      });
    }

    if (action === 'validate') {
      // Validate training images (requires imageUrls in query params)
      const imageUrlsParam = searchParams.get('imageUrls');
      if (!imageUrlsParam) {
        return NextResponse.json(
          { error: 'Missing imageUrls parameter for validation' },
          { status: 400 }
        );
      }

      try {
        const imageUrls = JSON.parse(imageUrlsParam);
        const validation = await qualityIntegration.validateTrainingImages(imageUrls);
        
        return NextResponse.json({
          success: true,
          validation,
        });
      } catch (parseError) {
        return NextResponse.json(
          { error: 'Invalid imageUrls parameter format' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "report" or "validate"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Training quality integration retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve quality integration data', details: error.message },
      { status: 500 }
    );
  }
}