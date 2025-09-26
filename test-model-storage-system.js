// Model Storage System Test
// Tests the complete model storage, versioning, sharing, and cleanup functionality

const { createClient } = require('@supabase/supabase-js');

// Test configuration
const TEST_CONFIG = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  testUserId: 'test-user-' + Date.now(),
  testModelId: null,
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
};

// Initialize Supabase client
const supabase = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseKey);

// Test utilities
function log(message, data = null) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function logError(message, error) {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
  console.error(error);
}

async function makeRequest(endpoint, options = {}) {
  const url = `${TEST_CONFIG.baseUrl}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  return { response, data };
}

// Test functions
async function setupTestData() {
  log('Setting up test data...');
  
  try {
    // Create test user (simulate)
    log(`Using test user ID: ${TEST_CONFIG.testUserId}`);
    
    // Create test model
    const { data: model, error: modelError } = await supabase
      .from('models')
      .insert({
        name: 'Test Model for Storage',
        type: 'headshot',
        status: 'completed',
        user_id: TEST_CONFIG.testUserId,
        modelId: 'test-model-' + Date.now()
      })
      .select()
      .single();

    if (modelError) {
      throw new Error(`Failed to create test model: ${modelError.message}`);
    }

    TEST_CONFIG.testModelId = model.id;
    log('Test model created:', { id: model.id, name: model.name });
    
    return true;
  } catch (error) {
    logError('Failed to setup test data', error);
    return false;
  }
}

async function testModelWeightStorage() {
  log('Testing model weight storage...');
  
  try {
    // Test storing model weight
    const weightData = {
      model_id: TEST_CONFIG.testModelId,
      file_path: `models/${TEST_CONFIG.testModelId}/weights_v1.safetensors`,
      file_size: 1024 * 1024 * 50, // 50MB
      file_hash: 'test-hash-' + Date.now(),
      storage_provider: 'supabase',
      metadata: {
        model_type: 'lora',
        framework: 'safetensors',
        architecture: 'flux-dev',
        base_model: 'black-forest-labs/flux-dev',
        trigger_words: ['sks person'],
        training_images_count: 20,
        training_duration_minutes: 15
      },
      training_config: {
        resolution: 1024,
        max_train_steps: 1000,
        lora_rank: 64,
        learning_rate: 0.0001,
        train_batch_size: 1,
        gradient_accumulation_steps: 4,
        mixed_precision: 'fp16',
        use_xformers: true,
        optimizer: 'adamw',
        lr_scheduler: 'cosine',
        warmup_steps: 100,
        save_every_n_epochs: 1,
        validation_split: 0.1
      },
      quality_metrics: {
        clip_similarity_score: 0.85,
        face_recognition_accuracy: 0.92,
        user_rating: 4.5
      }
    };

    const { response, data } = await makeRequest('/api/models/storage', {
      method: 'POST',
      body: JSON.stringify(weightData)
    });

    if (!data.success) {
      throw new Error(`Failed to store model weight: ${data.error}`);
    }

    log('Model weight stored successfully:', {
      id: data.data.id,
      version: data.data.version,
      file_size: data.data.file_size,
      is_active: data.data.is_active
    });

    // Store the weight ID for later tests
    TEST_CONFIG.testWeightId = data.data.id;
    
    return true;
  } catch (error) {
    logError('Model weight storage test failed', error);
    return false;
  }
}

async function testModelVersioning() {
  log('Testing model versioning...');
  
  try {
    // Create second version
    const weightData2 = {
      model_id: TEST_CONFIG.testModelId,
      file_path: `models/${TEST_CONFIG.testModelId}/weights_v2.safetensors`,
      file_size: 1024 * 1024 * 52, // 52MB
      file_hash: 'test-hash-v2-' + Date.now(),
      storage_provider: 'supabase',
      metadata: {
        model_type: 'lora',
        framework: 'safetensors',
        architecture: 'flux-dev',
        base_model: 'black-forest-labs/flux-dev',
        trigger_words: ['sks person'],
        training_images_count: 25,
        training_duration_minutes: 18
      },
      training_config: {
        resolution: 1024,
        max_train_steps: 1200,
        lora_rank: 64,
        learning_rate: 0.00008,
        train_batch_size: 1,
        gradient_accumulation_steps: 4,
        mixed_precision: 'fp16',
        use_xformers: true,
        optimizer: 'adamw',
        lr_scheduler: 'cosine',
        warmup_steps: 120,
        save_every_n_epochs: 1,
        validation_split: 0.1
      },
      quality_metrics: {
        clip_similarity_score: 0.88,
        face_recognition_accuracy: 0.94,
        user_rating: 4.7
      }
    };

    const { response, data } = await makeRequest('/api/models/storage', {
      method: 'POST',
      body: JSON.stringify(weightData2)
    });

    if (!data.success) {
      throw new Error(`Failed to store model weight v2: ${data.error}`);
    }

    log('Model weight v2 stored successfully:', {
      id: data.data.id,
      version: data.data.version,
      is_active: data.data.is_active
    });

    // Get all versions
    const { response: versionsResponse, data: versionsData } = await makeRequest(
      `/api/models/storage?modelId=${TEST_CONFIG.testModelId}`
    );

    if (!versionsData.success) {
      throw new Error(`Failed to get model versions: ${versionsData.error}`);
    }

    log('Model versions retrieved:', {
      totalVersions: versionsData.data.totalVersions,
      activeVersion: versionsData.data.versions.find(v => v.is_active)?.version,
      versions: versionsData.data.versions.map(v => ({
        version: v.version,
        is_active: v.is_active,
        file_size: v.file_size
      }))
    });

    return true;
  } catch (error) {
    logError('Model versioning test failed', error);
    return false;
  }
}

async function testModelSharing() {
  log('Testing model sharing...');
  
  try {
    // Create model share
    const shareData = {
      model_id: TEST_CONFIG.testModelId,
      access_level: 'download',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      max_downloads: 10,
      is_public: false
    };

    const { response, data } = await makeRequest('/api/models/share', {
      method: 'POST',
      body: JSON.stringify(shareData)
    });

    if (!data.success) {
      throw new Error(`Failed to create model share: ${data.error}`);
    }

    log('Model share created successfully:', {
      id: data.data.id,
      share_token: data.data.share_token,
      access_level: data.data.access_level,
      max_downloads: data.data.max_downloads
    });

    // Test getting share by token
    const { response: getResponse, data: getData } = await makeRequest(
      `/api/models/share?token=${data.data.share_token}`
    );

    if (!getData.success) {
      throw new Error(`Failed to get model share: ${getData.error}`);
    }

    log('Model share retrieved successfully:', {
      model_name: getData.data.model.name,
      access_level: getData.data.share.access_level,
      download_count: getData.data.share.download_count
    });

    TEST_CONFIG.testShareToken = data.data.share_token;
    
    return true;
  } catch (error) {
    logError('Model sharing test failed', error);
    return false;
  }
}

async function testModelExport() {
  log('Testing model export...');
  
  try {
    // Create export request
    const exportData = {
      model_id: TEST_CONFIG.testModelId,
      export_format: 'safetensors'
    };

    const { response, data } = await makeRequest('/api/models/export', {
      method: 'POST',
      body: JSON.stringify(exportData)
    });

    if (!data.success) {
      throw new Error(`Failed to create model export: ${data.error}`);
    }

    log('Model export created successfully:', {
      id: data.data.id,
      export_format: data.data.export_format,
      export_status: data.data.export_status
    });

    // Wait a moment and check export status
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { response: statusResponse, data: statusData } = await makeRequest(
      `/api/models/export?exportId=${data.data.id}`
    );

    if (!statusData.success) {
      throw new Error(`Failed to get export status: ${statusData.error}`);
    }

    log('Export status checked:', {
      export_status: statusData.data.export_status,
      has_download_url: !!statusData.data.download_url
    });

    TEST_CONFIG.testExportId = data.data.id;
    
    return true;
  } catch (error) {
    logError('Model export test failed', error);
    return false;
  }
}

async function testStorageStats() {
  log('Testing storage statistics...');
  
  try {
    const { response, data } = await makeRequest(
      `/api/models/storage?userId=${TEST_CONFIG.testUserId}`
    );

    if (!data.success) {
      throw new Error(`Failed to get storage stats: ${data.error}`);
    }

    log('Storage statistics retrieved:', {
      total_models: data.data.total_models,
      total_storage_bytes: data.data.total_storage_bytes,
      active_versions: data.data.active_versions,
      shared_models: data.data.shared_models
    });

    return true;
  } catch (error) {
    logError('Storage statistics test failed', error);
    return false;
  }
}

async function testCleanupOperation() {
  log('Testing cleanup operation...');
  
  try {
    // Test dry run cleanup
    const cleanupData = {
      cleanup_expired: true,
      cleanup_inactive_days: 1, // Very short for testing
      dry_run: true
    };

    const { response, data } = await makeRequest('/api/models/cleanup', {
      method: 'POST',
      body: JSON.stringify(cleanupData)
    });

    if (!data.success) {
      throw new Error(`Failed to run cleanup operation: ${data.error}`);
    }

    log('Cleanup operation completed (dry run):', {
      models_cleaned: data.data.models_cleaned,
      bytes_freed: data.data.bytes_freed,
      files_deleted: data.data.files_deleted.length,
      errors: data.data.errors.length
    });

    return true;
  } catch (error) {
    logError('Cleanup operation test failed', error);
    return false;
  }
}

async function testDatabaseFunctions() {
  log('Testing database functions...');
  
  try {
    // Test cleanup functions directly
    const { data: expiredResult, error: expiredError } = await supabase
      .rpc('cleanup_expired_model_weights');

    if (expiredError) {
      throw new Error(`Failed to call cleanup_expired_model_weights: ${expiredError.message}`);
    }

    log('Expired model weights cleanup result:', expiredResult);

    const { data: sharesResult, error: sharesError } = await supabase
      .rpc('cleanup_expired_model_shares');

    if (sharesError) {
      throw new Error(`Failed to call cleanup_expired_model_shares: ${sharesError.message}`);
    }

    log('Expired model shares cleanup result:', sharesResult);

    const { data: exportsResult, error: exportsError } = await supabase
      .rpc('cleanup_expired_model_exports');

    if (exportsError) {
      throw new Error(`Failed to call cleanup_expired_model_exports: ${exportsError.message}`);
    }

    log('Expired model exports cleanup result:', exportsResult);

    return true;
  } catch (error) {
    logError('Database functions test failed', error);
    return false;
  }
}

async function cleanupTestData() {
  log('Cleaning up test data...');
  
  try {
    // Delete test model (cascade will handle related records)
    if (TEST_CONFIG.testModelId) {
      const { error: modelError } = await supabase
        .from('models')
        .delete()
        .eq('id', TEST_CONFIG.testModelId);

      if (modelError) {
        console.warn('Failed to delete test model:', modelError.message);
      } else {
        log('Test model deleted successfully');
      }
    }

    return true;
  } catch (error) {
    logError('Failed to cleanup test data', error);
    return false;
  }
}

// Main test runner
async function runTests() {
  log('Starting Model Storage System Tests...');
  
  const tests = [
    { name: 'Setup Test Data', fn: setupTestData },
    { name: 'Model Weight Storage', fn: testModelWeightStorage },
    { name: 'Model Versioning', fn: testModelVersioning },
    { name: 'Model Sharing', fn: testModelSharing },
    { name: 'Model Export', fn: testModelExport },
    { name: 'Storage Statistics', fn: testStorageStats },
    { name: 'Cleanup Operation', fn: testCleanupOperation },
    { name: 'Database Functions', fn: testDatabaseFunctions }
  ];

  const results = [];
  
  for (const test of tests) {
    log(`\n--- Running ${test.name} ---`);
    try {
      const success = await test.fn();
      results.push({ name: test.name, success, error: null });
      log(`✅ ${test.name} ${success ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
      results.push({ name: test.name, success: false, error: error.message });
      log(`❌ ${test.name} FAILED: ${error.message}`);
    }
  }

  // Cleanup
  log('\n--- Cleaning Up ---');
  await cleanupTestData();

  // Summary
  log('\n--- Test Results Summary ---');
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  log(`Total Tests: ${results.length}`);
  log(`Passed: ${passed}`);
  log(`Failed: ${failed}`);
  
  if (failed > 0) {
    log('\nFailed Tests:');
    results.filter(r => !r.success).forEach(r => {
      log(`- ${r.name}: ${r.error}`);
    });
  }

  log(`\nModel Storage System Tests ${failed === 0 ? 'COMPLETED SUCCESSFULLY' : 'COMPLETED WITH FAILURES'}`);
  
  process.exit(failed === 0 ? 0 : 1);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    logError('Test runner failed', error);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  TEST_CONFIG
};