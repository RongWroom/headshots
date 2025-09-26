/**
 * Example integration of comprehensive logging and debugging tools
 * with training operations
 */

import { TrainingLogger, TrainingParameters } from './training-logger';
import { performanceProfiler } from './performance-profiler';
import { logAggregationService } from './log-aggregation';

/**
 * Example of how to integrate enhanced logging into a training operation
 */
export async function trainModelWithLogging(
  trainingId: string,
  parameters: TrainingParameters,
  userId?: string
): Promise<{ success: boolean; modelUrl?: string; error?: string }> {
  
  // Initialize comprehensive logging
  const trainingLogger = new TrainingLogger(trainingId, parameters, userId);
  
  // Start performance profiling
  const profileId = performanceProfiler.startProfiling(trainingId);
  
  try {
    // Log parameter optimization
    trainingLogger.logParameterOptimization(
      { learningRate: 1e-3 }, // original
      { learningRate: parameters.learningRate } // optimized
    );

    // Stage 1: Image validation and preprocessing
    performanceProfiler.startStage(profileId, 'image_validation');
    trainingLogger.logStageTransition('initialization', 'image_validation');
    
    const validationResult = await performanceProfiler.profileOperation(
      profileId,
      'validate_images',
      async () => {
        // Simulate image validation
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { validImages: parameters.imageCount, invalidImages: 0 };
      },
      { imageCount: parameters.imageCount }
    );

    trainingLogger.logInfo('image_validation', 'Images validated successfully', validationResult);
    performanceProfiler.endStage(profileId, 'image_validation');

    // Stage 2: Training preparation
    performanceProfiler.startStage(profileId, 'training_preparation');
    trainingLogger.logStageTransition('image_validation', 'training_preparation');
    
    await performanceProfiler.profileOperation(
      profileId,
      'prepare_training_environment',
      async () => {
        // Simulate training preparation
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { status: 'prepared' };
      }
    );

    performanceProfiler.endStage(profileId, 'training_preparation');

    // Stage 3: Model training
    performanceProfiler.startStage(profileId, 'model_training');
    trainingLogger.logStageTransition('training_preparation', 'model_training');
    
    const trainingResult = await performanceProfiler.profileOperation(
      profileId,
      'train_model',
      async () => {
        // Simulate training with progress updates
        const totalSteps = parameters.maxTrainSteps;
        
        for (let step = 0; step <= totalSteps; step += 100) {
          // Log training progress
          trainingLogger.logTrainingProgress(step, totalSteps, Math.random() * 0.5);
          
          // Record resource usage
          trainingLogger.logResourceUsage(
            {
              peak: Math.random() * 1000000000,
              average: Math.random() * 800000000,
              current: Math.random() * 900000000
            },
            {
              utilization: Math.random() * 100,
              memoryUsed: Math.random() * 8000000000,
              memoryTotal: 8000000000
            }
          );

          // Record system metrics for profiler
          performanceProfiler.recordSystemMetrics(profileId, {
            cpu: {
              usage: Math.random() * 100,
              loadAverage: [Math.random(), Math.random(), Math.random()]
            },
            memory: {
              used: Math.random() * 1000000000,
              total: 2000000000,
              percentage: Math.random() * 100,
              heapUsed: Math.random() * 500000000,
              heapTotal: 1000000000
            },
            gpu: {
              utilization: Math.random() * 100,
              memoryUsed: Math.random() * 8000000000,
              memoryTotal: 8000000000,
              temperature: 60 + Math.random() * 20
            }
          });

          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        return { modelUrl: `https://example.com/models/${trainingId}` };
      }
    );

    performanceProfiler.endStage(profileId, 'model_training');

    // Stage 4: Quality assessment
    performanceProfiler.startStage(profileId, 'quality_assessment');
    trainingLogger.logStageTransition('model_training', 'quality_assessment');
    
    const qualityResult = await performanceProfiler.profileOperation(
      profileId,
      'assess_quality',
      async () => {
        // Simulate quality assessment
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
          clipScore: 0.85 + Math.random() * 0.1,
          faceRecognitionScore: 0.9 + Math.random() * 0.05,
          overallQuality: 0.88 + Math.random() * 0.08
        };
      }
    );

    trainingLogger.logQualityAssessment(qualityResult);
    performanceProfiler.endStage(profileId, 'quality_assessment');

    // Complete training successfully
    trainingLogger.logTrainingCompletion(true, {
      costMetrics: {
        estimatedCost: 2.50,
        actualCost: 2.35,
        gpuHours: 0.5
      }
    });

    // Stop profiling and get final analysis
    const profile = performanceProfiler.stopProfiling(profileId);
    
    // Add logs to aggregation service
    const session = trainingLogger.getSession();
    logAggregationService.addLogs(trainingId, session);

    return {
      success: true,
      modelUrl: trainingResult.modelUrl
    };

  } catch (error) {
    // Log error with comprehensive details
    trainingLogger.logTrainingError(
      'training_execution',
      error instanceof Error ? error : new Error(String(error)),
      false // not recoverable
    );

    // Complete training with failure
    trainingLogger.logTrainingCompletion(false);

    // Stop profiling
    performanceProfiler.stopProfiling(profileId);

    // Add logs to aggregation service even on failure
    const session = trainingLogger.getSession();
    logAggregationService.addLogs(trainingId, session);

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Example of how to use the debugging endpoints
 */
export async function debugTrainingSession(trainingId: string) {
  try {
    // Get training logs
    const logsResponse = await fetch(`/api/training/debug?action=logs&trainingId=${trainingId}`);
    const logsData = await logsResponse.json();
    console.log('Training logs:', logsData);

    // Get performance analysis
    const analysisResponse = await fetch(`/api/training/debug?action=analysis&trainingId=${trainingId}`);
    const analysisData = await analysisResponse.json();
    console.log('Training analysis:', analysisData);

    // Get error analysis
    const errorsResponse = await fetch(`/api/training/debug?action=errors&trainingId=${trainingId}`);
    const errorsData = await errorsResponse.json();
    console.log('Error analysis:', errorsData);

    // Search for specific issues
    const searchResponse = await fetch(`/api/training/debug?action=search&level=error&textSearch=memory`);
    const searchData = await searchResponse.json();
    console.log('Error search results:', searchData);

    return {
      logs: logsData,
      analysis: analysisData,
      errors: errorsData,
      search: searchData
    };
  } catch (error) {
    console.error('Failed to debug training session:', error);
    throw error;
  }
}

/**
 * Example of how to use log aggregation and search
 */
export async function searchTrainingLogs(query: {
  level?: string;
  stage?: string;
  startTime?: string;
  endTime?: string;
  textSearch?: string;
}) {
  try {
    const params = new URLSearchParams();
    if (query.level) params.append('level', query.level);
    if (query.stage) params.append('stage', query.stage);
    if (query.startTime) params.append('startTime', query.startTime);
    if (query.endTime) params.append('endTime', query.endTime);
    if (query.textSearch) params.append('q', query.textSearch);

    const response = await fetch(`/api/training/logs?action=search&${params.toString()}`);
    const data = await response.json();

    return data;
  } catch (error) {
    console.error('Failed to search training logs:', error);
    throw error;
  }
}

/**
 * Example of how to use performance profiling
 */
export async function analyzeTrainingPerformance(trainingId: string) {
  try {
    // Get all profiles for the training
    const profilesResponse = await fetch(`/api/training/performance?action=training&trainingId=${trainingId}`);
    const profilesData = await profilesResponse.json();

    if (profilesData.data.profiles.length === 0) {
      return { message: 'No performance profiles found for this training' };
    }

    const profileId = profilesData.data.profiles[0].id;

    // Get detailed profile
    const profileResponse = await fetch(`/api/training/performance?action=profile&profileId=${profileId}`);
    const profileData = await profileResponse.json();

    // Generate performance report
    const reportResponse = await fetch(`/api/training/performance?action=report&profileId=${profileId}`);
    const report = await reportResponse.text();

    return {
      profiles: profilesData.data.profiles,
      detailedProfile: profileData.data,
      report
    };
  } catch (error) {
    console.error('Failed to analyze training performance:', error);
    throw error;
  }
}

/**
 * Example of how to run system diagnostics
 */
export async function runSystemDiagnostics() {
  try {
    // Run comprehensive diagnostics
    const diagnosticsResponse = await fetch('/api/training/diagnostics?check=all');
    const diagnosticsData = await diagnosticsResponse.json();

    // Check specific components if needed
    const runpodHealthResponse = await fetch('/api/training/diagnostics?check=runpod');
    const runpodHealthData = await runpodHealthResponse.json();

    return {
      overall: diagnosticsData,
      runpodHealth: runpodHealthData
    };
  } catch (error) {
    console.error('Failed to run system diagnostics:', error);
    throw error;
  }
}

/**
 * Example of how to export logs and performance data
 */
export async function exportTrainingData(trainingId: string) {
  try {
    // Export logs as CSV
    const logsResponse = await fetch(`/api/training/logs?action=export&trainingId=${trainingId}&format=csv`);
    const logsCSV = await logsResponse.text();

    // Export performance data
    const profilesResponse = await fetch(`/api/training/performance?action=training&trainingId=${trainingId}`);
    const profilesData = await profilesResponse.json();

    let performanceData = null;
    if (profilesData.data.profiles.length > 0) {
      const profileId = profilesData.data.profiles[0].id;
      const perfResponse = await fetch(`/api/training/performance?action=export&profileId=${profileId}&format=json`);
      performanceData = await perfResponse.text();
    }

    // Generate comprehensive report
    const reportResponse = await fetch(`/api/training/logs?action=report&trainingId=${trainingId}`);
    const report = await reportResponse.text();

    return {
      logs: logsCSV,
      performance: performanceData,
      report
    };
  } catch (error) {
    console.error('Failed to export training data:', error);
    throw error;
  }
}