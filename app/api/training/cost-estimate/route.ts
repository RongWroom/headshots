/**
 * Training Cost Estimation API
 * Provides cost estimates before training starts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { costTrackingService, CostEstimateRequest } from '@/lib/cost-tracking';
import { Logger } from '@/lib/logger';

const logger = new Logger('COST_ESTIMATE_API');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { serviceProvider, imageCount, trainingParameters, userId } = body;
    
    if (!serviceProvider || !imageCount || !trainingParameters || !userId) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          required: ['serviceProvider', 'imageCount', 'trainingParameters', 'userId']
        },
        { status: 400 }
      );
    }

    // Validate service provider
    const validProviders = ['runpod', 'fal', 'replicate'];
    if (!validProviders.includes(serviceProvider)) {
      return NextResponse.json(
        { 
          error: 'Invalid service provider',
          validProviders
        },
        { status: 400 }
      );
    }

    // Validate image count
    if (imageCount < 1 || imageCount > 100) {
      return NextResponse.json(
        { error: 'Image count must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Validate training parameters
    const requiredParams = ['resolution', 'maxTrainSteps', 'loraRank', 'trainBatchSize'];
    for (const param of requiredParams) {
      if (!(param in trainingParameters)) {
        return NextResponse.json(
          { 
            error: `Missing training parameter: ${param}`,
            requiredParameters: requiredParams
          },
          { status: 400 }
        );
      }
    }

    // Create cost estimate request
    const estimateRequest: CostEstimateRequest = {
      serviceProvider,
      imageCount,
      trainingParameters,
      userId
    };

    logger.logInfo('COST_ESTIMATE_REQUEST', {
      provider: serviceProvider,
      imageCount,
      userId
    });

    // Generate cost estimate
    const estimate = await costTrackingService.generateCostEstimate(estimateRequest);

    logger.logSuccess('COST_ESTIMATE_GENERATED', {
      estimateId: estimate.id,
      estimatedCost: estimate.estimatedCost,
      provider: serviceProvider
    });

    return NextResponse.json({
      success: true,
      estimate: {
        id: estimate.id,
        serviceProvider: estimate.serviceProvider,
        estimatedCost: estimate.estimatedCost,
        currency: estimate.currency,
        estimatedTrainingTimeMinutes: estimate.estimatedTrainingTimeMinutes,
        costBreakdown: estimate.costBreakdown,
        confidence: estimate.confidence,
        recommendations: generateRecommendations(estimate, imageCount)
      }
    });

  } catch (error: any) {
    logger.logError('COST_ESTIMATE_FAILED', {
      error: error.message,
      stack: error.stack
    });

    return NextResponse.json(
      { 
        error: 'Failed to generate cost estimate',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const days = parseInt(searchParams.get('days') || '30');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    // Get user's cost history
    const costHistory = await costTrackingService.getUserCostHistory(userId, days);
    
    // Calculate summary statistics
    const totalCost = costHistory.reduce((sum, cost) => sum + cost.totalCost, 0);
    const averageCost = costHistory.length > 0 ? totalCost / costHistory.length : 0;
    const providerBreakdown = costHistory.reduce((acc, cost) => {
      acc[cost.serviceProvider] = (acc[cost.serviceProvider] || 0) + cost.totalCost;
      return acc;
    }, {} as Record<string, number>);

    logger.logInfo('COST_HISTORY_RETRIEVED', {
      userId,
      days,
      totalJobs: costHistory.length,
      totalCost
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalCost: Math.round(totalCost * 100) / 100,
        averageCost: Math.round(averageCost * 100) / 100,
        totalJobs: costHistory.length,
        providerBreakdown,
        period: `${days} days`
      },
      history: costHistory.map(cost => ({
        id: cost.id,
        trainingId: cost.trainingId,
        serviceProvider: cost.serviceProvider,
        totalCost: cost.totalCost,
        currency: cost.currency,
        trainingDurationMinutes: cost.trainingDurationMinutes,
        status: cost.status,
        createdAt: cost.trainingStartTime,
        costBreakdown: cost.costBreakdown
      }))
    });

  } catch (error: any) {
    logger.logError('COST_HISTORY_FETCH_FAILED', {
      error: error.message
    });

    return NextResponse.json(
      { 
        error: 'Failed to fetch cost history',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate cost optimization recommendations
 */
function generateRecommendations(estimate: any, imageCount: number): string[] {
  const recommendations: string[] = [];

  // Cost-based recommendations
  if (estimate.estimatedCost > 5.00) {
    recommendations.push('Consider reducing training steps or image resolution to lower costs');
  }

  if (estimate.serviceProvider === 'replicate' && estimate.estimatedCost > 2.00) {
    recommendations.push('RunPod or Fal.ai may offer better value for this training job');
  }

  // Image count recommendations
  if (imageCount < 8) {
    recommendations.push('Consider adding more training images (8-20 recommended) for better results');
  } else if (imageCount > 30) {
    recommendations.push('You may be able to achieve similar results with fewer images to reduce costs');
  }

  // Time-based recommendations
  if (estimate.estimatedTrainingTimeMinutes > 45) {
    recommendations.push('Training time is high - consider reducing max training steps');
  }

  // Confidence-based recommendations
  if (estimate.confidence === 'low') {
    recommendations.push('Cost estimate has low confidence - actual costs may vary significantly');
  }

  return recommendations;
}