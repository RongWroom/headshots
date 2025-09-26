import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';
import { logAggregationService, generateLogReport } from '@/lib/log-aggregation';
import { TrainingLogEntry } from '@/lib/training-logger';

/**
 * Training Logs API
 * Provides log search, aggregation, and export functionality
 */

export async function GET(request: NextRequest) {
  const logger = new Logger('training-logs');
  
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'search';

    logger.logInfo('logs_request', { action, params: Object.fromEntries(searchParams) });

    switch (action) {
      case 'search':
        return handleSearch(logger, searchParams);
      case 'metrics':
        return handleMetrics(logger, searchParams);
      case 'export':
        return handleExport(logger, searchParams);
      case 'report':
        return handleReport(logger, searchParams);
      default:
        return NextResponse.json(
          logger.createErrorResponse(
            'INVALID_ACTION',
            `Unknown logs action: ${action}`,
            'LOGS_001'
          ),
          { status: 400 }
        );
    }
  } catch (error) {
    logger.logError('logs_error', error);
    return NextResponse.json(
      logger.createErrorResponse(
        'LOGS_ERROR',
        'Failed to process logs request',
        'LOGS_500',
        { error: error instanceof Error ? error.message : String(error) }
      ),
      { status: 500 }
    );
  }
}

async function handleSearch(logger: Logger, searchParams: URLSearchParams) {
  const query = {
    trainingId: searchParams.get('trainingId') || undefined,
    userId: searchParams.get('userId') || undefined,
    level: searchParams.get('level') as TrainingLogEntry['level'] || undefined,
    stage: searchParams.get('stage') || undefined,
    timeRange: searchParams.get('startTime') && searchParams.get('endTime') ? {
      start: searchParams.get('startTime')!,
      end: searchParams.get('endTime')!
    } : undefined,
    textSearch: searchParams.get('q') || undefined,
    limit: parseInt(searchParams.get('limit') || '100'),
    offset: parseInt(searchParams.get('offset') || '0'),
    sortBy: searchParams.get('sortBy') as 'timestamp' | 'level' | 'stage' || 'timestamp',
    sortOrder: searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc'
  };

  const result = logAggregationService.searchLogs(query);

  logger.logSuccess('search_completed', { 
    query, 
    totalResults: result.totalCount,
    returnedResults: result.logs.length 
  });

  return NextResponse.json({
    success: true,
    data: result,
    timestamp: new Date().toISOString()
  });
}

async function handleMetrics(logger: Logger, searchParams: URLSearchParams) {
  const timeRange = searchParams.get('startTime') && searchParams.get('endTime') ? {
    start: searchParams.get('startTime')!,
    end: searchParams.get('endTime')!
  } : undefined;

  const metrics = logAggregationService.getLogMetrics(timeRange);

  logger.logSuccess('metrics_generated', { timeRange, metrics });

  return NextResponse.json({
    success: true,
    data: metrics,
    timestamp: new Date().toISOString()
  });
}

async function handleExport(logger: Logger, searchParams: URLSearchParams) {
  const format = searchParams.get('format') as 'json' | 'csv' | 'txt' || 'json';
  
  const query = {
    trainingId: searchParams.get('trainingId') || undefined,
    userId: searchParams.get('userId') || undefined,
    level: searchParams.get('level') as TrainingLogEntry['level'] || undefined,
    stage: searchParams.get('stage') || undefined,
    timeRange: searchParams.get('startTime') && searchParams.get('endTime') ? {
      start: searchParams.get('startTime')!,
      end: searchParams.get('endTime')!
    } : undefined,
    textSearch: searchParams.get('q') || undefined,
    limit: parseInt(searchParams.get('limit') || '10000'), // Higher limit for exports
    offset: 0,
    sortBy: 'timestamp' as const,
    sortOrder: 'desc' as const
  };

  const exportData = logAggregationService.exportLogs(query, format);

  logger.logSuccess('export_completed', { format, query });

  // Set appropriate headers for file download
  const headers = new Headers();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `training-logs-${timestamp}.${format}`;
  
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  
  switch (format) {
    case 'csv':
      headers.set('Content-Type', 'text/csv');
      break;
    case 'txt':
      headers.set('Content-Type', 'text/plain');
      break;
    default:
      headers.set('Content-Type', 'application/json');
  }

  return new NextResponse(exportData, { headers });
}

async function handleReport(logger: Logger, searchParams: URLSearchParams) {
  const trainingId = searchParams.get('trainingId');
  
  if (!trainingId) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_TRAINING_ID',
        'Training ID is required for report generation',
        'LOGS_002'
      ),
      { status: 400 }
    );
  }

  const logs = logAggregationService.getTrainingLogs(trainingId);
  if (logs.length === 0) {
    return NextResponse.json(
      logger.createErrorResponse(
        'NO_LOGS_FOUND',
        `No logs found for training ${trainingId}`,
        'LOGS_003'
      ),
      { status: 404 }
    );
  }

  const report = generateLogReport(logs);

  logger.logSuccess('report_generated', { trainingId, logCount: logs.length });

  const headers = new Headers();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `training-report-${trainingId}-${timestamp}.md`;
  
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  headers.set('Content-Type', 'text/markdown');

  return new NextResponse(report, { headers });
}

export async function POST(request: NextRequest) {
  const logger = new Logger('training-logs');
  
  try {
    const body = await request.json();
    const { action, data } = body;

    logger.logInfo('logs_post_request', { action });

    switch (action) {
      case 'cleanup':
        return handleCleanup(logger, data);
      case 'aggregate':
        return handleAggregate(logger, data);
      default:
        return NextResponse.json(
          logger.createErrorResponse(
            'INVALID_ACTION',
            `Unknown logs POST action: ${action}`,
            'LOGS_004'
          ),
          { status: 400 }
        );
    }
  } catch (error) {
    logger.logError('logs_post_error', error);
    return NextResponse.json(
      logger.createErrorResponse(
        'LOGS_POST_ERROR',
        'Failed to process logs POST request',
        'LOGS_500',
        { error: error instanceof Error ? error.message : String(error) }
      ),
      { status: 500 }
    );
  }
}

async function handleCleanup(logger: Logger, data: any) {
  const maxAge = data?.maxAge || 7 * 24 * 60 * 60 * 1000; // 7 days default
  
  const result = logAggregationService.cleanupOldLogs(maxAge);

  logger.logSuccess('cleanup_completed', result);

  return NextResponse.json({
    success: true,
    data: result,
    timestamp: new Date().toISOString()
  });
}

async function handleAggregate(logger: Logger, data: any) {
  const { trainingId, session } = data;
  
  if (!trainingId || !session) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_DATA',
        'Training ID and session data are required for aggregation',
        'LOGS_005'
      ),
      { status: 400 }
    );
  }

  logAggregationService.addLogs(trainingId, session);

  logger.logSuccess('aggregation_completed', { trainingId, logCount: session.logs?.length || 0 });

  return NextResponse.json({
    success: true,
    data: { message: 'Logs aggregated successfully' },
    timestamp: new Date().toISOString()
  });
}