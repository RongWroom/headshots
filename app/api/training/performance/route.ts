import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';
import { performanceProfiler, createPerformanceReport } from '@/lib/performance-profiler';

/**
 * Training Performance API
 * Provides performance profiling and analysis for training operations
 */

export async function GET(request: NextRequest) {
  const logger = new Logger('training-performance');
  
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'profile';
    const profileId = searchParams.get('profileId');
    const trainingId = searchParams.get('trainingId');

    logger.logInfo('performance_request', { action, profileId, trainingId });

    switch (action) {
      case 'profile':
        return handleGetProfile(logger, profileId);
      case 'training':
        return handleGetTrainingProfiles(logger, trainingId);
      case 'compare':
        return handleCompareProfiles(logger, searchParams);
      case 'report':
        return handleGenerateReport(logger, profileId);
      case 'export':
        return handleExportProfile(logger, profileId, searchParams);
      default:
        return NextResponse.json(
          logger.createErrorResponse(
            'INVALID_ACTION',
            `Unknown performance action: ${action}`,
            'PERF_001'
          ),
          { status: 400 }
        );
    }
  } catch (error) {
    logger.logError('performance_error', error);
    return NextResponse.json(
      logger.createErrorResponse(
        'PERFORMANCE_ERROR',
        'Failed to process performance request',
        'PERF_500',
        { error: error instanceof Error ? error.message : String(error) }
      ),
      { status: 500 }
    );
  }
}

async function handleGetProfile(logger: Logger, profileId: string | null) {
  if (!profileId) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_PROFILE_ID',
        'Profile ID is required',
        'PERF_002'
      ),
      { status: 400 }
    );
  }

  const profile = performanceProfiler.getProfile(profileId);
  if (!profile) {
    return NextResponse.json(
      logger.createErrorResponse(
        'PROFILE_NOT_FOUND',
        `Profile ${profileId} not found`,
        'PERF_003'
      ),
      { status: 404 }
    );
  }

  logger.logSuccess('profile_retrieved', { profileId, trainingId: profile.trainingId });

  return NextResponse.json({
    success: true,
    data: profile,
    timestamp: new Date().toISOString()
  });
}

async function handleGetTrainingProfiles(logger: Logger, trainingId: string | null) {
  if (!trainingId) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_TRAINING_ID',
        'Training ID is required',
        'PERF_004'
      ),
      { status: 400 }
    );
  }

  const profiles = performanceProfiler.getTrainingProfiles(trainingId);

  logger.logSuccess('training_profiles_retrieved', { 
    trainingId, 
    profileCount: profiles.length 
  });

  return NextResponse.json({
    success: true,
    data: {
      trainingId,
      profiles,
      count: profiles.length
    },
    timestamp: new Date().toISOString()
  });
}

async function handleCompareProfiles(logger: Logger, searchParams: URLSearchParams) {
  const profileIdsParam = searchParams.get('profileIds');
  if (!profileIdsParam) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_PROFILE_IDS',
        'Profile IDs are required for comparison',
        'PERF_005'
      ),
      { status: 400 }
    );
  }

  const profileIds = profileIdsParam.split(',');
  if (profileIds.length < 2) {
    return NextResponse.json(
      logger.createErrorResponse(
        'INSUFFICIENT_PROFILES',
        'At least 2 profiles are required for comparison',
        'PERF_006'
      ),
      { status: 400 }
    );
  }

  try {
    const comparison = performanceProfiler.compareProfiles(profileIds);

    logger.logSuccess('profiles_compared', { 
      profileIds, 
      profileCount: comparison.profiles.length 
    });

    return NextResponse.json({
      success: true,
      data: comparison,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      logger.createErrorResponse(
        'COMPARISON_ERROR',
        error instanceof Error ? error.message : 'Failed to compare profiles',
        'PERF_007'
      ),
      { status: 400 }
    );
  }
}

async function handleGenerateReport(logger: Logger, profileId: string | null) {
  if (!profileId) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_PROFILE_ID',
        'Profile ID is required for report generation',
        'PERF_008'
      ),
      { status: 400 }
    );
  }

  const report = createPerformanceReport(profileId);
  if (report === 'Profile not found') {
    return NextResponse.json(
      logger.createErrorResponse(
        'PROFILE_NOT_FOUND',
        `Profile ${profileId} not found`,
        'PERF_009'
      ),
      { status: 404 }
    );
  }

  logger.logSuccess('report_generated', { profileId });

  const headers = new Headers();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `performance-report-${profileId}-${timestamp}.md`;
  
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  headers.set('Content-Type', 'text/markdown');

  return new NextResponse(report, { headers });
}

