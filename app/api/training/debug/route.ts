import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger';
import { analyzeTrainingLogs, searchLogs, TrainingLogEntry } from '@/lib/training-logger';

/**
 * Training Debug API
 * Provides comprehensive debugging and diagnostics for training operations
 */

export async function GET(request: NextRequest) {
  const logger = new Logger('training-debug');
  
  try {
    const { searchParams } = new URL(request.url);
    const trainingId = searchParams.get('trainingId');
    const action = searchParams.get('action') || 'overview';

    logger.logInfo('debug_request', { trainingId, action });

    // Get training logs from global storage (in production, this would be from database)
    const trainingLogs = (global as any).trainingLogs as Map<string, any> || new Map();

    switch (action) {
      case 'overview':
        return handleOverview(logger, trainingLogs);
      
      case 'logs':
        return handleLogs(logger, trainingLogs, trainingId, searchParams);
      
      case 'analysis':
        return handleAnalysis(logger, trainingLogs, trainingId);
      
      case 'performance':
        return handlePerformance(logger, trainingLogs, trainingId);
      
      case 'errors':
        return handleErrors(logger, trainingLogs, trainingId);
      
      case 'search':
        return handleSearch(logger, trainingLogs, searchParams);
      
      default:
        return NextResponse.json(
          logger.createErrorResponse(
            'INVALID_ACTION',
            `Unknown debug action: ${action}`,
            'DEBUG_001'
          ),
          { status: 400 }
        );
    }
  } catch (error) {
    logger.logError('debug_error', error);
    return NextResponse.json(
      logger.createErrorResponse(
        'DEBUG_ERROR',
        'Failed to process debug request',
        'DEBUG_500',
        { error: error instanceof Error ? error.message : String(error) }
      ),
      { status: 500 }
    );
  }
}

async function handleOverview(logger: Logger, trainingLogs: Map<string, any>) {
  const allSessions = Array.from(trainingLogs.values());
  
  const overview = {
    totalSessions: allSessions.length,
    activeSessions: allSessions.filter(s => ['queued', 'preparing', 'training'].includes(s.session?.status)).length,
    completedSessions: allSessions.filter(s => s.session?.status === 'completed').length,
    failedSessions: allSessions.filter(s => s.session?.status === 'failed').length,
    recentSessions: allSessions
      .sort((a, b) => new Date(b.session?.startTime || 0).getTime() - new Date(a.session?.startTime || 0).getTime())
      .slice(0, 10)
      .map(s => ({
        trainingId: s.session?.trainingId,
        status: s.session?.status,
        startTime: s.session?.startTime,
        duration: s.session?.metrics?.duration,
        provider: s.session?.parameters?.provider,
        modelName: s.session?.parameters?.modelName
      })),
    systemHealth: {
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    }
  };

  logger.logSuccess('overview_generated', { sessionCount: allSessions.length });
  
  return NextResponse.json({
    success: true,
    data: overview,
    timestamp: new Date().toISOString()
  });
}

async function handleLogs(logger: Logger, trainingLogs: Map<string, any>, trainingId: string | null, searchParams: URLSearchParams) {
  if (!trainingId) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_TRAINING_ID',
        'Training ID is required for log retrieval',
        'DEBUG_002'
      ),
      { status: 400 }
    );
  }

  const sessionData = trainingLogs.get(trainingId);
  if (!sessionData) {
    return NextResponse.json(
      logger.createErrorResponse(
        'TRAINING_NOT_FOUND',
        `Training session ${trainingId} not found`,
        'DEBUG_003'
      ),
      { status: 404 }
    );
  }

  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  const level = searchParams.get('level') as TrainingLogEntry['level'] | null;

  let logs = sessionData.session?.logs || [];
  
  // Filter by level if specified
  if (level) {
    logs = logs.filter((log: TrainingLogEntry) => log.level === level);
  }

  // Apply pagination
  const paginatedLogs = logs.slice(offset, offset + limit);

  logger.logSuccess('logs_retrieved', { 
    trainingId, 
    totalLogs: logs.length, 
    returnedLogs: paginatedLogs.length 
  });

  return NextResponse.json({
    success: true,
    data: {
      trainingId,
      session: sessionData.session,
      logs: paginatedLogs,
      pagination: {
        total: logs.length,
        limit,
        offset,
        hasMore: offset + limit < logs.length
      }
    },
    timestamp: new Date().toISOString()
  });
}

