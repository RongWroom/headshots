# Training Logging and Debugging Implementation

## Overview

This implementation provides comprehensive logging and debugging tools for training operations, including detailed parameter tracking, performance metrics, log aggregation, and troubleshooting capabilities.

## Components Implemented

### 1. Enhanced Training Logger (`lib/training-logger.ts`)

**Features:**
- Detailed training logs with parameter tracking
- Performance metrics collection
- Error handling with recovery suggestions
- Stage transition tracking
- Resource usage monitoring
- Quality assessment logging

**Usage:**
```typescript
import { TrainingLogger } from '@/lib/training-logger';

const logger = new TrainingLogger(trainingId, parameters, userId);

// Log training progress
logger.logTrainingProgress(step, totalSteps, loss);

// Log resource usage
logger.logResourceUsage(memoryUsage, gpuUsage);

// Log errors with suggestions
logger.logTrainingError(stage, error, recoverable);

// Complete training
logger.logTrainingCompletion(success, finalMetrics);
```

### 2. Performance Profiler (`lib/performance-profiler.ts`)

**Features:**
- Performance profiling with bottleneck identification
- System metrics collection
- Stage-based performance analysis
- Operation timing and success tracking
- Performance comparison between sessions

**Usage:**
```typescript
import { performanceProfiler } from '@/lib/performance-profiler';

// Start profiling
const profileId = performanceProfiler.startProfiling(trainingId);

// Profile operations
await performanceProfiler.profileOperation(
  profileId,
  'operation_name',
  async () => { /* operation */ }
);

// Stop profiling and get analysis
const profile = performanceProfiler.stopProfiling(profileId);
```

### 3. Log Aggregation Service (`lib/log-aggregation.ts`)

**Features:**
- Centralized log storage and indexing
- Advanced search and filtering
- Log metrics and analytics
- Export capabilities (JSON, CSV, TXT)
- Real-time log streaming

**Usage:**
```typescript
import { logAggregationService } from '@/lib/log-aggregation';

// Search logs
const results = logAggregationService.searchLogs({
  level: 'error',
  timeRange: { start: '2024-01-01', end: '2024-01-02' },
  textSearch: 'memory'
});

// Get metrics
const metrics = logAggregationService.getLogMetrics();

// Export logs
const csvData = logAggregationService.exportLogs(query, 'csv');
```

## API Endpoints

### 1. Training Debug API (`/api/training/debug`)

**Endpoints:**
- `GET /api/training/debug?action=overview` - System overview
- `GET /api/training/debug?action=logs&trainingId=X` - Training logs
- `GET /api/training/debug?action=analysis&trainingId=X` - Log analysis
- `GET /api/training/debug?action=performance&trainingId=X` - Performance analysis
- `GET /api/training/debug?action=errors&trainingId=X` - Error analysis
- `GET /api/training/debug?action=search&q=X` - Search across all logs

**Example Usage:**
```bash
# Get training logs
curl "http://localhost:3000/api/training/debug?action=logs&trainingId=training_123"

# Search for errors
curl "http://localhost:3000/api/training/debug?action=search&level=error&textSearch=memory"

# Get performance analysis
curl "http://localhost:3000/api/training/debug?action=performance&trainingId=training_123"
```

### 2. Training Diagnostics API (`/api/training/diagnostics`)

**Endpoints:**
- `GET /api/training/diagnostics?check=all` - Comprehensive health check
- `GET /api/training/diagnostics?check=system` - System health
- `GET /api/training/diagnostics?check=runpod` - RunPod service health
- `GET /api/training/diagnostics?check=database` - Database health
- `POST /api/training/diagnostics` - Execute diagnostic actions

**Example Usage:**
```bash
# Run comprehensive diagnostics
curl "http://localhost:3000/api/training/diagnostics?check=all"

# Check RunPod health
curl "http://localhost:3000/api/training/diagnostics?check=runpod"

# Clear logs
curl -X POST "http://localhost:3000/api/training/diagnostics" \
  -H "Content-Type: application/json" \
  -d '{"action": "clear_logs", "parameters": {"trainingId": "training_123"}}'
```