async function handleExportProfile(logger: Logger, profileId: string | null, searchParams: URLSearchParams) {
  if (!profileId) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_PROFILE_ID',
        'Profile ID is required for export',
        'PERF_010'
      ),
      { status: 400 }
    );
  }

  const format = searchParams.get('format') as 'json' | 'csv' | 'flamegraph' || 'json';

  try {
    const exportData = performanceProfiler.exportProfile(profileId, format);

    logger.logSuccess('profile_exported', { profileId, format });

    const headers = new Headers();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance-${profileId}-${timestamp}.${format}`;
    
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    
    switch (format) {
      case 'csv':
        headers.set('Content-Type', 'text/csv');
        break;
      case 'flamegraph':
        headers.set('Content-Type', 'application/json');
        break;
      default:
        headers.set('Content-Type', 'application/json');
    }

    return new NextResponse(exportData, { headers });
  } catch (error) {
    return NextResponse.json(
      logger.createErrorResponse(
        'EXPORT_ERROR',
        error instanceof Error ? error.message : 'Failed to export profile',
        'PERF_011'
      ),
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const logger = new Logger('training-performance');
  
  try {
    const body = await request.json();
    const { action, data } = body;

    logger.logInfo('performance_post_request', { action });

    switch (action) {
      case 'start':
        return handleStartProfiling(logger, data);
      case 'stop':
        return handleStopProfiling(logger, data);
      case 'stage_start':
        return handleStartStage(logger, data);
      case 'stage_end':
        return handleEndStage(logger, data);
      case 'record_metrics':
        return handleRecordMetrics(logger, data);
      default:
        return NextResponse.json(
          logger.createErrorResponse(
            'INVALID_ACTION',
            `Unknown performance POST action: ${action}`,
            'PERF_012'
          ),
          { status: 400 }
        );
    }
  } catch (error) {
    logger.logError('performance_post_error', error);
    return NextResponse.json(
      logger.createErrorResponse(
        'PERFORMANCE_POST_ERROR',
        'Failed to process performance POST request',
        'PERF_500',
        { error: error instanceof Error ? error.message : String(error) }
      ),
      { status: 500 }
    );
  }
}

async function handleStartProfiling(logger: Logger, data: any) {
  const { trainingId } = data;
  
  if (!trainingId) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_TRAINING_ID',
        'Training ID is required to start profiling',
        'PERF_013'
      ),
      { status: 400 }
    );
  }

  const profileId = performanceProfiler.startProfiling(trainingId);

  logger.logSuccess('profiling_started', { trainingId, profileId });

  return NextResponse.json({
    success: true,
    data: { profileId, trainingId },
    timestamp: new Date().toISOString()
  });
}

async function handleStopProfiling(logger: Logger, data: any) {
  const { profileId } = data;
  
  if (!profileId) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_PROFILE_ID',
        'Profile ID is required to stop profiling',
        'PERF_014'
      ),
      { status: 400 }
    );
  }

  const profile = performanceProfiler.stopProfiling(profileId);
  
  if (!profile) {
    return NextResponse.json(
      logger.createErrorResponse(
        'PROFILE_NOT_FOUND',
        `Active profile ${profileId} not found`,
        'PERF_015'
      ),
      { status: 404 }
    );
  }

  logger.logSuccess('profiling_stopped', { 
    profileId, 
    trainingId: profile.trainingId,
    duration: profile.duration 
  });

  return NextResponse.json({
    success: true,
    data: profile,
    timestamp: new Date().toISOString()
  });
}

async function handleStartStage(logger: Logger, data: any) {
  const { profileId, stageName } = data;
  
  if (!profileId || !stageName) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_DATA',
        'Profile ID and stage name are required',
        'PERF_016'
      ),
      { status: 400 }
    );
  }

  performanceProfiler.startStage(profileId, stageName);

  logger.logSuccess('stage_started', { profileId, stageName });

  return NextResponse.json({
    success: true,
    data: { message: `Stage "${stageName}" started` },
    timestamp: new Date().toISOString()
  });
}

async function handleEndStage(logger: Logger, data: any) {
  const { profileId, stageName } = data;
  
  if (!profileId || !stageName) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_DATA',
        'Profile ID and stage name are required',
        'PERF_017'
      ),
      { status: 400 }
    );
  }

  performanceProfiler.endStage(profileId, stageName);

  logger.logSuccess('stage_ended', { profileId, stageName });

  return NextResponse.json({
    success: true,
    data: { message: `Stage "${stageName}" ended` },
    timestamp: new Date().toISOString()
  });
}

async function handleRecordMetrics(logger: Logger, data: any) {
  const { profileId, metrics } = data;
  
  if (!profileId || !metrics) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_DATA',
        'Profile ID and metrics are required',
        'PERF_018'
      ),
      { status: 400 }
    );
  }

  performanceProfiler.recordSystemMetrics(profileId, metrics);

  logger.logSuccess('metrics_recorded', { profileId, metricsKeys: Object.keys(metrics) });

  return NextResponse.json({
    success: true,
    data: { message: 'Metrics recorded successfully' },
    timestamp: new Date().toISOString()
  });
}