# Training Queue and Concurrency Management Implementation

## Overview

This document describes the implementation of the training job queue and concurrency management system for the headshot generation application. The system provides intelligent job queuing, user-based rate limiting, provider load balancing, and comprehensive monitoring capabilities.

## Architecture

### Core Components

1. **Training Queue Service** (`lib/training-queue.ts`)
   - Central service for managing training job queue
   - Handles job enqueuing, status updates, and processing
   - Implements rate limiting and provider selection logic

2. **Load Balancer** (`lib/training-load-balancer.ts`)
   - Manages automatic load balancing across multiple RunPod instances
   - Monitors instance health and capacity
   - Optimizes job placement based on performance metrics

3. **Database Schema** (`supabase/migrations/20250926000000_add_training_queue.sql`)
   - Queue management tables
   - Rate limiting tracking
   - Provider capacity monitoring
   - Performance statistics

4. **API Endpoints** (`app/api/training/queue/`)
   - RESTful API for queue operations
   - User queue status and metrics
   - Job management (enqueue, cancel, update)

5. **Dashboard Component** (`components/TrainingQueueDashboard.tsx`)
   - Real-time queue monitoring interface
   - User rate limit visualization
   - Provider status display

## Database Schema

### Tables

#### `training_queue`
Manages the job queue with priority and scheduling:
```sql
- id: uuid (primary key)
- user_id: uuid (foreign key to auth.users)
- model_id: bigint (foreign key to models)
- priority: integer (1-10, lower = higher priority)
- status: text (queued, processing, completed, failed, cancelled)
- provider: text (runpod, replicate, fal)
- estimated_duration: integer (milliseconds)
- queue_position: integer
- training_config: jsonb (training parameters)
```

#### `user_rate_limits`
Tracks user-based rate limiting:
```sql
- id: uuid (primary key)
- user_id: uuid (foreign key to auth.users)
- limit_type: text (hourly, daily, monthly)
- limit_value: integer (maximum jobs)
- current_usage: integer
- reset_time: timestamp
```

#### `provider_capacity`
Monitors provider capacity and health:
```sql
- id: uuid (primary key)
- provider: text (runpod, replicate, fal)
- instance_id: text (for RunPod instances)
- max_concurrent_jobs: integer
- current_jobs: integer
- status: text (active, maintenance, disabled)
- health_score: numeric (0.0-1.0)
```

#### `queue_statistics`
Tracks performance metrics:
```sql
- id: uuid (primary key)
- date: date
- provider: text
- total_processed: integer
- average_wait_time: integer (milliseconds)
- throughput_per_hour: numeric
```

### Functions

#### `check_rate_limit(user_id, limit_type)`
Checks if user is within rate limits:
- Resets expired limits automatically
- Returns boolean indicating if request is allowed

#### `increment_rate_limit(user_id, limit_type)`
Increments user's rate limit usage:
- Creates new limit entry if doesn't exist
- Updates existing usage counter

#### `update_queue_positions()`
Automatically maintains queue positions:
- Triggered on queue table changes
- Orders by priority (ascending) then creation time

## Features

### 1. Intelligent Job Queuing

**Priority-Based Ordering:**
- Jobs ordered by priority (1 = highest, 10 = lowest)
- Same priority jobs ordered by creation time (FIFO)
- Automatic queue position calculation

**Provider-Specific Queues:**
- Separate queues per provider (RunPod, Replicate, Fal)
- Independent processing based on provider capacity

### 2. User Rate Limiting

**Multi-Level Limits:**
- Hourly: 10 jobs (default)
- Daily: 50 jobs (default)
- Monthly: 500 jobs (default)

**Automatic Reset:**
- Limits reset automatically at specified intervals
- Expired limits are cleaned up on next check

**Graceful Handling:**
- Rate limit exceeded returns 429 status
- Includes reset time in error response

### 3. Provider Load Balancing

**Capacity-Based Selection:**
- Considers available capacity (max - current jobs)
- Factors in provider health scores
- Accounts for average job duration

**Scoring Algorithm:**
```javascript
totalScore = (capacityScore * 0.35) + 
             (performanceScore * 0.25) + 
             (costScore * 0.25) + 
             (healthScore * 0.15)
```

**Health Monitoring:**
- Periodic health checks every 2 minutes
- Automatic instance discovery and management
- Failure detection and recovery

### 4. RunPod Multi-Instance Support

**Dynamic Instance Management:**
- Automatic detection of available RunPod instances
- Load balancing across multiple instances
- Instance-specific capacity tracking

**Health Monitoring:**
- Real-time health score calculation
- Performance metrics tracking
- Automatic failover for unhealthy instances

### 5. Comprehensive Monitoring

**Real-Time Metrics:**
- Current queue size per provider
- Processing job counts
- Average wait and processing times
- Throughput statistics

**Historical Analytics:**
- Daily performance summaries
- Success/failure rate tracking
- Trend analysis and reporting

## API Endpoints

### GET `/api/training/queue`
Returns user's queue status and entries:
```json
{
  "user_queue_entries": [...],
  "user_rate_limits": [...],
  "queue_status": {
    "total_queued": 15,
    "total_processing": 3,
    "estimated_wait_time": 900000,
    "queue_position": 5
  },
  "queue_metrics": {...}
}
```

### POST `/api/training/queue`
Enqueues a new training job:
```json
{
  "model_id": 123,
  "training_config": {
    "image_urls": [...],
    "trigger_word": "sksuser",
    "resolution": 1024,
    "max_train_steps": 1000
  },
  "priority": 5,
  "preferred_provider": "runpod"
}
```

