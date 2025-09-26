// Model Export API Endpoints
// Handles model export requests and download links

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ModelStorageServiceImpl, SupabaseStorageProvider } from '../../../../lib/model-storage-service';
import { CreateModelExportRequest, ModelStorageError } from '../../../../types/model-storage';

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

// GET /api/models/export - Get export status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const exportId = searchParams.get('exportId');
    const userId = searchParams.get('userId');

    if (exportId) {
      // Get specific export
      const exportRecord = await modelStorageService.getModelExport(exportId);
      
      if (!exportRecord) {
        return NextResponse.json(
          { success: false, error: 'Export not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: exportRecord
      });
    } else if (userId) {
      // Get user's exports
      const { data: exports, error } = await supabase
        .from('model_exports')
        .select(`
          *,
          models!inner(id, name, type)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw new Error(`Failed to fetch exports: ${error.message}`);
      }

      return NextResponse.json({
        success: true,
        data: exports || []
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing exportId or userId parameter' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Get model export error:', error);
    
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

// POST /api/models/export - Create new export request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const exportRequest: CreateModelExportRequest = {
      model_id: body.model_id,
      export_format: body.export_format || 'safetensors'
    };

    // Validate required fields
    if (!exportRequest.model_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: model_id' },
        { status: 400 }
      );
    }

    // Validate export format
    if (!['safetensors', 'pytorch', 'onnx', 'zip'].includes(exportRequest.export_format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid export format. Must be: safetensors, pytorch, onnx, or zip' },
        { status: 400 }
      );
    }

    // Check if user has an active export for this model
    const { data: existingExports, error: checkError } = await supabase
      .from('model_exports')
      .select('id, export_status')
      .eq('model_id', exportRequest.model_id)
      .in('export_status', ['pending', 'processing'])
      .limit(1);

    if (checkError) {
      throw new Error(`Failed to check existing exports: ${checkError.message}`);
    }

    if (existingExports && existingExports.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'An export is already in progress for this model',
          existingExportId: existingExports[0].id
        },
        { status: 409 }
      );
    }

    const exportRecord = await modelStorageService.createModelExport(exportRequest);

    return NextResponse.json({
      success: true,
      data: exportRecord
    });
  } catch (error) {
    console.error('Create model export error:', error);
    
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

// DELETE /api/models/export - Cancel export request
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const exportId = searchParams.get('exportId');

    if (!exportId) {
      return NextResponse.json(
        { success: false, error: 'Missing exportId parameter' },
        { status: 400 }
      );
    }

    const exportRecord = await modelStorageService.getModelExport(exportId);
    if (!exportRecord) {
      return NextResponse.json(
        { success: false, error: 'Export not found' },
        { status: 404 }
      );
    }

    // Only allow cancellation of pending or processing exports
    if (!['pending', 'processing'].includes(exportRecord.export_status)) {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel completed or failed export' },
        { status: 400 }
      );
    }

    // Update export status to failed (cancelled)
    const { error: updateError } = await supabase
      .from('model_exports')
      .update({ 
        export_status: 'failed',
        error_message: 'Cancelled by user'
      })
      .eq('id', exportId);

    if (updateError) {
      throw new Error(`Failed to cancel export: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Export cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel model export error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}