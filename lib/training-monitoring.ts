/**
 * Training Monitoring Service
 * Comprehensive service for tracking training sessions, status updates, and performance metrics
 */

import { createClient } from '@supabase/supabase-js';
import { Logger } from './logger';
import {
  TrainingSession,
  TrainingStatusUpdate,
  TrainingPerformanceMetric,
  TrainingHistorySummary,
  WebhookEvent,
  TrainingMonitoringService,
  CreateTrainingSessionParams,
  CreateStatusUpdateParams,
  CreatePerformanceMetricParams,
  CreateWebhookEventParams,
  GetSessionsOptions,
  GetHistoryOptions,
  TrainingProgressInfo,
  TrainingTimeEstimation,
  TrainingStatus,
  RunPodWebhookPayload,
  ReplicateWebhookPayload,
  FalWebhookPayload
} from '@/types/training-monitoring';

export class TrainingMonitoringServiceImpl implements TrainingMonitoringService {
  private supabase;
  private logger: Logger;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.logger = new Logger('TRAINING_MONITORING');
  }

  /**
   * Create a new training session
   */
  async createTrainingSession(params: CreateTrainingSessionParams): Promise<TrainingSession> {
    this.logger.logInfo('CREATE_TRAINING_SESSION', {
      modelId: params.model_id,
      userId: params.user_id,
      provider: params.provider
    });

    const sessionData = {
      model_id: params.model_id,
      user_id: params.user_id,
      provider: params.provider,
      external_training_id: params.external_training_id,
      status: 'pending' as TrainingStatus,
      progress: 0,
      current_step: 0,
      total_steps: params.total_steps,
      retry_count: 0,
      webhook_events: [],
      training_config: params.training_config,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('training_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      this.logger.logError('CREATE_TRAINING_SESSION_FAILED', error);
      throw new Error(`Failed to create training session: ${error.message}`);
    }

    // Add initial status update
    await this.addStatusUpdate(data.id, {
      status: 'pending',
      message: 'Training session created',
      source: 'system'
    });

    this.logger.logSuccess('TRAINING_SESSION_CREATED', {
      sessionId: data.id,
      modelId: params.model_id
    });

    return data;
  }

  /**
   * Update training session
   */
  async updateTrainingSession(sessionId: string, updates: Partial<TrainingSession>): Promise<TrainingSession> {
    this.logger.logInfo('UPDATE_TRAINING_SESSION', {
      sessionId,
      updates: Object.keys(updates)
    });

    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('training_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      this.logger.logError('UPDATE_TRAINING_SESSION_FAILED', error, { sessionId });
      throw new Error(`Failed to update training session: ${error.message}`);
    }

    // Add status update if status changed
    if (updates.status) {
      await this.addStatusUpdate(sessionId, {
        status: updates.status,
        progress: updates.progress,
        current_step: updates.current_step,
        message: updates.error_message || `Status changed to ${updates.status}`,
        source: 'system'
      });
    }

    this.logger.logSuccess('TRAINING_SESSION_UPDATED', { sessionId });
    return data;
  }

  /**
   * Get training session by ID
   */
  async getTrainingSession(sessionId: string): Promise<TrainingSession | null> {
    const { data, error } = await this.supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        return null;
      }
      this.logger.logError('GET_TRAINING_SESSION_FAILED', error, { sessionId });
      throw new Error(`Failed to get training session: ${error.message}`);
    }

    return data;
  }

  /**
   * Get training sessions by model ID
   */
  async getTrainingSessionsByModel(modelId: number): Promise<TrainingSession[]> {
    const { data, error } = await this.supabase
      .from('training_sessions')
      .select('*')
      .eq('model_id', modelId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.logError('GET_TRAINING_SESSIONS_BY_MODEL_FAILED', error, { modelId });
      throw new Error(`Failed to get training sessions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get training sessions by user ID
   */
  async getTrainingSessionsByUser(userId: string, options: GetSessionsOptions = {}): Promise<TrainingSession[]> {
    let query = this.supabase
      .from('training_sessions')
      .select('*')
      .eq('user_id', userId);

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.provider) {
      query = query.eq('provider', options.provider);
    }

    const orderBy = options.orderBy || 'created_at';
    const orderDirection = options.orderDirection || 'desc';
    query = query.order(orderBy, { ascending: orderDirection === 'asc' });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.logError('GET_TRAINING_SESSIONS_BY_USER_FAILED', error, { userId });
      throw new Error(`Failed to get training sessions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Add status update
   */
  async addStatusUpdate(sessionId: string, update: CreateStatusUpdateParams): Promise<TrainingStatusUpdate> {
    const updateData = {
      training_session_id: sessionId,
      status: update.status,
      progress: update.progress,
      current_step: update.current_step,
      message: update.message,
      details: update.details,
      source: update.source || 'system',
      created_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('training_status_updates')
      .insert(updateData)
      .select()
      .single();

    if (error) {
      this.logger.logError('ADD_STATUS_UPDATE_FAILED', error, { sessionId });
      throw new Error(`Failed to add status update: ${error.message}`);
    }

    this.logger.logInfo('STATUS_UPDATE_ADDED', {
      sessionId,
      status: update.status,
      progress: update.progress
    });

    return data;
  }

  /**
   * Add performance metric
   */
  async addPerformanceMetric(sessionId: string, metric: CreatePerformanceMetricParams): Promise<TrainingPerformanceMetric> {
    const metricData = {
      training_session_id: sessionId,
      metric_type: metric.metric_type,
      metric_value: metric.metric_value,
      step: metric.step,
      timestamp: new Date().toISOString(),
      metadata: metric.metadata
    };

    const { data, error } = await this.supabase
      .from('training_performance_metrics')
      .insert(metricData)
      .select()
      .single();

    if (error) {
      this.logger.logError('ADD_PERFORMANCE_METRIC_FAILED', error, { sessionId });
      throw new Error(`Failed to add performance metric: ${error.message}`);
    }

    return data;
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event: CreateWebhookEventParams): Promise<WebhookEvent> {
    this.logger.logInfo('PROCESS_WEBHOOK_EVENT', {
      provider: event.provider,
      eventType: event.event_type,
      sessionId: event.training_session_id
    });

    // Store the webhook event
    const webhookData = {
      training_session_id: event.training_session_id,
      provider: event.provider,
      event_type: event.event_type,
      event_data: event.event_data,
      processed: false,
      received_at: new Date().toISOString()
    };

    const { data: webhookEvent, error: webhookError } = await this.supabase
      .from('webhook_events')
      .insert(webhookData)
      .select()
      .single();

    if (webhookError) {
      this.logger.logError('STORE_WEBHOOK_EVENT_FAILED', webhookError);
      throw new Error(`Failed to store webhook event: ${webhookError.message}`);
    }

    try {
      // Process the webhook based on provider
      await this.processProviderWebhook(event.provider, event.event_data, event.training_session_id);

      // Mark webhook as processed
      await this.supabase
        .from('webhook_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('id', webhookEvent.id);

      this.logger.logSuccess('WEBHOOK_EVENT_PROCESSED', {
        webhookId: webhookEvent.id,
        provider: event.provider
      });

    } catch (error) {
      // Mark webhook as failed
      await this.supabase
        .from('webhook_events')
        .update({
          processed: true,
          processing_error: error instanceof Error ? error.message : 'Unknown error',
          processed_at: new Date().toISOString()
        })
        .eq('id', webhookEvent.id);

      this.logger.logError('WEBHOOK_EVENT_PROCESSING_FAILED', error, {
        webhookId: webhookEvent.id
      });

      throw error;
    }

    return webhookEvent;
  }

  /**
   * Process provider-specific webhook
   */
  private async processProviderWebhook(provider: string, eventData: any, sessionId?: string): Promise<void> {
    if (!sessionId) {
      // Try to find session by external training ID
      const externalId = this.extractExternalTrainingId(provider, eventData);
      if (externalId) {
        const session = await this.findSessionByExternalId(provider, externalId);
        if (session) {
          sessionId = session.id;
        }
      }
    }

    if (!sessionId) {
      this.logger.logWarning('WEBHOOK_NO_SESSION_FOUND', 'No training session found for webhook', {
        provider,
        eventData
      });
      return;
    }

    switch (provider) {
      case 'runpod':
        await this.processRunPodWebhook(sessionId, eventData as RunPodWebhookPayload);
        break;
      case 'replicate':
        await this.processReplicateWebhook(sessionId, eventData as ReplicateWebhookPayload);
        break;
      case 'fal':
        await this.processFalWebhook(sessionId, eventData as FalWebhookPayload);
        break;
      default:
        this.logger.logWarning('UNKNOWN_WEBHOOK_PROVIDER', `Unknown webhook provider: ${provider}`);
    }
  }

  /**
   * Process RunPod webhook
   */
  private async processRunPodWebhook(sessionId: string, payload: RunPodWebhookPayload): Promise<void> {
    const statusMap: Record<string, TrainingStatus> = {
      'IN_QUEUE': 'queued',
      'IN_PROGRESS': 'training',
      'COMPLETED': 'completed',
      'FAILED': 'failed',
      'CANCELLED': 'cancelled'
    };

    const status = statusMap[payload.status] || 'pending';
    const progress = payload.progress?.percentage || 0;
    const currentStep = payload.progress?.current_step || 0;

    const updates: Partial<TrainingSession> = {
      status,
      progress,
      current_step: currentStep
    };

    if (status === 'training' && !await this.hasTrainingStarted(sessionId)) {
      updates.training_started_at = new Date().toISOString();
    }

    if (status === 'completed' || status === 'failed') {
      updates.training_completed_at = new Date().toISOString();
      
      if (payload.executionTime) {
        updates.training_duration = payload.executionTime * 1000; // Convert to milliseconds
      }
      
      if (status === 'failed' && payload.error) {
        updates.error_message = payload.error;
        updates.error_code = 'RUNPOD_TRAINING_FAILED';
      }
    }

    await this.updateTrainingSession(sessionId, updates);

    // Add performance metrics if available
    if (payload.executionTime) {
      await this.addPerformanceMetric(sessionId, {
        metric_type: 'execution_time',
        metric_value: payload.executionTime,
        metadata: { source: 'webhook' }
      });
    }
  }

  /**
   * Process Replicate webhook
   */
  private async processReplicateWebhook(sessionId: string, payload: ReplicateWebhookPayload): Promise<void> {
    const statusMap: Record<string, TrainingStatus> = {
      'starting': 'queued',
      'processing': 'training',
      'succeeded': 'completed',
      'failed': 'failed',
      'canceled': 'cancelled'
    };

    const status = statusMap[payload.status] || 'pending';

    const updates: Partial<TrainingSession> = {
      status
    };

    if (status === 'training' && !await this.hasTrainingStarted(sessionId)) {
      updates.training_started_at = new Date().toISOString();
    }

    if (status === 'completed' || status === 'failed') {
      updates.training_completed_at = new Date().toISOString();
      
      if (payload.metrics?.total_time) {
        updates.training_duration = payload.metrics.total_time * 1000;
      }
      
      if (status === 'failed' && payload.error) {
        updates.error_message = payload.error;
        updates.error_code = 'REPLICATE_TRAINING_FAILED';
      }
    }

    await this.updateTrainingSession(sessionId, updates);
  }

  /**
   * Process Fal webhook
   */
  private async processFalWebhook(sessionId: string, payload: FalWebhookPayload): Promise<void> {
    const statusMap: Record<string, TrainingStatus> = {
      'IN_QUEUE': 'queued',
      'IN_PROGRESS': 'training',
      'COMPLETED': 'completed',
      'FAILED': 'failed'
    };

    const status = statusMap[payload.status] || 'pending';

    const updates: Partial<TrainingSession> = {
      status
    };

    if (status === 'training' && !await this.hasTrainingStarted(sessionId)) {
      updates.training_started_at = new Date().toISOString();
    }

    if (status === 'completed' || status === 'failed') {
      updates.training_completed_at = new Date().toISOString();
      
      if (payload.metrics?.inference_time) {
        updates.training_duration = payload.metrics.inference_time * 1000;
      }
      
      if (status === 'failed' && payload.error) {
        updates.error_message = payload.error;
        updates.error_code = 'FAL_TRAINING_FAILED';
      }
    }

    await this.updateTrainingSession(sessionId, updates);
  }

  /**
   * Get training history summary
   */
  async getTrainingHistory(userId: string, options: GetHistoryOptions = {}): Promise<TrainingHistorySummary[]> {
    let query = this.supabase
      .from('training_history_summary')
      .select('*')
      .eq('user_id', userId);

    if (options.provider) {
      query = query.eq('provider', options.provider);
    }

    if (options.startDate) {
      query = query.gte('date', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('date', options.endDate);
    }

    query = query.order('date', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.logError('GET_TRAINING_HISTORY_FAILED', error, { userId });
      throw new Error(`Failed to get training history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Estimate completion time for training session
   */
  async estimateCompletionTime(sessionId: string): Promise<Date | null> {
    const session = await this.getTrainingSession(sessionId);
    if (!session || !session.training_started_at) {
      return null;
    }

    const progressInfo = await this.calculateTrainingProgress(sessionId);
    if (progressInfo.estimatedTimeRemaining <= 0) {
      return null;
    }

    return new Date(Date.now() + progressInfo.estimatedTimeRemaining);
  }

  /**
   * Calculate training progress information
   */
  async calculateTrainingProgress(sessionId: string): Promise<TrainingProgressInfo> {
    const session = await this.getTrainingSession(sessionId);
    if (!session) {
      throw new Error('Training session not found');
    }

    const now = new Date();
    const startTime = session.training_started_at ? new Date(session.training_started_at) : new Date(session.created_at);
    const elapsedTime = now.getTime() - startTime.getTime();

    let estimatedTimeRemaining = 0;
    let averageStepTime = 0;
    let stepsPerSecond = 0;
    let isStalled = false;

    if (session.current_step > 0 && session.total_steps) {
      averageStepTime = elapsedTime / session.current_step;
      stepsPerSecond = session.current_step / (elapsedTime / 1000);
      
      const remainingSteps = session.total_steps - session.current_step;
      estimatedTimeRemaining = remainingSteps * averageStepTime;

      // Check if training is stalled (no progress in last 10 minutes)
      const lastUpdate = await this.getLastStatusUpdate(sessionId);
      if (lastUpdate) {
        const timeSinceLastUpdate = now.getTime() - new Date(lastUpdate.created_at).getTime();
        isStalled = timeSinceLastUpdate > 10 * 60 * 1000; // 10 minutes
      }
    } else if (session.status === 'training') {
      // Use historical average for estimation
      const historicalAverage = await this.getHistoricalAverageTrainingTime(session.user_id, session.provider);
      if (historicalAverage) {
        estimatedTimeRemaining = Math.max(0, historicalAverage - elapsedTime);
      }
    }

    const progressPercentage = session.total_steps ? 
      Math.min(100, (session.current_step / session.total_steps) * 100) : 
      session.progress;

    let statusMessage = this.getStatusMessage(session.status, progressPercentage, isStalled);

    return {
      currentStep: session.current_step,
      totalSteps: session.total_steps || 0,
      progressPercentage,
      elapsedTime,
      estimatedTimeRemaining: Math.max(0, estimatedTimeRemaining),
      averageStepTime,
      stepsPerSecond,
      statusMessage,
      isStalled,
      lastUpdateTime: session.updated_at
    };
  }

  // Helper methods

  private async hasTrainingStarted(sessionId: string): Promise<boolean> {
    const session = await this.getTrainingSession(sessionId);
    return !!(session?.training_started_at);
  }

  private async getLastStatusUpdate(sessionId: string): Promise<TrainingStatusUpdate | null> {
    const { data, error } = await this.supabase
      .from('training_status_updates')
      .select('*')
      .eq('training_session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.logError('GET_LAST_STATUS_UPDATE_FAILED', error);
    }

    return data || null;
  }

  private async getHistoricalAverageTrainingTime(userId: string, provider: string): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('training_sessions')
      .select('training_duration')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('status', 'completed')
      .not('training_duration', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !data || data.length === 0) {
      return null;
    }

    const totalTime = data.reduce((sum, session) => sum + (session.training_duration || 0), 0);
    return totalTime / data.length;
  }

  private extractExternalTrainingId(provider: string, eventData: any): string | null {
    switch (provider) {
      case 'runpod':
        return eventData.id || null;
      case 'replicate':
        return eventData.id || null;
      case 'fal':
        return eventData.request_id || null;
      default:
        return null;
    }
  }

  private async findSessionByExternalId(provider: string, externalId: string): Promise<TrainingSession | null> {
    const { data, error } = await this.supabase
      .from('training_sessions')
      .select('*')
      .eq('provider', provider)
      .eq('external_training_id', externalId)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.logError('FIND_SESSION_BY_EXTERNAL_ID_FAILED', error);
    }

    return data || null;
  }

  private getStatusMessage(status: TrainingStatus, progress: number, isStalled: boolean): string {
    if (isStalled) {
      return 'Training appears to be stalled - no progress updates received recently';
    }

    switch (status) {
      case 'pending':
        return 'Waiting to start training...';
      case 'queued':
        return 'Training job is queued and waiting for resources...';
      case 'training':
        return progress > 0 ? `Training in progress (${progress.toFixed(1)}%)...` : 'Training in progress...';
      case 'completed':
        return 'Training completed successfully!';
      case 'failed':
        return 'Training failed - check error details';
      case 'cancelled':
        return 'Training was cancelled';
      default:
        return 'Unknown status';
    }
  }
}

// Export singleton instance
export const trainingMonitoringService = new TrainingMonitoringServiceImpl();