// Training Queue Entry Management API

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { trainingQueueService } from '../../../../../lib/training-queue';
import { UpdateQueueEntryRequest } from '../../../../../types/training-queue';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/training/queue/[id] - Get specific queue entry
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { data: queueEntry, error } = await supabase
      .from('training_queue')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Queue entry not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching queue entry:', error);
      return NextResponse.json(
        { error: 'Failed to fetch queue entry' },
        { status: 500 }
      );
    }

    return NextResponse.json(queueEntry);

  } catch (error) {
    console.error('Error in GET /api/training/queue/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/training/queue/[id] - Update queue entry (for system use)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // This endpoint is primarily for system/service use
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const body: UpdateQueueEntryRequest = await request.json();

    // Update the queue entry
    const updatedEntry = await trainingQueueService.updateQueueEntry(params.id, body);

    return NextResponse.json(updatedEntry);

  } catch (error: any) {
    console.error('Error in PATCH /api/training/queue/[id]:', error);

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

// DELETE /api/training/queue/[id] - Cancel queue entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Cancel the training job
    await trainingQueueService.cancelTraining(params.id, user.id);

    return NextResponse.json({ message: 'Training job cancelled successfully' });

  } catch (error: any) {
    console.error('Error in DELETE /api/training/queue/[id]:', error);

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