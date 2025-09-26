// Model Cleanup Scheduler
// Handles automatic cleanup of expired models and storage management

import { ModelStorageServiceImpl, SupabaseStorageProvider } from './model-storage-service';
import { ModelCleanupOptions } from '../types/model-storage';

export class ModelCleanupScheduler {
  private modelStorageService: ModelStorageServiceImpl;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    private options: {
      intervalMinutes?: number;
      maxStoragePerUserGB?: number;
      maxVersionsPerModel?: number;
      defaultExpirationDays?: number;
      cleanupInactiveDays?: number;
    } = {}
  ) {
    const storageProvider = new SupabaseStorageProvider(supabaseUrl, supabaseKey, 'model-weights');
    
    this.modelStorageService = new ModelStorageServiceImpl(
      supabaseUrl,
      supabaseKey,
      storageProvider,
      {
        maxStoragePerUserGB: options.maxStoragePerUserGB || 10,
        maxVersionsPerModel: options.maxVersionsPerModel || 5,
        defaultExpirationDays: options.defaultExpirationDays || 90
      }
    );
  }

  /**
   * Start the automatic cleanup scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Cleanup scheduler is already running');
      return;
    }

    const intervalMs = (this.options.intervalMinutes || 60) * 60 * 1000; // Default: 1 hour
    
    console.log(`Starting model cleanup scheduler (interval: ${this.options.intervalMinutes || 60} minutes)`);
    
    // Run initial cleanup
    this.runCleanup().catch(error => {
      console.error('Initial cleanup failed:', error);
    });

    // Schedule recurring cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch(error => {
        console.error('Scheduled cleanup failed:', error);
      });
    }, intervalMs);

    this.isRunning = true;
  }

  /**
   * Stop the automatic cleanup scheduler
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    console.log('Model cleanup scheduler stopped');
  }

  /**
   * Run cleanup operation manually
   */
  async runCleanup(options?: ModelCleanupOptions): Promise<void> {
    const cleanupOptions: ModelCleanupOptions = {
      cleanup_expired: true,
      cleanup_inactive_days: this.options.cleanupInactiveDays || 30,
      max_versions_per_model: this.options.maxVersionsPerModel || 5,
      max_storage_per_user_gb: this.options.maxStoragePerUserGB || 10,
      dry_run: false,
      ...options
    };

    try {
      console.log('Starting model cleanup operation...');
      const result = await this.modelStorageService.cleanupExpiredModels(cleanupOptions);
      
      console.log('Cleanup operation completed:', {
        models_cleaned: result.models_cleaned,
        bytes_freed: result.bytes_freed,
        files_deleted: result.files_deleted.length,
        errors: result.errors.length
      });

      if (result.errors.length > 0) {
        console.warn('Cleanup errors:', result.errors);
      }

      // Send notification if significant cleanup occurred
      if (result.models_cleaned > 0 || result.bytes_freed > 100 * 1024 * 1024) { // > 100MB
        await this.sendCleanupNotification(result);
      }
    } catch (error) {
      console.error('Cleanup operation failed:', error);
      throw error;
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{
    total_operations: number;
    total_bytes_freed: number;
    last_cleanup: string | null;
    next_cleanup: string | null;
  }> {
    try {
      const stats = await this.modelStorageService.getStorageStats();
      
      return {
        total_operations: stats.cleanup_operations,
        total_bytes_freed: 0, // This would need to be calculated from cleanup logs
        last_cleanup: null, // This would need to be fetched from cleanup logs
        next_cleanup: this.isRunning && this.cleanupInterval ? 
          new Date(Date.now() + (this.options.intervalMinutes || 60) * 60 * 1000).toISOString() : 
          null
      };
    } catch (error) {
      console.error('Failed to get cleanup stats:', error);
      throw error;
    }
  }

  /**
   * Send cleanup notification (placeholder for webhook/email integration)
   */
  private async sendCleanupNotification(result: any): Promise<void> {
    // This could be extended to send notifications via:
    // - Webhook to admin dashboard
    // - Email to administrators
    // - Slack/Discord notifications
    // - Database event for UI notifications

    const notification = {
      type: 'model_cleanup_completed',
      timestamp: new Date().toISOString(),
      data: {
        models_cleaned: result.models_cleaned,
        bytes_freed: result.bytes_freed,
        files_deleted: result.files_deleted.length,
        errors: result.errors.length
      }
    };

    console.log('Cleanup notification:', notification);

    // Example webhook call (uncomment and configure as needed)
    /*
    try {
      if (process.env.CLEANUP_WEBHOOK_URL) {
        await fetch(process.env.CLEANUP_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notification)
        });
      }
    } catch (error) {
      console.warn('Failed to send cleanup notification:', error);
    }
    */
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current configuration
   */
  getConfiguration(): typeof this.options {
    return { ...this.options };
  }

  /**
   * Update configuration (requires restart to take effect)
   */
  updateConfiguration(newOptions: Partial<typeof this.options>): void {
    this.options = { ...this.options, ...newOptions };
    console.log('Cleanup scheduler configuration updated:', this.options);
  }
}

// Singleton instance for application-wide use
let cleanupSchedulerInstance: ModelCleanupScheduler | null = null;

/**
 * Get or create the global cleanup scheduler instance
 */
export function getCleanupScheduler(): ModelCleanupScheduler {
  if (!cleanupSchedulerInstance) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables for cleanup scheduler');
    }

    cleanupSchedulerInstance = new ModelCleanupScheduler(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        intervalMinutes: parseInt(process.env.MODEL_CLEANUP_INTERVAL_MINUTES || '60'),
        maxStoragePerUserGB: parseInt(process.env.MAX_STORAGE_PER_USER_GB || '10'),
        maxVersionsPerModel: parseInt(process.env.MAX_VERSIONS_PER_MODEL || '5'),
        defaultExpirationDays: parseInt(process.env.DEFAULT_MODEL_EXPIRATION_DAYS || '90'),
        cleanupInactiveDays: parseInt(process.env.CLEANUP_INACTIVE_DAYS || '30')
      }
    );
  }

  return cleanupSchedulerInstance;
}

/**
 * Initialize cleanup scheduler on application startup
 */
export function initializeCleanupScheduler(): void {
  try {
    const scheduler = getCleanupScheduler();
    scheduler.start();
    console.log('Model cleanup scheduler initialized successfully');
  } catch (error) {
    console.error('Failed to initialize cleanup scheduler:', error);
  }
}

/**
 * Shutdown cleanup scheduler on application exit
 */
export function shutdownCleanupScheduler(): void {
  if (cleanupSchedulerInstance) {
    cleanupSchedulerInstance.stop();
    cleanupSchedulerInstance = null;
    console.log('Model cleanup scheduler shutdown completed');
  }
}