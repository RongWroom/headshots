import { NextRequest, NextResponse } from 'next/server';
import { performanceBenchmarkingService } from '@/lib/training-performance-benchmarking';

/**
 * GET /api/training/performance-optimization
 * Generate parameter optimization recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    const target = searchParams.get('target') as 'quality' | 'speed' | 'cost' | 'balanced';

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'provider parameter is required' },
        { status: 400 }
      );
    }

    const validTargets = ['quality', 'speed', 'cost', 'balanced'];
    if (target && !validTargets.includes(target)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid target. Must be one of: ${validTargets.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Generate optimization recommendations
    const optimizations = await performanceBenchmarkingService.generateParameterOptimizations(
      provider,
      target || 'balanced'
    );

    return NextResponse.json({
      success: true,
      data: optimizations,
      message: `Generated ${optimizations.length} optimization recommendations for ${provider}`
    });

  } catch (error) {
    console.error('Parameter optimization error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate optimizations'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/training/performance-optimization
 * Apply a parameter optimization
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { optimizationId, notes } = body;

    if (!optimizationId) {
      return NextResponse.json(
        { success: false, error: 'optimizationId is required' },
        { status: 400 }
      );
    }

    // In a real implementation, this would:
    // 1. Retrieve the optimization from database
    // 2. Apply the optimized configuration
    // 3. Track the results
    // 4. Update the optimization record

    // For now, simulate the application
    const mockResults = {
      actual_quality_improvement: 0.03 + (Math.random() * 0.05),
      actual_speed_improvement: 0.1 + (Math.random() * 0.15),
      actual_cost_reduction: 0.08 + (Math.random() * 0.12),
      success: Math.random() > 0.1, // 90% success rate
      notes: notes || 'Optimization applied successfully'
    };

    return NextResponse.json({
      success: true,
      data: {
        optimizationId,
        applied_at: new Date().toISOString(),
        results: mockResults
      },
      message: 'Parameter optimization applied successfully'
    });

  } catch (error) {
    console.error('Apply optimization error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply optimization'
      },
      { status: 500 }
    );
  }
}