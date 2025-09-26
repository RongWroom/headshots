// Training Queue Management API

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { trainingQueueService } from '../../../../lib/training-queue';
import { EnqueueTrainingRequest } from '../../../../types/training-queue';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/training/queue - Get user's queue status and entries
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Get user's queue entries
    const { data: queueEntries, error: queueError } = await supabase
      .from('training_queue')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (queueError) {
      console.error('Error fetching queue entries:', queueError);
      return NextResponse.json(
        { error: 'Failed to fetch queue entries' },
        { status: 500 }
      );
    }

    // Get user's rate limits
    const { data: rateLimits, error: rateLimitError } = await supabase
      .from('user_rate_limits')
      .select('*')
      .eq('user_id', user.id);

    if (rateLimitError) {
      console.error('Error fetching rate limits:', rateLimitError);
      return NextResponse.json(
        { error: 'Failed to fetch rate limits' },
        { status: 500 }
      );
    }

    // Get queue status
    const queueStatus = await trainingQueueService.getUserQueueStatus(user.id);

    // Get queue metrics
    const queueMetrics = await trainingQueueService.getQueueMetrics();

    // Get recent completions
    const { data: recentCompletions } = await supabase
      .from('training_queue')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['completed', 'failed'])
      .order('completion_time', { ascending: false })
      .limit(10);

    return NextResponse.json({
      user_queue_entries: queueEntries || [],
      user_rate_limits: rateLimits || [],
      queue_status: queueStatus,
      queue_metrics: queueMetrics,
      recent_completions: recentCompletions || []
    });

  } catch (error) {
    console.error('Error in GET /api/training/queue:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/training/queue - Enqueue a new training job
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    const body: EnqueueTrainingRequest = await request.json();

    // Validate request body
    if (!body.model_id || !body.training_config) {
      return NextResponse.json(
        { error: 'Missing required fields: model_id, training_config' },
        { status: 400 }
      );
    }

    // Validate training config
    if (!body.training_config.image_urls?.length) {
      return NextResponse.json(
        { error: 'Training config must include image_urls' },
        { status: 400 }
      );
    }

    // Enqueue the training job
    const result = await trainingQueueService.enqueueTraining(user.id, body);

    return NextResponse.json(result, { status: 201 });

  } catch (error: any) {
    console.error('Error in POST /api/training/queue:', error);

    // Handle specific error types
    if (error.name === 'RateLimitError') {
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code,
          details: error.details
        },
        { status: 429 }
      );
    }

    if (error.name === 'CapacityError') {
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code,
          details: error.details
        },
        { status: 503 }
      );
    }

    if (error.name === 'QueueError') {
      return NextResponse.json(
        { 
          error: error.message,
          code: error.code,
          details: error.details
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}