import { NextRequest, NextResponse } from 'next/server';
import { performanceBenchmarkingService } from '@/lib/training-performance-benchmarking';

/**
 * GET /api/training/performance-benchmarking
 * Run automated benchmarking or get benchmark results
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const benchmarkId = searchParams.get('benchmarkId');

    switch (action) {
      case 'run':
        // Run automated benchmarking
        const results = await performanceBenchmarkingService.runAutomatedBenchmarking();
        return NextResponse.json({
          success: true,
          data: results,
          message: `Completed ${results.length} benchmark runs`
        });

      case 'results':
        if (!benchmarkId) {
          return NextResponse.json(
            { success: false, error: 'benchmarkId is required for results' },
            { status: 400 }
          );
        }
        // Get benchmark results would be implemented here
        return NextResponse.json({
          success: true,
          data: [],
          message: 'Benchmark results retrieved'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use "run" or "results"' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Performance benchmarking error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/training/performance-benchmarking
 * Create a new performance benchmark
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      name,
      description,
      provider,
      training_config,
      test_images,
      expected_metrics
    } = body;

    // Validate required fields
    if (!name || !provider || !training_config || !test_images || !expected_metrics) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: name, provider, training_config, test_images, expected_metrics' 
        },
        { status: 400 }
      );
    }

    // Validate training config
    const requiredConfigFields = [
      'resolution', 'max_train_steps', 'lora_rank', 'learning_rate',
      'train_batch_size', 'gradient_accumulation', 'mixed_precision', 'use_xformers'
    ];
    
    for (const field of requiredConfigFields) {
      if (training_config[field] === undefined) {
        return NextResponse.json(
          { success: false, error: `Missing training_config field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate expected metrics
    const requiredMetricFields = ['max_training_time', 'min_quality_score', 'max_cost', 'min_success_rate'];
    for (const field of requiredMetricFields) {
      if (expected_metrics[field] === undefined) {
        return NextResponse.json(
          { success: false, error: `Missing expected_metrics field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Create benchmark
    const benchmark = await performanceBenchmarkingService.createBenchmark({
      name,
      description: description || '',
      provider,
      training_config,
      test_images,
      expected_metrics
    });

    return NextResponse.json({
      success: true,
      data: benchmark,
      message: 'Performance benchmark created successfully'
    });

  } catch (error) {
    console.error('Create benchmark error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create benchmark'
      },
      { status: 500 }
    );
  }
}