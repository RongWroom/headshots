// Training Load Balancer Service
// Handles automatic load balancing across multiple RunPod instances

import { createClient } from '@supabase/supabase-js';
import { ProviderCapacity, TrainingConfig, LoadBalancingDecision } from '../types/training-queue';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface RunPodInstance {
  id: string;
  endpoint_id: string;
  status: 'active' | 'starting' | 'stopping' | 'stopped' | 'error';
  gpu_type: string;
  location: string;
  cost_per_hour: number;
  max_concurrent_jobs: number;
  current_jobs: number;
  health_score: number;
  average_job_duration: number;
  last_health_check: Date;
}

export class TrainingLoadBalancer {
  private static instance: TrainingLoadBalancer;
  private healthCheckInterval?: NodeJS.Timeout;
  private runpodInstances: Map<string, RunPodInstance> = new Map();

  private constructor() {
    this.startHealthChecking();
  }

  public static getInstance(): TrainingLoadBalancer {
    if (!TrainingLoadBalancer.instance) {
      TrainingLoadBalancer.instance = new TrainingLoadBalancer();
    }
    return TrainingLoadBalancer.instance;
  }

  /**
   * Select optimal RunPod instance for training job
   */
  async selectOptimalInstance(
    trainingConfig: TrainingConfig,
    preferredGpuType?: string,
    preferredLocation?: string
  ): Promise<LoadBalancingDecision> {
    try {
      // Get available RunPod instances
      const availableInstances = await this.getAvailableInstances();
      
      if (!availableInstances.length) {
        // No instances available, try to start a new one
        const newInstance = await this.startNewInstance(trainingConfig);
        if (newInstance) {
          availableInstances.push(newInstance);
        } else {
          throw new Error('No RunPod instances available and unable to start new instance');
        }
      }

      // Filter by preferences
      let candidateInstances = availableInstances;
      
      if (preferredGpuType) {
        const gpuFiltered = candidateInstances.filter(i => i.gpu_type === preferredGpuType);
        if (gpuFiltered.length > 0) {
          candidateInstances = gpuFiltered;
        }
      }

      if (preferredLocation) {
        const locationFiltered = candidateInstances.filter(i => i.location === preferredLocation);
        if (locationFiltered.length > 0) {
          candidateInstances = locationFiltered;
        }
      }

      // Score each instance
      const instanceScores = candidateInstances.map(instance => {
        const capacityScore = this.calculateCapacityScore(instance);
        const performanceScore = this.calculatePerformanceScore(instance);
        const costScore = this.calculateCostScore(instance, trainingConfig);
        const healthScore = instance.health_score;

        // Weighted scoring
        const totalScore = (
          capacityScore * 0.35 +
          performanceScore * 0.25 +
          costScore * 0.25 +
          healthScore * 0.15
        );

        return {
          instance,
          score: totalScore,
          capacityScore,
          performanceScore,
          costScore,
          healthScore
        };
      });

      // Select best instance
      const bestInstance = instanceScores.reduce((best, current) => 
        current.score > best.score ? current : best
      );

      // Calculate timing estimates
      const queueSize = await this.getInstanceQueueSize(bestInstance.instance.id);
      const estimatedWaitTime = this.calculateWaitTime(queueSize, bestInstance.instance.average_job_duration);
      const estimatedDuration = this.estimateJobDuration(trainingConfig, bestInstance.instance.gpu_type);
      
      const estimatedStartTime = new Date(Date.now() + estimatedWaitTime);
      const estimatedCompletionTime = new Date(estimatedStartTime.getTime() + estimatedDuration);

      return {
        selected_provider: `runpod-${bestInstance.instance.id}`,
        estimated_start_time: estimatedStartTime.toISOString(),
        estimated_completion_time: estimatedCompletionTime.toISOString(),
        queue_position: queueSize + 1,
        reasoning: `Selected RunPod instance ${bestInstance.instance.id} (${bestInstance.instance.gpu_type}) with score ${bestInstance.score.toFixed(2)} - Capacity: ${bestInstance.capacityScore.toFixed(2)}, Performance: ${bestInstance.performanceScore.toFixed(2)}, Cost: ${bestInstance.costScore.toFixed(2)}, Health: ${bestInstance.healthScore.toFixed(2)}`
      };

    } catch (error) {
      console.error('Error selecting optimal instance:', error);
      throw error;
    }
  }