async function handleAnalysis(logger: Logger, trainingLogs: Map<string, any>, trainingId: string | null) {
  if (!trainingId) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_TRAINING_ID',
        'Training ID is required for analysis',
        'DEBUG_004'
      ),
      { status: 400 }
    );
  }

  const sessionData = trainingLogs.get(trainingId);
  if (!sessionData) {
    return NextResponse.json(
      logger.createErrorResponse(
        'TRAINING_NOT_FOUND',
        `Training session ${trainingId} not found`,
        'DEBUG_005'
      ),
      { status: 404 }
    );
  }

  const logs = sessionData.session?.logs || [];
  const analysis = analyzeTrainingLogs(logs);
  
  // Additional analysis
  const stageAnalysis = analyzeStages(logs);
  const timelineAnalysis = analyzeTimeline(logs);
  const parameterAnalysis = analyzeParameters(sessionData.session);

  logger.logSuccess('analysis_completed', { trainingId, logCount: logs.length });

  return NextResponse.json({
    success: true,
    data: {
      trainingId,
      analysis: {
        ...analysis,
        stages: stageAnalysis,
        timeline: timelineAnalysis,
        parameters: parameterAnalysis
      }
    },
    timestamp: new Date().toISOString()
  });
}

async function handlePerformance(logger: Logger, trainingLogs: Map<string, any>, trainingId: string | null) {
  if (!trainingId) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_TRAINING_ID',
        'Training ID is required for performance analysis',
        'DEBUG_006'
      ),
      { status: 400 }
    );
  }

  const sessionData = trainingLogs.get(trainingId);
  if (!sessionData) {
    return NextResponse.json(
      logger.createErrorResponse(
        'TRAINING_NOT_FOUND',
        `Training session ${trainingId} not found`,
        'DEBUG_007'
      ),
      { status: 404 }
    );
  }

  const session = sessionData.session;
  const logs = session?.logs || [];
  
  // Extract performance metrics over time
  const performanceTimeline = logs
    .filter((log: TrainingLogEntry) => log.metrics)
    .map((log: TrainingLogEntry) => ({
      timestamp: log.timestamp,
      stage: log.stage,
      metrics: log.metrics
    }));

  // Calculate performance statistics
  const progressLogs = logs.filter((log: TrainingLogEntry) => log.stage === 'training_progress');
  const resourceLogs = logs.filter((log: TrainingLogEntry) => log.stage === 'resource_usage');

  const performanceStats = {
    trainingSpeed: calculateTrainingSpeed(progressLogs),
    resourceUtilization: calculateResourceUtilization(resourceLogs),
    bottlenecks: identifyBottlenecks(logs),
    efficiency: calculateEfficiency(session)
  };

  logger.logSuccess('performance_analysis_completed', { trainingId });

  return NextResponse.json({
    success: true,
    data: {
      trainingId,
      performance: {
        timeline: performanceTimeline,
        statistics: performanceStats,
        recommendations: generatePerformanceRecommendations(performanceStats)
      }
    },
    timestamp: new Date().toISOString()
  });
}

async function handleErrors(logger: Logger, trainingLogs: Map<string, any>, trainingId: string | null) {
  if (!trainingId) {
    // Return system-wide error analysis
    const allSessions = Array.from(trainingLogs.values());
    const allErrors = allSessions.flatMap(s => 
      (s.session?.logs || []).filter((log: TrainingLogEntry) => log.level === 'error')
    );

    const errorAnalysis = analyzeSystemErrors(allErrors);
    
    return NextResponse.json({
      success: true,
      data: {
        systemErrors: errorAnalysis
      },
      timestamp: new Date().toISOString()
    });
  }

  const sessionData = trainingLogs.get(trainingId);
  if (!sessionData) {
    return NextResponse.json(
      logger.createErrorResponse(
        'TRAINING_NOT_FOUND',
        `Training session ${trainingId} not found`,
        'DEBUG_008'
      ),
      { status: 404 }
    );
  }

  const logs = sessionData.session?.logs || [];
  const errorLogs = logs.filter((log: TrainingLogEntry) => log.level === 'error');
  const warningLogs = logs.filter((log: TrainingLogEntry) => log.level === 'warn');

  const errorAnalysis = {
    errorCount: errorLogs.length,
    warningCount: warningLogs.length,
    errors: errorLogs.map((log: TrainingLogEntry) => ({
      timestamp: log.timestamp,
      stage: log.stage,
      message: log.message,
      error: log.error,
      metadata: log.metadata
    })),
    warnings: warningLogs.map((log: TrainingLogEntry) => ({
      timestamp: log.timestamp,
      stage: log.stage,
      message: log.message,
      metadata: log.metadata
    })),
    errorPatterns: identifyErrorPatterns(errorLogs),
    resolutionSuggestions: generateResolutionSuggestions(errorLogs)
  };

  logger.logSuccess('error_analysis_completed', { trainingId, errorCount: errorLogs.length });

  return NextResponse.json({
    success: true,
    data: {
      trainingId,
      errorAnalysis
    },
    timestamp: new Date().toISOString()
  });
}

