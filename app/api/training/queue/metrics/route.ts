// Training Queue Metrics API

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { trainingQueueService } from '../../../../../lib/training-queue';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/training/queue/metrics - Get queue metrics and statistics
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

    // Get queue metrics
    const queueMetrics = await trainingQueueService.getQueueMetrics();

    // Get historical statistics (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: historicalStats, error: statsError } = await supabase
      .from('queue_statistics')
      .select('*')
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (statsError) {
      console.error('Error fetching historical statistics:', statsError);
      return NextResponse.json(
        { error: 'Failed to fetch historical statistics' },
        { status: 500 }
      );
    }

    // Get provider capacity information
    const { data: providerCapacity, error: capacityError } = await supabase
      .from('provider_capacity')
      .select('*')
      .order('provider');

    if (capacityError) {
      console.error('Error fetching provider capacity:', capacityError);
      return NextResponse.json(
        { error: 'Failed to fetch provider capacity' },
        { status: 500 }
      );
    }

    // Get user's personal statistics
    const { data: userStats, error: userStatsError } = await supabase
      .from('training_history_summary')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (userStatsError) {
      console.error('Error fetching user statistics:', userStatsError);
      return NextResponse.json(
        { error: 'Failed to fetch user statistics' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      queue_metrics: queueMetrics,
      historical_statistics: historicalStats || [],
      provider_capacity: providerCapacity || [],
      user_statistics: userStats || []
    });

  } catch (error) {
    console.error('Error in GET /api/training/queue/metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}