### DELETE `/api/training/queue/{id}`
Cancels a queued training job:
- Only allows cancellation of user's own jobs
- Only works for jobs in 'queued' status

### GET `/api/training/queue/metrics`
Returns comprehensive queue metrics:
```json
{
  "queue_metrics": {...},
  "historical_statistics": [...],
  "provider_capacity": [...],
  "user_statistics": [...]
}
```

## Usage Examples

### Enqueuing a Training Job

```typescript
import { trainingQueueService } from '../lib/training-queue';

const result = await trainingQueueService.enqueueTraining(userId, {
  model_id: 123,
  training_config: {
    image_urls: ['url1', 'url2', 'url3'],
    trigger_word: 'sksuser',
    model_name: 'user-model',
    resolution: 1024,
    max_train_steps: 1000,
    lora_rank: 64,
    learning_rate: 1e-4,
    train_batch_size: 1,
    gradient_accumulation: 1,
    mixed_precision: 'fp16',
    use_xformers: true
  },
  priority: 5
});

console.log('Job enqueued:', result.queue_entry.id);
console.log('Estimated start:', result.estimated_start_time);
console.log('Queue position:', result.queue_position);
```

### Checking Queue Status

```typescript
const status = await trainingQueueService.getUserQueueStatus(userId);

console.log('Total queued:', status.total_queued);
console.log('Your position:', status.queue_position);
console.log('Estimated wait:', status.estimated_wait_time);
```

### Monitoring Provider Health

```typescript
const metrics = await trainingQueueService.getQueueMetrics();

metrics.provider_health.forEach(provider => {
  console.log(`${provider.provider}: ${provider.health_score * 100}% healthy`);
  console.log(`Available capacity: ${provider.available_capacity}`);
});
```

## Dashboard Integration

The `TrainingQueueDashboard` component provides a comprehensive UI for monitoring:

```tsx
import TrainingQueueDashboard from '../components/TrainingQueueDashboard';

function QueuePage() {
  return (
    <div>
      <h1>Training Queue</h1>
      <TrainingQueueDashboard 
        userId={user.id}
        refreshInterval={30000}
      />
    </div>
  );
}
```

## Performance Considerations

### Database Optimization

**Indexes:**
- Queue status and provider for fast filtering
- User ID for user-specific queries
- Creation time for ordering
- Queue position for position-based queries

**Triggers:**
- Automatic queue position updates
- Statistics aggregation
- Rate limit cleanup

### Caching Strategy

**Provider Capacity:**
- Cached for 30 seconds to reduce database load
- Invalidated on capacity changes

**Queue Metrics:**
- Cached for 60 seconds
- Background refresh for real-time updates

### Scalability

**Horizontal Scaling:**
- Queue processor can run on multiple instances
- Database handles concurrent access with proper locking
- Provider capacity shared across instances

**Load Distribution:**
- Automatic load balancing across providers
- Dynamic instance scaling for RunPod
- Failover mechanisms for high availability

## Error Handling

### Rate Limiting
```typescript
try {
  await trainingQueueService.enqueueTraining(userId, request);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limit exceeded. Resets at: ${error.reset_time}`);
  }
}
```

### Capacity Issues
```typescript
try {
  await trainingQueueService.enqueueTraining(userId, request);
} catch (error) {
  if (error instanceof CapacityError) {
    console.log(`Provider ${error.provider} at capacity`);
  }
}
```

### Queue Errors
```typescript
try {
  await trainingQueueService.updateQueueEntry(id, updates);
} catch (error) {
  if (error instanceof QueueError) {
    console.log(`Queue operation failed: ${error.message}`);
    console.log('Error code:', error.code);
  }
}
```

## Testing

### Unit Tests
Run the unit tests to verify queue logic:
```bash
node test-training-queue-unit.js
```

Tests cover:
- Training config validation
- Load balancing algorithms
- Rate limit calculations
- Queue position logic
- Duration estimation

### Integration Tests
Run integration tests (requires database setup):
```bash
node test-training-queue.js
```

Tests cover:
- Database schema validation
- API endpoint functionality
- End-to-end queue operations

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Queue Health:**
   - Average wait time
   - Queue size trends
   - Processing throughput

2. **Provider Performance:**
   - Health scores
   - Capacity utilization
   - Response times

3. **User Experience:**
   - Rate limit hit rates
   - Job success rates
   - Completion times

### Alerting Thresholds

- Queue size > 100 jobs
- Average wait time > 30 minutes
- Provider health score < 0.7
- Rate limit hit rate > 10%

## Future Enhancements

### Planned Features

1. **Advanced Scheduling:**
   - Time-based job scheduling
   - Batch processing optimization
   - Resource reservation system

2. **Enhanced Load Balancing:**
   - Machine learning-based provider selection
   - Predictive capacity planning
   - Cost optimization algorithms

3. **Improved Monitoring:**
   - Real-time dashboards
   - Predictive analytics
   - Automated alerting

4. **User Experience:**
   - Job priority upgrades
   - Estimated completion notifications
   - Queue position updates

## Conclusion

The training queue and concurrency management system provides a robust foundation for handling multiple training jobs efficiently. It includes intelligent load balancing, comprehensive monitoring, and user-friendly interfaces while maintaining high performance and reliability.

The system is designed to scale with the application's growth and can be extended with additional providers and features as needed.