async function handleSearch(logger: Logger, trainingLogs: Map<string, any>, searchParams: URLSearchParams) {
  const query = searchParams.get('q');
  const level = searchParams.get('level') as TrainingLogEntry['level'] | null;
  const stage = searchParams.get('stage');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');
  const trainingId = searchParams.get('trainingId');

  if (!query && !level && !stage && !startTime && !endTime) {
    return NextResponse.json(
      logger.createErrorResponse(
        'MISSING_SEARCH_CRITERIA',
        'At least one search criterion is required',
        'DEBUG_009'
      ),
      { status: 400 }
    );
  }

  let allLogs: TrainingLogEntry[] = [];

  if (trainingId) {
    const sessionData = trainingLogs.get(trainingId);
    if (sessionData) {
      allLogs = sessionData.session?.logs || [];
    }
  } else {
    // Search across all sessions
    const allSessions = Array.from(trainingLogs.values());
    allLogs = allSessions.flatMap(s => s.session?.logs || []);
  }

  const searchQuery = {
    level: level || undefined,
    stage: stage || undefined,
    timeRange: startTime && endTime ? { start: startTime, end: endTime } : undefined,
    textSearch: query || undefined
  };

  const results = searchLogs(allLogs, searchQuery);

  logger.logSuccess('search_completed', { 
    query: searchQuery, 
    totalResults: results.length,
    searchedLogs: allLogs.length 
  });

  return NextResponse.json({
    success: true,
    data: {
      query: searchQuery,
      results,
      totalResults: results.length,
      searchedLogs: allLogs.length
    },
    timestamp: new Date().toISOString()
  });
}

// Helper functions for analysis
function analyzeStages(logs: TrainingLogEntry[]) {
  const stageTransitions = logs.filter(log => log.stage === 'stage_transition');
  const stages = logs.reduce((acc, log) => {
    if (!acc[log.stage]) {
      acc[log.stage] = { count: 0, errors: 0, warnings: 0 };
    }
    acc[log.stage].count++;
    if (log.level === 'error') acc[log.stage].errors++;
    if (log.level === 'warn') acc[log.stage].warnings++;
    return acc;
  }, {} as Record<string, { count: number; errors: number; warnings: number }>);

  return {
    transitions: stageTransitions,
    stageSummary: stages
  };
}

function analyzeTimeline(logs: TrainingLogEntry[]) {
  if (logs.length === 0) return null;

  const startTime = new Date(logs[0].timestamp).getTime();
  const endTime = new Date(logs[logs.length - 1].timestamp).getTime();
  const duration = endTime - startTime;

  const timeline = logs.map(log => ({
    timestamp: log.timestamp,
    relativeTime: new Date(log.timestamp).getTime() - startTime,
    stage: log.stage,
    level: log.level,
    message: log.message
  }));

  return {
    startTime: logs[0].timestamp,
    endTime: logs[logs.length - 1].timestamp,
    duration,
    timeline
  };
}

function analyzeParameters(session: any) {
  if (!session?.parameters) return null;

  const params = session.parameters;
  const recommendations = [];

  // Analyze parameter choices
  if (params.learningRate > 1e-3) {
    recommendations.push('Learning rate might be too high, consider reducing to 1e-4 or lower');
  }
  if (params.trainBatchSize > 4) {
    recommendations.push('Large batch size might cause memory issues');
  }
  if (params.maxTrainSteps < 500) {
    recommendations.push('Training steps might be too low for good quality');
  }

  return {
    parameters: params,
    recommendations
  };
}

function calculateTrainingSpeed(progressLogs: TrainingLogEntry[]) {
  if (progressLogs.length < 2) return null;

  const speeds = [];
  for (let i = 1; i < progressLogs.length; i++) {
    const prev = progressLogs[i - 1];
    const curr = progressLogs[i];
    const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
    const stepDiff = (curr.metadata?.step || 0) - (prev.metadata?.step || 0);
    
    if (timeDiff > 0 && stepDiff > 0) {
      speeds.push(stepDiff / (timeDiff / 1000)); // steps per second
    }
  }

  return speeds.length > 0 ? {
    average: speeds.reduce((a, b) => a + b, 0) / speeds.length,
    min: Math.min(...speeds),
    max: Math.max(...speeds)
  } : null;
}

function calculateResourceUtilization(resourceLogs: TrainingLogEntry[]) {
  if (resourceLogs.length === 0) return null;

  const memoryUsages = resourceLogs
    .map(log => log.metadata?.memoryUsage?.current)
    .filter(usage => usage !== undefined);

  const gpuUsages = resourceLogs
    .map(log => log.metadata?.gpuUsage?.utilization)
    .filter(usage => usage !== undefined);

  return {
    memory: memoryUsages.length > 0 ? {
      average: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
      peak: Math.max(...memoryUsages)
    } : null,
    gpu: gpuUsages.length > 0 ? {
      average: gpuUsages.reduce((a, b) => a + b, 0) / gpuUsages.length,
      peak: Math.max(...gpuUsages)
    } : null
  };
}

