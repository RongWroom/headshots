import { NextRequest, NextResponse } from 'next/server';
import { QualityAssessmentService, DEFAULT_QUALITY_THRESHOLDS } from '@/lib/quality-assessment';

export async function POST(request: NextRequest) {
  try {
    const {
      modelId,
      generatedImageUrl,
      originalImageUrls,
      thresholds = DEFAULT_QUALITY_THRESHOLDS,
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

    const qualityService = new QualityAssessmentService();
    const result = await qualityService.assessTrainingQuality(
      modelId,
      generatedImageUrl,
      originalImageUrls,
      thresholds
    );

    return NextResponse.json({
      success: true,
      assessment: result,
    });
  } catch (error) {
    console.error('Quality assessment error:', error);
    return NextResponse.json(
      { error: 'Failed to assess training quality', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json(
        { error: 'Missing required parameter: modelId' },
        { status: 400 }
      );
    }

    const qualityService = new QualityAssessmentService();
    const history = await qualityService.getQualityHistory(modelId);
    const retrainingCheck = await qualityService.checkRetrainingNeeded(modelId);

    return NextResponse.json({
      success: true,
      modelId,
      qualityHistory: history,
      retrainingStatus: retrainingCheck,
    });
  } catch (error) {
    console.error('Quality history retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve quality history', details: error.message },
      { status: 500 }
    );
  }
}