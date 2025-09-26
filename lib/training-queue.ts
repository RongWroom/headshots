// Training Queue and Concurrency Management Service

import { createClient } from '@supabase/supabase-js';
import {
  TrainingQueueEntry,
  TrainingConfig,
  UserRateLimit,
  ProviderCapacity,
  QueueStatistics,
  QueueStatus,
  QueueMetrics,
  LoadBalancingDecision,
  RateLimitCheck,
  EnqueueTrainingRequest,
  EnqueueTrainingResponse,
  UpdateQueueEntryRequest,
  QueueError,
  RateLimitError,
  CapacityError,
  ProviderStatus
} from '../types/training-queue';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class TrainingQueueService {
  private static instance: TrainingQueueService;
  private processingInterval?: NodeJS.Timeout;

  private constructor() {
    // Start queue processing
    this.startQueueProcessor();
  }

  public static getInstance(): TrainingQueueService {
    if (!TrainingQueueService.instance) {
      TrainingQueueService.instance = new TrainingQueueService();
    }
    return TrainingQueueService.instance;
  }

  /**
   * Enqueue a new training job
   */
  async enqueueTraining(
    userId: string,
    request: EnqueueTrainingRequest
  ): Promise<EnqueueTrainingResponse> {
    try {
      // Check rate limits
      const rateLimitCheck = await this.checkRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        throw new RateLimitError(
          `Rate limit exceeded for ${rateLimitCheck.limit_type}. Resets at ${rateLimitCheck.reset_time}`,
          rateLimitCheck.limit_type,
          rateLimitCheck.reset_time
        );
      }

      // Select optimal provider
      const loadBalancingDecision = await this.selectOptimalProvider(
        request.training_config,
        request.preferred_provider
      );

      // Create queue entry
      const queueEntry: Partial<TrainingQueueEntry> = {
        user_id: userId,
        model_id: request.model_id,
        priority: request.priority || 5,
        status: 'queued',
        provider: loadBalancingDecision.selected_provider as any,
        estimated_duration: await this.estimateTrainingDuration(
          request.training_config,
          loadBalancingDecision.selected_provider
        ),
        estimated_start_time: loadBalancingDecision.estimated_start_time,
        retry_count: 0,
        max_retries: 3,
        training_config: request.training_config
      };

      const { data, error } = await supabase
        .from('training_queue')
        .insert(queueEntry)
        .select()
        .single();

      if (error) {
        throw new QueueError('Failed to enqueue training job', 'ENQUEUE_FAILED', { error });
      }

      // Increment rate limit usage
      await this.incrementRateLimit(userId);

      return {
        queue_entry: data,
        estimated_start_time: loadBalancingDecision.estimated_start_time,
        estimated_completion_time: loadBalancingDecision.estimated_completion_time,
        queue_position: loadBalancingDecision.queue_position
      };
    } catch (error) {
      console.error('Error enqueuing training job:', error);
      throw error;
    }
  }

  /**
   * Check user rate limits
   */
  async checkRateLimit(userId: string): Promise<RateLimitCheck> {
    try {
      // Check hourly limit first (most restrictive)
      const { data: hourlyLimit } = await supabase
        .rpc('check_rate_limit', { p_user_id: userId, p_limit_type: 'hourly' });

      if (!hourlyLimit) {
        const { data: limitData } = await supabase
          .from('user_rate_limits')
          .select('*')
          .eq('user_id', userId)
          .eq('limit_type', 'hourly')
          .single();

        if (limitData) {
          return {
            allowed: false,
            limit_type: 'hourly',
            current_usage: limitData.current_usage,
            limit_value: limitData.limit_value,
            reset_time: limitData.reset_time,
            time_until_reset: new Date(limitData.reset_time).getTime() - Date.now()
          };
        }
      }

      return {
        allowed: true,
        limit_type: 'hourly',
        current_usage: 0,
        limit_value: 10,
        reset_time: new Date(Date.now() + 3600000).toISOString(),
        time_until_reset: 3600000
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      throw new QueueError('Failed to check rate limit', 'RATE_LIMIT_CHECK_FAILED', { error });
    }
  }

  /**
   * Increment rate limit usage
   */
  private async incrementRateLimit(userId: string): Promise<void> {
    try {
      await supabase.rpc('increment_rate_limit', {
        p_user_id: userId,
        p_limit_type: 'hourly'
      });
    } catch (error) {
      console.error('Error incrementing rate limit:', error);
      // Don't throw here as the job is already enqueued
    }
  }

  /**
   * Select optimal provider based on capacity and performance
   */
  async selectOptimalProvider(
    trainingConfig: TrainingConfig,
    preferredProvider?: string
  ): Promise<LoadBalancingDecision> {
    try {
      // Get current provider capacity
      const { data: providers, error } = await supabase
        .from('provider_capacity')
        .select('*')
        .eq('status', 'active')
        .order('health_score', { ascending: false });

      if (error || !providers?.length) {
        throw new CapacityError('No providers available', 'none');
      }

      // Filter by preferred provider if specified
      const availableProviders = preferredProvider
        ? providers.filter(p => p.provider === preferredProvider)
        : providers;

      if (!availableProviders.length) {
        throw new CapacityError(
          `Preferred provider ${preferredProvider} not available`,
          preferredProvider || 'none'
        );
      }

      // Calculate scores for each provider
      const providerScores = await Promise.all(
        availableProviders.map(async (provider) => {
          const queueSize = await this.getProviderQueueSize(provider.provider);
          const availableCapacity = Math.max(0, provider.max_concurrent_jobs - provider.current_jobs);
          
          // Score based on: available capacity, health score, queue size, average duration
          const capacityScore = availableCapacity / provider.max_concurrent_jobs;
          const healthScore = provider.health_score;
          const queueScore = Math.max(0, 1 - (queueSize / 20)); // Penalize large queues
          const speedScore = provider.average_job_duration 
            ? Math.max(0, 1 - (provider.average_job_duration / 1800000)) // Prefer faster providers
            : 0.5;

          const totalScore = (capacityScore * 0.4) + (healthScore * 0.3) + (queueScore * 0.2) + (speedScore * 0.1);

          return {
            provider,
            score: totalScore,
            queueSize,
            availableCapacity,
            estimatedWaitTime: this.calculateEstimatedWaitTime(queueSize, provider.average_job_duration || 900000)
          };
        })
      );

      // Select provider with highest score
      const bestProvider = providerScores.reduce((best, current) => 
        current.score > best.score ? current : best
      );

      if (bestProvider.availableCapacity === 0 && bestProvider.queueSize > 50) {
        throw new CapacityError('All providers at capacity', bestProvider.provider.provider);
      }

      const estimatedStartTime = new Date(Date.now() + bestProvider.estimatedWaitTime);
      const estimatedDuration = await this.estimateTrainingDuration(
        trainingConfig,
        bestProvider.provider.provider
      );
      const estimatedCompletionTime = new Date(estimatedStartTime.getTime() + estimatedDuration);

      return {
        selected_provider: bestProvider.provider.provider,
        estimated_start_time: estimatedStartTime.toISOString(),
        estimated_completion_time: estimatedCompletionTime.toISOString(),
        queue_position: bestProvider.queueSize + 1,
        reasoning: `Selected ${bestProvider.provider.provider} (score: ${bestProvider.score.toFixed(2)}, capacity: ${bestProvider.availableCapacity}, queue: ${bestProvider.queueSize})`
      };
    } catch (error) {
      console.error('Error selecting optimal provider:', error);
      throw error;
    }
  }

  /**
   * Get current queue size for a provider
   */
  private async getProviderQueueSize(provider: string): Promise<number> {
    const { count } = await supabase
      .from('training_queue')
      .select('*', { count: 'exact', head: true })
      .eq('provider', provider)
      .eq('status', 'queued');

    return count || 0;
  }

  /**
   * Calculate estimated wait time based on queue size and average job duration
   */
  private calculateEstimatedWaitTime(queueSize: number, averageJobDuration: number): number {
    // Simple estimation: queue size * average duration / concurrent capacity
    // This is a rough estimate and could be improved with more sophisticated modeling
    return queueSize * (averageJobDuration / 2); // Assume 50% overlap due to concurrency
  }

  /**
   * Estimate training duration based on configuration and provider
   */
  private async estimateTrainingDuration(
    trainingConfig: TrainingConfig,
    provider: string
  ): Promise<number> {
    // Base duration estimates (in milliseconds)
    const baseDurations = {
      runpod: 900000, // 15 minutes
      replicate: 1200000, // 20 minutes
      fal: 600000 // 10 minutes
    };

    let baseDuration = baseDurations[provider as keyof typeof baseDurations] || 900000;

    // Adjust based on training parameters
    const stepMultiplier = (trainingConfig.max_train_steps || 1000) / 1000;
    const resolutionMultiplier = (trainingConfig.resolution || 1024) / 1024;
    const imageCountMultiplier = Math.sqrt((trainingConfig.image_urls?.length || 10) / 10);

    return Math.round(baseDuration * stepMultiplier * resolutionMultiplier * imageCountMultiplier);
  }

  /**
   * Update queue entry status
   */
  async updateQueueEntry(
    queueEntryId: string,
    updates: UpdateQueueEntryRequest
  ): Promise<TrainingQueueEntry> {
    try {
      const { data, error } = await supabase
        .from('training_queue')
        .update(updates)
        .eq('id', queueEntryId)
        .select()
        .single();

      if (error) {
        throw new QueueError('Failed to update queue entry', 'UPDATE_FAILED', { error });
      }

      return data;
    } catch (error) {
      console.error('Error updating queue entry:', error);
      throw error;
    }
  }

  /**
   * Cancel training job
   */
  async cancelTraining(queueEntryId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('training_queue')
        .update({ status: 'cancelled' })
        .eq('id', queueEntryId)
        .eq('user_id', userId);

      if (error) {
        throw new QueueError('Failed to cancel training job', 'CANCEL_FAILED', { error });
      }
    } catch (error) {
      console.error('Error cancelling training job:', error);
      throw error;
    }
  }

  /**
   * Get queue status for user
   */
  async getUserQueueStatus(userId: string): Promise<QueueStatus> {
    try {
      const { data: userEntries } = await supabase
        .from('training_queue')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['queued', 'processing'])
        .order('created_at', { ascending: true });

      const { data: totalQueued } = await supabase
        .from('training_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'queued');

      const { data: totalProcessing } = await supabase
        .from('training_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'processing');

      const { data: providers } = await supabase
        .from('provider_capacity')
        .select('*')
        .eq('status', 'active');

      const providerStatus: ProviderStatus[] = providers?.map(p => ({
        provider: p.provider,
        available_capacity: Math.max(0, p.max_concurrent_jobs - p.current_jobs),
        current_load: p.current_jobs / p.max_concurrent_jobs,
        health_score: p.health_score,
        estimated_processing_time: p.average_job_duration || 900000
      })) || [];

      // Calculate estimated wait time for user's first queued job
      let estimatedWaitTime = 0;
      let queuePosition;
      
      if (userEntries?.length) {
        const firstEntry = userEntries[0];
        if (firstEntry.status === 'queued') {
          queuePosition = firstEntry.queue_position;
          estimatedWaitTime = this.calculateEstimatedWaitTime(
            queuePosition || 1,
            providerStatus.find(p => p.provider === firstEntry.provider)?.estimated_processing_time || 900000
          );
        }
      }

      return {
        total_queued: totalQueued?.length || 0,
        total_processing: totalProcessing?.length || 0,
        estimated_wait_time: estimatedWaitTime,
        queue_position: queuePosition,
        provider_status: providerStatus
      };
    } catch (error) {
      console.error('Error getting user queue status:', error);
      throw new QueueError('Failed to get queue status', 'STATUS_FAILED', { error });
    }
  }

  /**
   * Get queue metrics for monitoring
   */
  async getQueueMetrics(): Promise<QueueMetrics> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: currentQueue } = await supabase
        .from('training_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'queued');

      const { data: processing } = await supabase
        .from('training_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'processing');

      const { data: completedToday } = await supabase
        .from('training_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completion_time', `${today}T00:00:00Z`);

      const { data: failedToday } = await supabase
        .from('training_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('updated_at', `${today}T00:00:00Z`);

      const { data: statistics } = await supabase
        .from('queue_statistics')
        .select('*')
        .eq('date', today)
        .order('provider');

      const { data: providers } = await supabase
        .from('provider_capacity')
        .select('*')
        .eq('status', 'active');

      const providerHealth: ProviderStatus[] = providers?.map(p => ({
        provider: p.provider,
        available_capacity: Math.max(0, p.max_concurrent_jobs - p.current_jobs),
        current_load: p.current_jobs / p.max_concurrent_jobs,
        health_score: p.health_score,
        estimated_processing_time: p.average_job_duration || 900000
      })) || [];

      // Calculate averages from statistics
      const avgWaitTime = statistics?.reduce((sum, stat) => sum + (stat.average_wait_time || 0), 0) / (statistics?.length || 1);
      const avgProcessingTime = statistics?.reduce((sum, stat) => sum + (stat.average_processing_time || 0), 0) / (statistics?.length || 1);
      const throughputPerHour = statistics?.reduce((sum, stat) => sum + (stat.throughput_per_hour || 0), 0) || 0;

      return {
        current_queue_size: currentQueue?.length || 0,
        processing_jobs: processing?.length || 0,
        completed_today: completedToday?.length || 0,
        failed_today: failedToday?.length || 0,
        average_wait_time: avgWaitTime,
        average_processing_time: avgProcessingTime,
        throughput_per_hour: throughputPerHour,
        provider_health: providerHealth
      };
    } catch (error) {
      console.error('Error getting queue metrics:', error);
      throw new QueueError('Failed to get queue metrics', 'METRICS_FAILED', { error });
    }
  }

  /**
   * Process next job in queue
   */
  async processNextJob(): Promise<void> {
    try {
      // Get next job to process
      const { data: nextJob } = await supabase
        .from('training_queue')
        .select('*')
        .eq('status', 'queued')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (!nextJob) {
        return; // No jobs to process
      }

      // Check if provider has capacity
      const { data: provider } = await supabase
        .from('provider_capacity')
        .select('*')
        .eq('provider', nextJob.provider)
        .eq('status', 'active')
        .single();

      if (!provider || provider.current_jobs >= provider.max_concurrent_jobs) {
        return; // No capacity available
      }

      // Update job status to processing
      await this.updateQueueEntry(nextJob.id, {
        status: 'processing',
        actual_start_time: new Date().toISOString()
      });

      // Update provider capacity
      await supabase
        .from('provider_capacity')
        .update({ current_jobs: provider.current_jobs + 1 })
        .eq('id', provider.id);

      // Start actual training job (this would integrate with the existing training services)
      await this.startTrainingJob(nextJob);

    } catch (error) {
      console.error('Error processing next job:', error);
    }
  }

  /**
   * Start actual training job (placeholder for integration with existing services)
   */
  private async startTrainingJob(queueEntry: TrainingQueueEntry): Promise<void> {
    // This would integrate with the existing training services (RunPod, Replicate, etc.)
    // For now, we'll just log that the job would be started
    console.log(`Starting training job ${queueEntry.id} on ${queueEntry.provider}`);
    
    // TODO: Integrate with existing training services
    // - lib/runpod-service.ts for RunPod jobs
    // - lib/replicate.ts for Replicate jobs
    // - Add Fal.ai service integration
  }

  /**
   * Start queue processor (runs periodically to process jobs)
   */
  private startQueueProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Process queue every 30 seconds
    this.processingInterval = setInterval(async () => {
      try {
        await this.processNextJob();
      } catch (error) {
        console.error('Queue processor error:', error);
      }
    }, 30000);
  }

  /**
   * Stop queue processor
   */
  public stopQueueProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }
}

// Export singleton instance
export const trainingQueueService = TrainingQueueService.getInstance();