import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/training/regression-alerts
 * Get regression alerts with filtering options
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const resolved = searchParams.get('resolved');
    const benchmarkId = searchParams.get('benchmarkId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('regression_alerts')
      .select('*')
      .order('detected_at', { ascending: false });

    // Apply filters
    if (severity) {
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      if (!validSeverities.includes(severity)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` 
          },
          { status: 400 }
        );
      }
      query = query.eq('severity', severity);
    }

    if (resolved !== null) {
      const isResolved = resolved === 'true';
      if (isResolved) {
        query = query.not('resolved_at', 'is', null);
      } else {
        query = query.is('resolved_at', null);
      }
    }

    if (benchmarkId) {
      query = query.eq('benchmark_id', benchmarkId);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: alerts, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch regression alerts' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('regression_alerts')
      .select('*', { count: 'exact', head: true });

    if (severity) countQuery = countQuery.eq('severity', severity);
    if (resolved !== null) {
      const isResolved = resolved === 'true';
      if (isResolved) {
        countQuery = countQuery.not('resolved_at', 'is', null);
      } else {
        countQuery = countQuery.is('resolved_at', null);
      }
    }
    if (benchmarkId) countQuery = countQuery.eq('benchmark_id', benchmarkId);

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.warn('Failed to get count:', countError);
    }

    return NextResponse.json({
      success: true,
      data: {
        alerts: alerts || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (count || 0) > offset + limit
        }
      },
      message: `Retrieved ${alerts?.length || 0} regression alerts`
    });

  } catch (error) {
    console.error('Get regression alerts error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get regression alerts'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/training/regression-alerts
 * Resolve a regression alert
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId, resolutionNotes, action } = body;

    if (!alertId) {
      return NextResponse.json(
        { success: false, error: 'alertId is required' },
        { status: 400 }
      );
    }

    if (!action || !['resolve', 'acknowledge'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be either "resolve" or "acknowledge"' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if alert exists
    const { data: existingAlert, error: fetchError } = await supabase
      .from('regression_alerts')
      .select('*')
      .eq('id', alertId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Regression alert not found' },
          { status: 404 }
        );
      }
      console.error('Database error:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch regression alert' },
        { status: 500 }
      );
    }

    if (existingAlert.resolved_at) {
      return NextResponse.json(
        { success: false, error: 'Alert is already resolved' },
        { status: 400 }
      );
    }

    // Update alert based on action
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (action === 'resolve') {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolution_notes = resolutionNotes || 'Alert resolved';
    } else if (action === 'acknowledge') {
      updateData.acknowledged_at = new Date().toISOString();
      updateData.acknowledgment_notes = resolutionNotes || 'Alert acknowledged';
    }

    const { data: updatedAlert, error: updateError } = await supabase
      .from('regression_alerts')
      .update(updateData)
      .eq('id', alertId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update regression alert' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedAlert,
      message: `Regression alert ${action}d successfully`
    });

  } catch (error) {
    console.error('Resolve regression alert error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resolve regression alert'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/training/regression-alerts
 * Delete resolved regression alerts (cleanup)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const olderThanDays = parseInt(searchParams.get('olderThanDays') || '30');
    const onlyResolved = searchParams.get('onlyResolved') !== 'false';

    if (olderThanDays < 1 || olderThanDays > 365) {
      return NextResponse.json(
        { success: false, error: 'olderThanDays must be between 1 and 365' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deleteQuery = supabase
      .from('regression_alerts')
      .delete()
      .lt('detected_at', cutoffDate.toISOString());

    if (onlyResolved) {
      deleteQuery = deleteQuery.not('resolved_at', 'is', null);
    }

    deleteQuery = deleteQuery.select();

    const { data, error } = await deleteQuery;

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete regression alerts' },
        { status: 500 }
      );
    }

    const deletedCount = data?.length || 0;

    return NextResponse.json({
      success: true,
      data: { deletedCount },
      message: `Deleted ${deletedCount} regression alerts older than ${olderThanDays} days`
    });

  } catch (error) {
    console.error('Delete regression alerts error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete regression alerts'
      },
      { status: 500 }
    );
  }
}