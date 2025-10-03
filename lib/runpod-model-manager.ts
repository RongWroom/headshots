/**
 * RunPod Model Manager
 * Handles downloading trained models and preparing them for inference
 */

import { Logger } from './logger';

export interface TrainedModel {
  id: string;
  name: string;
  trainingId: string;
  modelUrl?: string;
  triggerWord: string;
  status: 'training' | 'completed' | 'downloaded' | 'ready';
}

export class RunPodModelManager {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('RUNPOD_MODEL_MANAGER');
  }

  /**
   * Get the trained model URL from RunPod training results
   */
  async getTrainedModelUrl(trainingId: string): Promise<string | null> {
    try {
      const endpoint = process.env.RUNPOD_TRAINING_ENDPOINT?.replace('/run', '');
      const apiKey = process.env.RUNPOD_API_KEY;

      if (!endpoint || !apiKey) {
        throw new Error('RunPod configuration missing');
      }

      this.logger.logInfo('FETCHING_MODEL_URL', { trainingId });

      const response = await fetch(`${endpoint}/status/${trainingId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === 'COMPLETED' && data.output?.model_url) {
        this.logger.logSuccess('MODEL_URL_FOUND', {
          trainingId,
          modelUrl: data.output.model_url
        });
        return data.output.model_url;
      }

      if (data.status === 'FAILED') {
        throw new Error(`Training failed: ${data.error || 'Unknown error'}`);
      }

      // Still in progress
      this.logger.logInfo('TRAINING_IN_PROGRESS', {
        trainingId,
        status: data.status
      });
      return null;

    } catch (error) {
      this.logger.logError('MODEL_URL_FETCH_FAILED', error, { trainingId });
      throw error;
    }
  }

  /**
   * Download and store model file (for future use)
   */
  async downloadModel(modelUrl: string, modelName: string): Promise<string> {
    try {
      this.logger.logInfo('DOWNLOADING_MODEL', { modelUrl, modelName });

      // For now, we'll return the URL directly
      // In the future, you could download to your own storage
      // and return a local URL for faster inference

      this.logger.logSuccess('MODEL_READY', { modelUrl, modelName });
      return modelUrl;

    } catch (error) {
      this.logger.logError('MODEL_DOWNLOAD_FAILED', error, { modelUrl, modelName });
      throw error;
    }
  }

  /**
   * Prepare model for inference
   */
  async prepareModelForInference(trainingId: string, modelName: string): Promise<{
    modelUrl: string;
    triggerWord: string;
    ready: boolean;
  }> {
    try {
      // Get model URL from training results
      const modelUrl = await this.getTrainedModelUrl(trainingId);

      if (!modelUrl) {
        return {
          modelUrl: '',
          triggerWord: `sks${modelName.substring(0, 6)}`,
          ready: false
        };
      }

      // Download/prepare model
      const readyModelUrl = await this.downloadModel(modelUrl, modelName);

      return {
        modelUrl: readyModelUrl,
        triggerWord: `sks${modelName.substring(0, 6)}`,
        ready: true
      };

    } catch (error) {
      this.logger.logError('MODEL_PREPARATION_FAILED', error, { trainingId, modelName });
      throw error;
    }
  }
}

export const runPodModelManager = new RunPodModelManager();