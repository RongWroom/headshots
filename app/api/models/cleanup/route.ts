// Model Cleanup API Endpoints
// Handles automatic cleanup of expired models and storage management

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ModelStorageServiceImpl, SupabaseStorageProvider } from '../../../../lib/model-storage-service';
import { ModelCleanupOptions, ModelStorageError } from '../../../../types/model-storage';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const storageProvider = new SupabaseStorageProvider(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  'model-weights'
);

const modelStorageService = new ModelStorageServiceImpl(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  storageProvider
);

// GET /api/models/cleanup - Get cleanup logs and statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('model_cleanup_log')
      .select(`
        *,
        models(id, name, user_id)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      // Filter by user's models
      query = query.eq('models.user_id', userId);
    }

    const { data: cleanupLogs, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch cleanup logs: ${error.message}`);
    }

    // Get cleanup statistics
    const { data: stats, error: statsError } = await supabase
      .from('model_cleanup_log')
      .select('cleanup_type, bytes_freed')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

    if (statsError) {
      console.warn('Failed to fetch cleanup stats:', statsError);
    }

    const cleanupStats = {
      total_operations: cleanupLogs?.length || 0,
      total_bytes_freed: stats?.reduce((sum, log) => sum + (log.bytes_freed || 0), 0) || 0,
      operations_by_type: stats?.reduce((acc, log) => {
        acc[log.cleanup_type] = (acc[log.cleanup_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {}
    };

    return NextResponse.json({
      success: true,
      data: {
        logs: cleanupLogs || [],
        stats: cleanupStats,
        pagination: {
          limit,
          offset,
          hasMore: (cleanupLogs?.length || 0) === limit
        }
      }
    });
  } catch (error) {
    console.error('Get cleanup logs error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/models/cleanup - Trigger cleanup operation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const options: ModelCleanupOptions = {
      cleanup_expired: body.cleanup_expired !== false,
      cleanup_inactive_days: body.cleanup_inactive_days,
      max_versions_per_model: body.max_versions_per_model,
      max_storage_per_user_gb: body.max_storage_per_user_gb,
      dry_run: body.dry_run || false
    };

    // Validate cleanup options
    if (options.cleanup_inactive_days && options.cleanup_inactive_days < 1) {
      return NextResponse.json(
        { success: false, error: 'cleanup_inactive_days must be at least 1' },
        { status: 400 }
      );
    }

    if (options.max_versions_per_model && options.max_versions_per_model < 1) {
      return NextResponse.json(
        { success: false, error: 'max_versions_per_model must be at least 1' },
        { status: 400 }
      );
    }

    const result = await modelStorageService.cleanupExpiredModels(options);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Cleanup operation error:', error);
    
    if (error instanceof ModelStorageError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/models/cleanup - Delete specific cleanup log
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const logId = searchParams.get('logId');

    if (!logId) {
      return NextResponse.json(
        { success: false, error: 'Missing logId parameter' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('model_cleanup_log')
      .delete()
      .eq('id', logId);

    if (error) {
      throw new Error(`Failed to delete cleanup log: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Cleanup log deleted successfully'
    });
  } catch (error) {
    console.error('Delete cleanup log error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}