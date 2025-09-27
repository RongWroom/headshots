// Model Storage Service
// Secure storage and management system for trained model weights

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import {
  ModelWeight,
  ModelShare,
  ModelExport,
  ModelCleanupLog,
  CreateModelWeightRequest,
  CreateModelShareRequest,
  CreateModelExportRequest,
  ModelStorageStats,
  ModelVersionHistory,
  ModelCleanupOptions,
  ModelCleanupResult,
  ModelStorageService,
  StorageProvider,
  ModelStorageError,
  ModelNotFoundError,
  StorageQuotaExceededError,
  InvalidModelVersionError,
  ModelShareExpiredError
} from '../types/model-storage';

export class ModelStorageServiceImpl implements ModelStorageService {
  private supabase;
  private storageProvider: StorageProvider;
  private maxStoragePerUserGB: number;
  private maxVersionsPerModel: number;
  private defaultExpirationDays: number;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    storageProvider: StorageProvider,
    options: {
      maxStoragePerUserGB?: number;
      maxVersionsPerModel?: number;
      defaultExpirationDays?: number;
    } = {}
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.storageProvider = storageProvider;
    this.maxStoragePerUserGB = options.maxStoragePerUserGB || 10;
    this.maxVersionsPerModel = options.maxVersionsPerModel || 5;
    this.defaultExpirationDays = options.defaultExpirationDays || 90;
  }

  async storeModelWeight(request: CreateModelWeightRequest): Promise<ModelWeight> {
    try {
      // Validate model exists and user has access
      const { data: model, error: modelError } = await this.supabase
        .from('models')
        .select('id, user_id')
        .eq('id', request.model_id)
        .single();

      if (modelError || !model) {
        throw new ModelNotFoundError(request.model_id);
      }

      // Check storage quota
      await this.checkStorageQuota(model.user_id, request.file_size);

      // Generate file hash if not provided
      const fileHash = request.file_hash || await this.generateFileHash(request.file_path);

      // Set expiration date if not provided
      const expiresAt = request.expires_at || 
        new Date(Date.now() + this.defaultExpirationDays * 24 * 60 * 60 * 1000).toISOString();

      // Insert model weight record
      const { data: weight, error: insertError } = await this.supabase
        .from('model_weights')
        .insert({
          model_id: request.model_id,
          file_path: request.file_path,
          file_size: request.file_size,
          file_hash: fileHash,
          storage_provider: request.storage_provider || 'supabase',
          metadata: request.metadata,
          training_config: request.training_config,
          quality_metrics: request.quality_metrics || {},
          expires_at: expiresAt,
          created_by: model.user_id
        })
        .select()
        .single();

      if (insertError) {
        throw new ModelStorageError('Failed to store model weight', 'STORAGE_ERROR', insertError);
      }

      // Clean up old versions if needed
      await this.cleanupOldVersions(request.model_id);

      return weight;
    } catch (error) {
      if (error instanceof ModelStorageError) {
        throw error;
      }
      throw new ModelStorageError('Failed to store model weight', 'UNKNOWN_ERROR', error);
    }
  }

  async getModelWeight(id: string): Promise<ModelWeight | null> {
    try {
      const { data: weight, error } = await this.supabase
        .from('model_weights')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new ModelStorageError('Failed to get model weight', 'FETCH_ERROR', error);
      }

      return weight || null;
    } catch (error) {
      if (error instanceof ModelStorageError) {
        throw error;
      }
      throw new ModelStorageError('Failed to get model weight', 'UNKNOWN_ERROR', error);
    }
  }

  async getModelVersions(modelId: number): Promise<ModelWeight[]> {
    try {
      const { data: weights, error } = await this.supabase
        .from('model_weights')
        .select('*')
        .eq('model_id', modelId)
        .order('version', { ascending: false });

      if (error) {
        throw new ModelStorageError('Failed to get model versions', 'FETCH_ERROR', error);
      }

      return weights || [];
    } catch (error) {
      if (error instanceof ModelStorageError) {
        throw error;
      }
      throw new ModelStorageError('Failed to get model versions', 'UNKNOWN_ERROR', error);
    }
  }

  async getActiveModelWeight(modelId: number): Promise<ModelWeight | null> {
    try {
      const { data: weight, error } = await this.supabase
        .from('model_weights')
        .select('*')
        .eq('model_id', modelId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new ModelStorageError('Failed to get active model weight', 'FETCH_ERROR', error);
      }

      return weight || null;
    } catch (error) {
      if (error instanceof ModelStorageError) {
        throw error;
      }
      throw new ModelStorageError('Failed to get active model weight', 'UNKNOWN_ERROR', error);
    }
  }

  async deleteModelWeight(id: string): Promise<void> {
    try {
      // Get weight info before deletion
      const weight = await this.getModelWeight(id);
      if (!weight) {
        throw new ModelNotFoundError(id);
      }

      // Delete from storage provider
      try {
        await this.storageProvider.delete(weight.file_path);
      } catch (storageError) {
        console.warn('Failed to delete file from storage provider:', storageError);
      }

      // Delete from database
      const { error } = await this.supabase
        .from('model_weights')
        .delete()
        .eq('id', id);

      if (error) {
        throw new ModelStorageError('Failed to delete model weight', 'DELETE_ERROR', error);
      }

      // Log cleanup operation
      await this.logCleanup(weight.model_id, 'user_requested', [weight.file_path], weight.file_size);
    } catch (error) {
      if (error instanceof ModelStorageError) {
        throw error;
      }
      throw new ModelStorageError('Failed to delete model weight', 'UNKNOWN_ERROR', error);
    }
  }

  async createModelShare(request: CreateModelShareRequest): Promise<ModelShare> {
    try {
      // Validate model exists and user has access
      const { data: model, error: modelError } = await this.supabase
        .from('models')
        .select('id, user_id')
        .eq('id', request.model_id)
        .single();

      if (modelError || !model) {
        throw new ModelNotFoundError(request.model_id);
      }

      // Generate share token
      const shareToken = this.generateShareToken();

      // Set expiration date if not provided (default 30 days)
      const expiresAt = request.expires_at || 
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: share, error: insertError } = await this.supabase
        .from('model_shares')
        .insert({
          model_id: request.model_id,
          shared_by: model.user_id,
          shared_with: request.shared_with,
          share_token: shareToken,
          access_level: request.access_level,
          expires_at: expiresAt,
          max_downloads: request.max_downloads,
          is_public: request.is_public || false
        })
        .select()
        .single();

      if (insertError) {
        throw new ModelStorageError('Failed to create model share', 'SHARE_ERROR', insertError);
      }

      return share;
    } catch (error) {
      if (error instanceof ModelStorageError) {
        throw error;
      }
      throw new ModelStorageError('Failed to create model share', 'UNKNOWN_ERROR', error);
    }
  }

  async getModelShare(token: string): Promise<ModelShare | null> {
    try {
      const { data: share, error } = await this.supabase
        .from('model_shares')
        .select('*')
        .eq('share_token', token)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new ModelStorageError('Failed to get model share', 'FETCH_ERROR', error);
      }

      if (!share) {
        return null;
      }

      // Check if share has expired
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        throw new ModelShareExpiredError(token);
      }

      // Update last accessed timestamp
      await this.supabase
        .from('model_shares')
        .update({ last_accessed: new Date().toISOString() })
        .eq('id', share.id);

      return share;
    } catch (error) {
      if (error instanceof ModelStorageError) {
        throw error;
      }
      throw new ModelStorageError('Failed to get model share', 'UNKNOWN_ERROR', error);
    }
  }

  async createModelExport(request: CreateModelExportRequest): Promise<ModelExport> {
    try {
      // Validate model exists and user has access
      const { data: model, error: modelError } = await this.supabase
        .from('models')
        .select('id, user_id')
        .eq('id', request.model_id)
        .single();

      if (modelError || !model) {
        throw new ModelNotFoundError(request.model_id);
      }

      const { data: exportRecord, error: insertError } = await this.supabase
        .from('model_exports')
        .insert({
          model_id: request.model_id,
          user_id: model.user_id,
          export_format: request.export_format,
          export_status: 'pending'
        })
        .select()
        .single();

      if (insertError) {
        throw new ModelStorageError('Failed to create model export', 'EXPORT_ERROR', insertError);
      }

      // Start export processing asynchronously
      this.processModelExport(exportRecord.id).catch(error => {
        console.error('Export processing failed:', error);
      });

      return exportRecord;
    } catch (error) {
      if (error instanceof ModelStorageError) {
        throw error;
      }
      throw new ModelStorageError('Failed to create model export', 'UNKNOWN_ERROR', error);
    }
  }

  async getModelExport(id: string): Promise<ModelExport | null> {
    try {
      const { data: exportRecord, error } = await this.supabase
        .from('model_exports')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new ModelStorageError('Failed to get model export', 'FETCH_ERROR', error);
      }

      return exportRecord || null;
    } catch (error) {
      if (error instanceof ModelStorageError) {
        throw error;
      }
      throw new ModelStorageError('Failed to get model export', 'UNKNOWN_ERROR', error);
    }
  }

  async cleanupExpiredModels(options: ModelCleanupOptions = { cleanup_expired: true }): Promise<ModelCleanupResult> {
    const result: ModelCleanupResult = {
      models_cleaned: 0,
      files_deleted: [],
      bytes_freed: 0,
      cleanup_logs: [],
      errors: []
    };

    try {
      if (options.cleanup_expired !== false) {
        // Clean up expired model weights
        const { data: expiredWeights, error } = await this.supabase
          .from('model_weights')
          .select('*')
          .lt('expires_at', new Date().toISOString());

        if (error) {
          result.errors.push(`Failed to fetch expired weights: ${error.message}`);
        } else if (expiredWeights) {
          for (const weight of expiredWeights) {
            try {
              if (!options.dry_run) {
                await this.storageProvider.delete(weight.file_path);
                await this.supabase.from('model_weights').delete().eq('id', weight.id);
              }
              
              result.files_deleted.push(weight.file_path);
              result.bytes_freed += weight.file_size;
              result.models_cleaned++;

              const cleanupLog = await this.logCleanup(
                weight.model_id,
                'expired',
                [weight.file_path],
                weight.file_size,
                'Automatic cleanup of expired model weights'
              );
              result.cleanup_logs.push(cleanupLog);
            } catch (cleanupError) {
              result.errors.push(`Failed to cleanup weight ${weight.id}: ${cleanupError}`);
            }
          }
        }
      }

      // Clean up inactive models if specified
      if (options.cleanup_inactive_days) {
        const inactiveDate = new Date();
        inactiveDate.setDate(inactiveDate.getDate() - options.cleanup_inactive_days);

        const { data: inactiveWeights, error: inactiveError } = await this.supabase
          .from('model_weights')
          .select('*')
          .lt('created_at', inactiveDate.toISOString())
          .eq('is_active', false);

        if (inactiveError) {
          result.errors.push(`Failed to fetch inactive weights: ${inactiveError.message}`);
        } else if (inactiveWeights) {
          for (const weight of inactiveWeights) {
            try {
              if (!options.dry_run) {
                await this.storageProvider.delete(weight.file_path);
                await this.supabase.from('model_weights').delete().eq('id', weight.id);
              }
              
              result.files_deleted.push(weight.file_path);
              result.bytes_freed += weight.file_size;
              result.models_cleaned++;

              const cleanupLog = await this.logCleanup(
                weight.model_id,
                'inactive',
                [weight.file_path],
                weight.file_size,
                `Cleanup of inactive model (${options.cleanup_inactive_days} days)`
              );
              result.cleanup_logs.push(cleanupLog);
            } catch (cleanupError) {
              result.errors.push(`Failed to cleanup inactive weight ${weight.id}: ${cleanupError}`);
            }
          }
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`Cleanup operation failed: ${error}`);
      return result;
    }
  }

  async getStorageStats(userId?: string): Promise<ModelStorageStats> {
    try {
      let query = this.supabase
        .from('model_weights')
        .select('file_size, is_active, model_id, expires_at');

      if (userId) {
        query = query.eq('created_by', userId);
      }

      const { data: weights, error } = await query;

      if (error) {
        throw new ModelStorageError('Failed to get storage stats', 'STATS_ERROR', error);
      }

      const stats: ModelStorageStats = {
        total_models: 0,
        total_storage_bytes: 0,
        active_versions: 0,
        expired_models: 0,
        shared_models: 0,
        public_models: 0,
        cleanup_operations: 0,
        average_model_size: 0
      };

      if (weights) {
        const uniqueModels = new Set();
        let totalSize = 0;

        for (const weight of weights) {
          uniqueModels.add(weight.model_id);
          totalSize += weight.file_size;
          
          if (weight.is_active) {
            stats.active_versions++;
          }
          
          if (weight.expires_at && new Date(weight.expires_at) < new Date()) {
            stats.expired_models++;
          }
        }

        stats.total_models = uniqueModels.size;
        stats.total_storage_bytes = totalSize;
        stats.average_model_size = weights.length > 0 ? totalSize / weights.length : 0;
      }

      // Get share stats
      const { data: shares } = await this.supabase
        .from('model_shares')
        .select('is_public');

      if (shares) {
        stats.shared_models = shares.length;
        stats.public_models = shares.filter(s => s.is_public).length;
      }

      // Get cleanup stats
      const { data: cleanupLogs } = await this.supabase
        .from('model_cleanup_log')
        .select('id');

      if (cleanupLogs) {
        stats.cleanup_operations = cleanupLogs.length;
      }

      return stats;
    } catch (error) {
      if (error instanceof ModelStorageError) {
        throw error;
      }
      throw new ModelStorageError('Failed to get storage stats', 'UNKNOWN_ERROR', error);
    }
  }

  // Private helper methods

  private async checkStorageQuota(userId: string, additionalBytes: number): Promise<void> {
    const stats = await this.getStorageStats(userId);
    const currentUsageGB = stats.total_storage_bytes / (1024 * 1024 * 1024);
    const additionalGB = additionalBytes / (1024 * 1024 * 1024);
    
    if (currentUsageGB + additionalGB > this.maxStoragePerUserGB) {
      throw new StorageQuotaExceededError(currentUsageGB + additionalGB, this.maxStoragePerUserGB);
    }
  }

  private async cleanupOldVersions(modelId: number): Promise<void> {
    const versions = await this.getModelVersions(modelId);
    
    if (versions.length > this.maxVersionsPerModel) {
      const versionsToDelete = versions
        .filter(v => !v.is_active)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(0, versions.length - this.maxVersionsPerModel);

      for (const version of versionsToDelete) {
        try {
          await this.deleteModelWeight(version.id);
        } catch (error) {
          console.warn(`Failed to cleanup old version ${version.id}:`, error);
        }
      }
    }
  }

  private async generateFileHash(filePath: string): Promise<string> {
    try {
      const fileBuffer = await this.storageProvider.download(filePath);
      return createHash('sha256').update(new Uint8Array(fileBuffer)).digest('hex');
    } catch (error) {
      console.warn('Failed to generate file hash:', error);
      return createHash('sha256').update(filePath + Date.now()).digest('hex');
    }
  }

  private generateShareToken(): string {
    return createHash('sha256')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex')
      .substring(0, 32);
  }

  private async logCleanup(
    modelId: number | null,
    cleanupType: 'expired' | 'user_requested' | 'storage_limit' | 'inactive',
    filesDeleted: string[],
    bytesFreed: number,
    reason?: string
  ): Promise<ModelCleanupLog> {
    const { data: log, error } = await this.supabase
      .from('model_cleanup_log')
      .insert({
        model_id: modelId,
        cleanup_type: cleanupType,
        files_deleted: filesDeleted,
        bytes_freed: bytesFreed,
        cleanup_reason: reason
      })
      .select()
      .single();

    if (error) {
      console.warn('Failed to log cleanup operation:', error);
    }

    return log;
  }

  private async processModelExport(exportId: string): Promise<void> {
    try {
      // Update status to processing
      await this.supabase
        .from('model_exports')
        .update({ export_status: 'processing' })
        .eq('id', exportId);

      const exportRecord = await this.getModelExport(exportId);
      if (!exportRecord) {
        throw new Error('Export record not found');
      }

      // Get active model weight
      const activeWeight = await this.getActiveModelWeight(exportRecord.model_id);
      if (!activeWeight) {
        throw new Error('No active model weight found');
      }

      // Generate signed download URL
      const downloadUrl = await this.storageProvider.getSignedUrl(
        activeWeight.file_path,
        24 * 60 * 60 // 24 hours
      );

      // Update export record with completion
      await this.supabase
        .from('model_exports')
        .update({
          export_status: 'completed',
          download_url: downloadUrl,
          file_size: activeWeight.file_size,
          completed_at: new Date().toISOString()
        })
        .eq('id', exportId);

    } catch (error) {
      // Update export record with error
      await this.supabase
        .from('model_exports')
        .update({
          export_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', exportId);
    }
  }
}

// Supabase Storage Provider Implementation
export class SupabaseStorageProvider implements StorageProvider {
  name = 'supabase';
  private supabase;
  private bucketName: string;

  constructor(supabaseUrl: string, supabaseKey: string, bucketName: string = 'model-weights') {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.bucketName = bucketName;
  }

  async upload(file: Buffer, path: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(path, file, {
        contentType: 'application/octet-stream',
        upsert: true
      });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    return data.path;
  }

  async download(path: string): Promise<Buffer> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .download(path);

    if (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
  }

  async delete(path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove([path]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async getSignedUrl(path: string, expiresIn: number): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  async getFileInfo(path: string): Promise<{ size: number; hash: string }> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .list(path.split('/').slice(0, -1).join('/'), {
        search: path.split('/').pop()
      });

    if (error || !data || data.length === 0) {
      throw new Error(`Failed to get file info: ${error?.message || 'File not found'}`);
    }

    const fileInfo = data[0];
    const fileBuffer = await this.download(path);
    const hash = createHash('sha256').update(new Uint8Array(fileBuffer)).digest('hex');

    return {
      size: fileInfo.metadata?.size || fileBuffer.length,
      hash
    };
  }
}