function identifyBottlenecks(logs: TrainingLogEntry[]) {
  const bottlenecks = [];
  
  // Look for repeated errors
  const errorLogs = logs.filter(log => log.level === 'error');
  if (errorLogs.length > 5) {
    bottlenecks.push('High error rate detected');
  }

  // Look for slow progress
  const progressLogs = logs.filter(log => log.stage === 'training_progress');
  if (progressLogs.length > 0) {
    const avgTimeBetweenSteps = progressLogs.length > 1 ? 
      (new Date(progressLogs[progressLogs.length - 1].timestamp).getTime() - 
       new Date(progressLogs[0].timestamp).getTime()) / progressLogs.length : 0;
    
    if (avgTimeBetweenSteps > 30000) { // More than 30 seconds per step
      bottlenecks.push('Slow training progress detected');
    }
  }

  return bottlenecks;
}

function calculateEfficiency(session: any) {
  if (!session?.metrics) return null;

  const duration = session.metrics.duration;
  const parameters = session.parameters;
  
  if (!duration || !parameters) return null;

  const expectedDuration = parameters.maxTrainSteps * 10000; // Rough estimate: 10s per step
  const efficiency = expectedDuration / duration;

  return {
    actualDuration: duration,
    expectedDuration,
    efficiency: Math.min(efficiency, 1), // Cap at 100%
    rating: efficiency > 0.8 ? 'excellent' : efficiency > 0.6 ? 'good' : efficiency > 0.4 ? 'fair' : 'poor'
  };
}

function generatePerformanceRecommendations(stats: any) {
  const recommendations = [];

  if (stats.efficiency?.efficiency < 0.5) {
    recommendations.push('Training is running slower than expected. Consider optimizing parameters or checking system resources.');
  }

  if (stats.resourceUtilization?.memory?.peak > 0.9) {
    recommendations.push('High memory usage detected. Consider reducing batch size or resolution.');
  }

  if (stats.resourceUtilization?.gpu?.average < 0.5) {
    recommendations.push('Low GPU utilization. Consider increasing batch size or checking for I/O bottlenecks.');
  }

  return recommendations;
}

function analyzeSystemErrors(errorLogs: TrainingLogEntry[]) {
  const errorTypes = errorLogs.reduce((acc, log) => {
    const errorType = log.error?.code || 'UNKNOWN';
    if (!acc[errorType]) {
      acc[errorType] = { count: 0, examples: [] };
    }
    acc[errorType].count++;
    if (acc[errorType].examples.length < 3) {
      acc[errorType].examples.push({
        timestamp: log.timestamp,
        message: log.message,
        trainingId: log.trainingId
      });
    }
    return acc;
  }, {} as Record<string, { count: number; examples: any[] }>);

  return {
    totalErrors: errorLogs.length,
    errorTypes,
    mostCommonError: Object.entries(errorTypes)
      .sort(([,a], [,b]) => b.count - a.count)[0]
  };
}

function identifyErrorPatterns(errorLogs: TrainingLogEntry[]) {
  const patterns = [];
  
  // Check for recurring errors
  const errorMessages = errorLogs.map(log => log.message);
  const messageFrequency = errorMessages.reduce((acc, msg) => {
    acc[msg] = (acc[msg] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const recurringErrors = Object.entries(messageFrequency)
    .filter(([, count]) => count > 1)
    .sort(([,a], [,b]) => b - a);

  if (recurringErrors.length > 0) {
    patterns.push({
      type: 'recurring_errors',
      description: 'Same errors occurring multiple times',
      details: recurringErrors.slice(0, 5)
    });
  }

  // Check for error cascades
  const errorTimes = errorLogs.map(log => new Date(log.timestamp).getTime());
  let cascadeCount = 0;
  for (let i = 1; i < errorTimes.length; i++) {
    if (errorTimes[i] - errorTimes[i-1] < 60000) { // Within 1 minute
      cascadeCount++;
    }
  }

  if (cascadeCount > 2) {
    patterns.push({
      type: 'error_cascade',
      description: 'Multiple errors occurring in quick succession',
      count: cascadeCount
    });
  }

  return patterns;
}

function generateResolutionSuggestions(errorLogs: TrainingLogEntry[]) {
  const suggestions = new Set<string>();

  errorLogs.forEach(log => {
    if (log.error?.suggestions) {
      log.error.suggestions.forEach(suggestion => suggestions.add(suggestion));
    }
  });

  return Array.from(suggestions);
}