// Model Sharing API Endpoints
// Handles model sharing permissions and access control

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ModelStorageServiceImpl, SupabaseStorageProvider } from '../../../../lib/model-storage-service';
import { CreateModelShareRequest, ModelStorageError } from '../../../../types/model-storage';

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
  storageProvider
);

// GET /api/models/share - Get model share by token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing share token' },
        { status: 400 }
      );
    }

    const share = await modelStorageService.getModelShare(token);

    if (!share) {
      return NextResponse.json(
        { success: false, error: 'Share not found or expired' },
        { status: 404 }
      );
    }

    // Get model information
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('id, name, type, status')
      .eq('id', share.model_id)
      .single();

    if (modelError || !model) {
      return NextResponse.json(
        { success: false, error: 'Model not found' },
        { status: 404 }
      );
    }

    // Get active model weight for download
    const activeWeight = await modelStorageService.getActiveModelWeight(share.model_id);

    return NextResponse.json({
      success: true,
      data: {
        share,
        model,
        activeWeight: activeWeight ? {
          id: activeWeight.id,
          version: activeWeight.version,
          file_size: activeWeight.file_size,
          metadata: activeWeight.metadata,
          quality_metrics: activeWeight.quality_metrics,
          created_at: activeWeight.created_at
        } : null
      }
    });
  } catch (error) {
    console.error('Get model share error:', error);
    
    if (error instanceof ModelStorageError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.code === 'MODEL_SHARE_EXPIRED' ? 410 : 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/models/share - Create new model share
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const shareRequest: CreateModelShareRequest = {
      model_id: body.model_id,
      shared_with: body.shared_with,
      access_level: body.access_level || 'view',
      expires_at: body.expires_at,
      max_downloads: body.max_downloads,
      is_public: body.is_public || false
    };

    // Validate required fields
    if (!shareRequest.model_id || !shareRequest.access_level) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: model_id, access_level' },
        { status: 400 }
      );
    }

    // Validate access level
    if (!['view', 'download', 'clone'].includes(shareRequest.access_level)) {
      return NextResponse.json(
        { success: false, error: 'Invalid access level. Must be: view, download, or clone' },
        { status: 400 }
      );
    }

    const share = await modelStorageService.createModelShare(shareRequest);

    return NextResponse.json({
      success: true,
      data: share
    });
  } catch (error) {
    console.error('Create model share error:', error);
    
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

// PUT /api/models/share - Update model share (increment download count)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, action } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing share token' },
        { status: 400 }
      );
    }

    const share = await modelStorageService.getModelShare(token);
    if (!share) {
      return NextResponse.json(
        { success: false, error: 'Share not found or expired' },
        { status: 404 }
      );
    }

    if (action === 'download') {
      // Check download limits
      if (share.max_downloads && share.download_count >= share.max_downloads) {
        return NextResponse.json(
          { success: false, error: 'Download limit exceeded' },
          { status: 429 }
        );
      }

      // Increment download count
      const { error: updateError } = await supabase
        .from('model_shares')
        .update({ 
          download_count: share.download_count + 1,
          last_accessed: new Date().toISOString()
        })
        .eq('id', share.id);

      if (updateError) {
        throw new Error(`Failed to update download count: ${updateError.message}`);
      }

      // Get download URL for the active model weight
      const activeWeight = await modelStorageService.getActiveModelWeight(share.model_id);
      if (!activeWeight) {
        return NextResponse.json(
          { success: false, error: 'No active model weight found' },
          { status: 404 }
        );
      }

      const downloadUrl = await storageProvider.getSignedUrl(
        activeWeight.file_path,
        3600 // 1 hour expiration
      );

      return NextResponse.json({
        success: true,
        data: {
          downloadUrl,
          fileName: `model_${share.model_id}_v${activeWeight.version}.safetensors`,
          fileSize: activeWeight.file_size,
          remainingDownloads: share.max_downloads ? share.max_downloads - share.download_count - 1 : null
        }
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Update model share error:', error);
    
    if (error instanceof ModelStorageError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}