### 3. Training Logs API (`/api/training/logs`)

**Endpoints:**
- `GET /api/training/logs?action=search` - Search logs with filters
- `GET /api/training/logs?action=metrics` - Get log metrics
- `GET /api/training/logs?action=export` - Export logs
- `GET /api/training/logs?action=report` - Generate training report
- `POST /api/training/logs` - Log management actions

**Example Usage:**
```bash
# Search logs
curl "http://localhost:3000/api/training/logs?action=search&level=error&limit=50"

# Get metrics
curl "http://localhost:3000/api/training/logs?action=metrics"

# Export logs as CSV
curl "http://localhost:3000/api/training/logs?action=export&format=csv&trainingId=training_123"

# Generate training report
curl "http://localhost:3000/api/training/logs?action=report&trainingId=training_123"
```

### 4. Training Performance API (`/api/training/performance`)

**Endpoints:**
- `GET /api/training/performance?action=profile&profileId=X` - Get profile
- `GET /api/training/performance?action=training&trainingId=X` - Get training profiles
- `GET /api/training/performance?action=compare&profileIds=X,Y` - Compare profiles
- `GET /api/training/performance?action=report&profileId=X` - Generate report
- `POST /api/training/performance` - Performance profiling actions

**Example Usage:**
```bash
# Get performance profile
curl "http://localhost:3000/api/training/performance?action=profile&profileId=profile_123"

# Compare profiles
curl "http://localhost:3000/api/training/performance?action=compare&profileIds=profile_1,profile_2"

# Start profiling
curl -X POST "http://localhost:3000/api/training/performance" \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "data": {"trainingId": "training_123"}}'
```

## Integration Example

Here's how to integrate comprehensive logging into a training operation:

```typescript
import { TrainingLogger } from '@/lib/training-logger';
import { performanceProfiler } from '@/lib/performance-profiler';
import { logAggregationService } from '@/lib/log-aggregation';

async function trainModelWithLogging(trainingId: string, parameters: TrainingParameters) {
  // Initialize logging
  const logger = new TrainingLogger(trainingId, parameters);
  const profileId = performanceProfiler.startProfiling(trainingId);
  
  try {
    // Stage 1: Preparation
    performanceProfiler.startStage(profileId, 'preparation');
    logger.logStageTransition('init', 'preparation');
    
    await performanceProfiler.profileOperation(
      profileId,
      'validate_images',
      async () => {
        // Validation logic
        logger.logInfo('validation', 'Images validated');
      }
    );
    
    performanceProfiler.endStage(profileId, 'preparation');
    
    // Stage 2: Training
    performanceProfiler.startStage(profileId, 'training');
    logger.logStageTransition('preparation', 'training');
    
    for (let step = 0; step < parameters.maxTrainSteps; step += 100) {
      logger.logTrainingProgress(step, parameters.maxTrainSteps);
      
      // Record resource usage
      logger.logResourceUsage(memoryUsage, gpuUsage);
    }
    
    performanceProfiler.endStage(profileId, 'training');
    
    // Complete successfully
    logger.logTrainingCompletion(true);
    
  } catch (error) {
    logger.logTrainingError('training', error, false);
    logger.logTrainingCompletion(false);
  } finally {
    // Stop profiling and save logs
    performanceProfiler.stopProfiling(profileId);
    logAggregationService.addLogs(trainingId, logger.getSession());
  }
}
```

## Debugging Workflows

### 1. Troubleshooting Failed Training

```bash
# 1. Get training overview
curl "http://localhost:3000/api/training/debug?action=logs&trainingId=failed_training"

# 2. Analyze errors
curl "http://localhost:3000/api/training/debug?action=errors&trainingId=failed_training"

# 3. Check performance bottlenecks
curl "http://localhost:3000/api/training/debug?action=performance&trainingId=failed_training"

# 4. Run system diagnostics
curl "http://localhost:3000/api/training/diagnostics?check=all"
```

