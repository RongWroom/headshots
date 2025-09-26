// Model Storage API Endpoints
// Handles secure storage, versioning, and management of trained model weights

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ModelStorageServiceImpl, SupabaseStorageProvider } from '../../../../lib/model-storage-service';
import { CreateModelWeightRequest, ModelStorageError } from '../../../../types/model-storage';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const storageProvider = new SupabaseStorageProvider(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  'model-weights'
);

const modelStorageService = new ModelStorageServiceImpl(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  storageProvider,
  {
    maxStoragePerUserGB: parseInt(process.env.MAX_STORAGE_PER_USER_GB || '10'),
    maxVersionsPerModel: parseInt(process.env.MAX_VERSIONS_PER_MODEL || '5'),
    defaultExpirationDays: parseInt(process.env.DEFAULT_MODEL_EXPIRATION_DAYS || '90')
  }
);

// GET /api/models/storage - Get storage statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const modelId = searchParams.get('modelId');

    if (modelId) {
      // Get specific model versions
      const versions = await modelStorageService.getModelVersions(parseInt(modelId));
      return NextResponse.json({
        success: true,
        data: {
          modelId: parseInt(modelId),
          versions,
          totalVersions: versions.length,
          activeVersion: versions.find(v => v.is_active),
          totalStorageBytes: versions.reduce((sum, v) => sum + v.file_size, 0)
        }
      });
    } else {
      // Get storage statistics
      const stats = await modelStorageService.getStorageStats(userId || undefined);
      return NextResponse.json({
        success: true,
        data: stats
      });
    }
  } catch (error) {
    console.error('Storage API error:', error);
    
    if (error instanceof ModelStorageError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.code === 'MODEL_NOT_FOUND' ? 404 : 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/models/storage - Store new model weight
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const weightRequest: CreateModelWeightRequest = {
      model_id: body.model_id,
      file_path: body.file_path,
      file_size: body.file_size,
      file_hash: body.file_hash,
      storage_provider: body.storage_provider,
      metadata: body.metadata,
      training_config: body.training_config,
      quality_metrics: body.quality_metrics,
      expires_at: body.expires_at
    };

    // Validate required fields
    if (!weightRequest.model_id || !weightRequest.file_path || !weightRequest.file_size) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: model_id, file_path, file_size' },
        { status: 400 }
      );
    }

    const weight = await modelStorageService.storeModelWeight(weightRequest);

    return NextResponse.json({
      success: true,
      data: weight
    });
  } catch (error) {
    console.error('Store model weight error:', error);
    
    if (error instanceof ModelStorageError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.code === 'STORAGE_QUOTA_EXCEEDED' ? 413 : 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/models/storage - Delete model weight
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weightId = searchParams.get('weightId');

    if (!weightId) {
      return NextResponse.json(
        { success: false, error: 'Missing weightId parameter' },
        { status: 400 }
      );
    }

    await modelStorageService.deleteModelWeight(weightId);

    return NextResponse.json({
      success: true,
      message: 'Model weight deleted successfully'
    });
  } catch (error) {
    console.error('Delete model weight error:', error);
    
    if (error instanceof ModelStorageError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.code === 'MODEL_NOT_FOUND' ? 404 : 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}