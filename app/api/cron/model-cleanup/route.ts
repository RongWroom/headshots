// Model Cleanup Cron Job API
// Handles scheduled cleanup operations via cron jobs or manual triggers

import { NextRequest, NextResponse } from 'next/server';
import { getCleanupScheduler } from '../../../../lib/model-cleanup-scheduler';

// Verify cron job authentication
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.warn('CRON_SECRET not configured, allowing all requests');
    return true;
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

// POST /api/cron/model-cleanup - Trigger cleanup operation
export async function POST(request: NextRequest) {
  try {
    // Verify authentication for cron jobs
    if (!verifyCronAuth(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      cleanup_expired = true,
      cleanup_inactive_days,
      max_versions_per_model,
      max_storage_per_user_gb,
      dry_run = false
    } = body;

    console.log('Starting scheduled model cleanup operation...');
    
    const scheduler = getCleanupScheduler();
    await scheduler.runCleanup({
      cleanup_expired,
      cleanup_inactive_days,
      max_versions_per_model,
      max_storage_per_user_gb,
      dry_run
    });

    const stats = await scheduler.getCleanupStats();

    return NextResponse.json({
      success: true,
      message: 'Cleanup operation completed successfully',
      data: stats
    });
  } catch (error) {
    console.error('Cron cleanup operation failed:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Cleanup operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/cron/model-cleanup - Get cleanup status and statistics
export async function GET(request: NextRequest) {
  try {
    // Verify authentication for cron jobs
    if (!verifyCronAuth(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const scheduler = getCleanupScheduler();
    const stats = await scheduler.getCleanupStats();
    const config = scheduler.getConfiguration();
    const isRunning = scheduler.isSchedulerRunning();

    return NextResponse.json({
      success: true,
      data: {
        scheduler_status: isRunning ? 'running' : 'stopped',
        configuration: config,
        statistics: stats
      }
    });
  } catch (error) {
    console.error('Failed to get cleanup status:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get cleanup status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/cron/model-cleanup - Update cleanup configuration
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication for cron jobs
    if (!verifyCronAuth(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      intervalMinutes,
      maxStoragePerUserGB,
      maxVersionsPerModel,
      defaultExpirationDays,
      cleanupInactiveDays
    } = body;

    const scheduler = getCleanupScheduler();
    scheduler.updateConfiguration({
      intervalMinutes,
      maxStoragePerUserGB,
      maxVersionsPerModel,
      defaultExpirationDays,
      cleanupInactiveDays
    });

    return NextResponse.json({
      success: true,
      message: 'Cleanup configuration updated successfully',
      data: scheduler.getConfiguration()
    });
  } catch (error) {
    console.error('Failed to update cleanup configuration:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}