### 2. Performance Analysis

```bash
# 1. Get performance profiles
curl "http://localhost:3000/api/training/performance?action=training&trainingId=slow_training"

# 2. Generate performance report
curl "http://localhost:3000/api/training/performance?action=report&profileId=profile_123"

# 3. Compare with successful training
curl "http://localhost:3000/api/training/performance?action=compare&profileIds=slow_profile,fast_profile"
```

### 3. Log Analysis

```bash
# 1. Search for memory issues
curl "http://localhost:3000/api/training/logs?action=search&textSearch=memory&level=error"

# 2. Get system metrics
curl "http://localhost:3000/api/training/logs?action=metrics"

# 3. Export detailed logs
curl "http://localhost:3000/api/training/logs?action=export&format=csv&trainingId=training_123"
```

## Log Levels and Stages

### Log Levels
- **debug**: Detailed debugging information
- **info**: General information about training progress
- **warn**: Warning conditions that don't stop training
- **error**: Error conditions that may cause training failure

### Common Stages
- **initialization**: Training setup and validation
- **image_validation**: Image preprocessing and validation
- **training_preparation**: Environment and parameter setup
- **model_training**: Actual model training process
- **quality_assessment**: Post-training quality evaluation
- **completion**: Training completion and cleanup

## Performance Metrics

### System Metrics
- **CPU Usage**: Processor utilization
- **Memory Usage**: RAM consumption and heap usage
- **GPU Usage**: GPU utilization and memory
- **Disk I/O**: Read/write operations
- **Network I/O**: Data transfer metrics

### Training Metrics
- **Training Speed**: Steps per second, images per second
- **Resource Utilization**: Peak and average usage
- **Quality Metrics**: CLIP scores, face recognition accuracy
- **Cost Metrics**: GPU hours, estimated costs

## Error Handling

### Error Categories
- **Recoverable**: Temporary issues that can be retried
- **Non-recoverable**: Permanent failures requiring intervention
- **Resource**: Memory, GPU, or storage limitations
- **Network**: Connectivity and timeout issues
- **Configuration**: Invalid parameters or settings

### Error Suggestions
The system automatically generates actionable suggestions for common errors:
- Memory optimization recommendations
- Parameter adjustment suggestions
- Network troubleshooting steps
- Resource scaling advice

## Monitoring and Alerts

### Health Checks
- System resource monitoring
- Service availability checks
- Database connectivity verification
- External API health monitoring

### Automated Cleanup
- Old log removal (configurable retention)
- Memory optimization
- Cache management
- Performance data archival

## Testing

Run the comprehensive test suite:

```bash
# Test all functionality
node test-training-logging.js

# Test specific components
node test-training-logging.js --logs-only
node test-training-logging.js --perf-only
```

## Files Created

### Core Libraries
- `lib/training-logger.ts` - Enhanced training logger
- `lib/performance-profiler.ts` - Performance profiling service
- `lib/log-aggregation.ts` - Log aggregation and search

### API Endpoints
- `app/api/training/debug/route.ts` - Debug and troubleshooting API
- `app/api/training/diagnostics/route.ts` - System diagnostics API
- `app/api/training/logs/route.ts` - Log search and export API
- `app/api/training/performance/route.ts` - Performance analysis API

### Examples and Tests
- `lib/training-integration-example.ts` - Integration examples
- `test-training-logging.js` - Comprehensive test suite

## Requirements Satisfied

✅ **4.3**: Comprehensive error handling with structured error responses and actionable suggestions
✅ **5.1**: Detailed training logs with parameter tracking and performance metrics
✅ **5.2**: Real-time monitoring with system health checks and performance profiling

This implementation provides a complete logging and debugging infrastructure that enables:
- Detailed troubleshooting of training issues
- Performance optimization through bottleneck identification
- Comprehensive monitoring and alerting
- Easy log search and analysis
- Automated error recovery suggestions