  /**
   * Get available RunPod instances
   */
  private async getAvailableInstances(): Promise<RunPodInstance[]> {
    try {
      // Get instances from database
      const { data: dbInstances, error } = await supabase
        .from('provider_capacity')
        .select('*')
        .eq('provider', 'runpod')
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching RunPod instances from database:', error);
        return [];
      }

      // Convert to RunPodInstance format and filter available
      const instances: RunPodInstance[] = (dbInstances || [])
        .map(db => ({
          id: db.instance_id || 'default',
          endpoint_id: db.metadata?.endpoint_id || '',
          status: 'active' as const,
          gpu_type: db.metadata?.gpu_type || 'RTX4090',
          location: db.metadata?.location || 'US-CA',
          cost_per_hour: db.metadata?.cost_per_hour || 0.50,
          max_concurrent_jobs: db.max_concurrent_jobs,
          current_jobs: db.current_jobs,
          health_score: db.health_score,
          average_job_duration: db.average_job_duration || 900000,
          last_health_check: new Date(db.last_health_check)
        }))
        .filter(instance => instance.current_jobs < instance.max_concurrent_jobs);

      return instances;
    } catch (error) {
      console.error('Error getting available instances:', error);
      return [];
    }
  }

  /**
   * Start a new RunPod instance if needed
   */
  private async startNewInstance(trainingConfig: TrainingConfig): Promise<RunPodInstance | null> {
    try {
      // This would integrate with RunPod API to start a new instance
      // For now, we'll just log that we would start an instance
      console.log('Would start new RunPod instance for training config:', trainingConfig);
      
      // TODO: Implement actual RunPod instance creation
      // const response = await fetch('https://api.runpod.ai/v2/pods', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({
      //     name: `training-${Date.now()}`,
      //     imageName: 'your-training-image',
      //     gpuTypeId: 'NVIDIA RTX 4090',
      //     cloudType: 'SECURE',
      //     supportPublicIp: true,
      //     startJupyter: false,
      //     startSsh: false
      //   })
      // });

      return null;
    } catch (error) {
      console.error('Error starting new RunPod instance:', error);
      return null;
    }
  }

  /**
   * Calculate capacity score (0-1, higher is better)
   */
  private calculateCapacityScore(instance: RunPodInstance): number {
    const availableCapacity = instance.max_concurrent_jobs - instance.current_jobs;
    return availableCapacity / instance.max_concurrent_jobs;
  }

  /**
   * Calculate performance score (0-1, higher is better)
   */
  private calculatePerformanceScore(instance: RunPodInstance): number {
    // Score based on GPU type and average job duration
    const gpuScores = {
      'H100': 1.0,
      'A100': 0.9,
      'RTX4090': 0.8,
      'RTX3090': 0.7,
      'V100': 0.6
    };

    const gpuScore = gpuScores[instance.gpu_type as keyof typeof gpuScores] || 0.5;
    
    // Prefer faster instances (lower average duration)
    const speedScore = Math.max(0, 1 - (instance.average_job_duration / 1800000)); // 30 min baseline
    
    return (gpuScore + speedScore) / 2;
  }

  /**
   * Calculate cost score (0-1, higher is better for lower cost)
   */
  private calculateCostScore(instance: RunPodInstance, trainingConfig: TrainingConfig): number {
    const estimatedDuration = this.estimateJobDuration(trainingConfig, instance.gpu_type);
    const estimatedCost = (estimatedDuration / 3600000) * instance.cost_per_hour; // Convert to hours
    
    // Score inversely proportional to cost (lower cost = higher score)
    // Assume $2.00 as baseline expensive cost
    return Math.max(0, 1 - (estimatedCost / 2.0));
  }

  /**
   * Get current queue size for an instance
   */
  private async getInstanceQueueSize(instanceId: string): Promise<number> {
    const { count } = await supabase
      .from('training_queue')
      .select('*', { count: 'exact', head: true })
      .eq('provider', `runpod-${instanceId}`)
      .eq('status', 'queued');

    return count || 0;
  }

  /**
   * Calculate estimated wait time
   */
  private calculateWaitTime(queueSize: number, averageJobDuration: number): number {
    // Simple estimation: queue size * average duration
    return queueSize * averageJobDuration;
  }

  /**
   * Estimate job duration based on config and GPU type
   */
  private estimateJobDuration(trainingConfig: TrainingConfig, gpuType: string): number {
    // Base durations by GPU type (in milliseconds)
    const baseDurations = {
      'H100': 300000,    // 5 minutes
      'A100': 450000,    // 7.5 minutes
      'RTX4090': 600000, // 10 minutes
      'RTX3090': 900000, // 15 minutes
      'V100': 1200000    // 20 minutes
    };

    let baseDuration = baseDurations[gpuType as keyof typeof baseDurations] || 900000;

    // Adjust based on training parameters
    const stepMultiplier = (trainingConfig.max_train_steps || 1000) / 1000;
    const resolutionMultiplier = (trainingConfig.resolution || 1024) / 1024;
    const imageCountMultiplier = Math.sqrt((trainingConfig.image_urls?.length || 10) / 10);

    return Math.round(baseDuration * stepMultiplier * resolutionMultiplier * imageCountMultiplier);
  }

  /**
   * Update instance health and capacity
   */
  async updateInstanceHealth(instanceId: string, healthData: Partial<RunPodInstance>): Promise<void> {
    try {
      await supabase
        .from('provider_capacity')
        .update({
          current_jobs: healthData.current_jobs,
          health_score: healthData.health_score,
          average_job_duration: healthData.average_job_duration,
          last_health_check: new Date().toISOString(),
          metadata: {
            gpu_type: healthData.gpu_type,
            location: healthData.location,
            cost_per_hour: healthData.cost_per_hour,
            endpoint_id: healthData.endpoint_id
          }
        })
        .eq('provider', 'runpod')
        .eq('instance_id', instanceId);

    } catch (error) {
      console.error('Error updating instance health:', error);
    }
  }

  /**
   * Start health checking for all instances
   */
  private startHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Check health every 2 minutes
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        console.error('Health check error:', error);
      }
    }, 120000);
  }

  /**
   * Perform health checks on all instances
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const instances = await this.getAvailableInstances();
      
      for (const instance of instances) {
        try {
          // This would make actual health check requests to RunPod instances
          // For now, we'll simulate health checks
          const healthScore = await this.checkInstanceHealth(instance);
          
          await this.updateInstanceHealth(instance.id, {
            health_score: healthScore,
            last_health_check: new Date()
          });
          
        } catch (error) {
          console.error(`Health check failed for instance ${instance.id}:`, error);
          
          // Mark instance as unhealthy
          await this.updateInstanceHealth(instance.id, {
            health_score: 0,
            last_health_check: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error performing health checks:', error);
    }
  }

  /**
   * Check health of a specific instance
   */
  private async checkInstanceHealth(instance: RunPodInstance): Promise<number> {
    try {
      // This would make an actual health check request to the RunPod instance
      // For now, we'll simulate based on age of last check and current load
      
      const timeSinceLastCheck = Date.now() - instance.last_health_check.getTime();
      const loadFactor = instance.current_jobs / instance.max_concurrent_jobs;
      
      // Simulate health score based on load and recency
      let healthScore = 1.0;
      
      // Penalize high load
      healthScore -= loadFactor * 0.3;
      
      // Penalize stale health checks
      if (timeSinceLastCheck > 300000) { // 5 minutes
        healthScore -= 0.2;
      }
      
      // Add some randomness to simulate real-world variability
      healthScore += (Math.random() - 0.5) * 0.1;
      
      return Math.max(0, Math.min(1, healthScore));
      
    } catch (error) {
      console.error('Error checking instance health:', error);
      return 0;
    }
  }

  /**
   * Stop health checking
   */
  public stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }
}

// Export singleton instance
export const trainingLoadBalancer = TrainingLoadBalancer.getInstance();