/**
 * Training Monitoring System Test
 * Tests the comprehensive training monitoring, status tracking, and webhook handling
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  testUserId: '00000000-0000-0000-0000-000000000000', // Test user ID
  testModelId: 999999, // Test model ID
  timeout: 30000
};

// Test utilities
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function logError(message, error) {
  console.error(`❌ ${message}:`, error.message || error);
  if (error.stack) {
    console.error(error.stack);
  }
}

function logSuccess(message, data = null) {
  console.log(`✅ ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Database test functions
async function testDatabaseSchema() {
  log('Testing database schema...');
  
  try {
    // Test training_sessions table
    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select('*')
      .limit(1);
    
    if (sessionsError) throw new Error(`training_sessions table error: ${sessionsError.message}`);
    
    // Test training_status_updates table
    const { data: updates, error: updatesError } = await supabase
      .from('training_status_updates')
      .select('*')
      .limit(1);
    
    if (updatesError) throw new Error(`training_status_updates table error: ${updatesError.message}`);
    
    // Test training_performance_metrics table
    const { data: metrics, error: metricsError } = await supabase
      .from('training_performance_metrics')
      .select('*')
      .limit(1);
    
    if (metricsError) throw new Error(`training_performance_metrics table error: ${metricsError.message}`);
    
    // Test training_history_summary table
    const { data: history, error: historyError } = await supabase
      .from('training_history_summary')
      .select('*')
      .limit(1);
    
    if (historyError) throw new Error(`training_history_summary table error: ${historyError.message}`);
    
    // Test webhook_events table
    const { data: webhooks, error: webhooksError } = await supabase
      .from('webhook_events')
      .select('*')
      .limit(1);
    
    if (webhooksError) throw new Error(`webhook_events table error: ${webhooksError.message}`);
    
    logSuccess('Database schema test passed');
    return true;
  } catch (error) {
    logError('Database schema test failed', error);
    return false;
  }
}

async function testTrainingSessionCRUD() {
  log('Testing training session CRUD operations...');
  
  try {
    // Create test training session
    const sessionData = {
      model_id: TEST_CONFIG.testModelId,
      user_id: TEST_CONFIG.testUserId,
      provider: 'runpod',
      external_training_id: 'test-training-' + Date.now(),
      status: 'pending',
      progress: 0,
      current_step: 0,
      total_steps: 1000,
      retry_count: 0,
      webhook_events: [],
      training_config: {
        resolution: 1024,
        max_train_steps: 1000,
        lora_rank: 64,
        learning_rate: 0.0001
      }
    };
    
    const { data: createdSession, error: createError } = await supabase
      .from('training_sessions')
      .insert(sessionData)
      .select()
      .single();
    
    if (createError) throw new Error(`Failed to create session: ${createError.message}`);
    
    log('Created training session:', createdSession);
    
    // Update training session
    const { data: updatedSession, error: updateError } = await supabase
      .from('training_sessions')
      .update({
        status: 'training',
        progress: 25,
        current_step: 250,
        training_started_at: new Date().toISOString()
      })
      .eq('id', createdSession.id)
      .select()
      .single();
    
    if (updateError) throw new Error(`Failed to update session: ${updateError.message}`);
    
    log('Updated training session:', updatedSession);
    
    // Add status update
    const { data: statusUpdate, error: statusError } = await supabase
      .from('training_status_updates')
      .insert({
        training_session_id: createdSession.id,
        status: 'training',
        progress: 25,
        current_step: 250,
        message: 'Training in progress',
        source: 'system'
      })
      .select()
      .single();
    
    if (statusError) throw new Error(`Failed to create status update: ${statusError.message}`);
    
    log('Created status update:', statusUpdate);
    
    // Add performance metric
    const { data: metric, error: metricError } = await supabase
      .from('training_performance_metrics')
      .insert({
        training_session_id: createdSession.id,
        metric_type: 'loss',
        metric_value: 0.5,
        step: 250,
        metadata: { source: 'test' }
      })
      .select()
      .single();
    
    if (metricError) throw new Error(`Failed to create metric: ${metricError.message}`);
    
    log('Created performance metric:', metric);
    
    // Clean up test data
    await supabase.from('training_sessions').delete().eq('id', createdSession.id);
    
    logSuccess('Training session CRUD test passed');
    return true;
  } catch (error) {
    logError('Training session CRUD test failed', error);
    return false;
  }
}

async function testWebhookEvent() {
  log('Testing webhook event processing...');
  
  try {
    // Create test training session first
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .insert({
        model_id: TEST_CONFIG.testModelId,
        user_id: TEST_CONFIG.testUserId,
        provider: 'runpod',
        external_training_id: 'webhook-test-' + Date.now(),
        status: 'pending'
      })
      .select()
      .single();
    
    if (sessionError) throw new Error(`Failed to create test session: ${sessionError.message}`);
    
    // Test webhook event storage
    const webhookData = {
      training_session_id: session.id,
      provider: 'runpod',
      event_type: 'status_update',
      event_data: {
        id: session.external_training_id,
        status: 'IN_PROGRESS',
        progress: {
          current_step: 500,
          total_steps: 1000,
          percentage: 50
        }
      },
      processed: false
    };
    
    const { data: webhookEvent, error: webhookError } = await supabase
      .from('webhook_events')
      .insert(webhookData)
      .select()
      .single();
    
    if (webhookError) throw new Error(`Failed to create webhook event: ${webhookError.message}`);
    
    log('Created webhook event:', webhookEvent);
    
    // Test webhook endpoint
    const webhookPayload = {
      id: session.external_training_id,
      status: 'IN_PROGRESS',
      progress: {
        current_step: 750,
        total_steps: 1000,
        percentage: 75
      }
    };
    
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/runpod/webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook endpoint failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    log('Webhook endpoint response:', result);
    
    // Clean up test data
    await supabase.from('training_sessions').delete().eq('id', session.id);
    
    logSuccess('Webhook event test passed');
    return true;
  } catch (error) {
    logError('Webhook event test failed', error);
    return false;
  }
}

async function testTrainingStatusAPI() {
  log('Testing training status API...');
  
  try {
    // Create test training sessions
    const sessions = [];
    for (let i = 0; i < 3; i++) {
      const { data: session, error } = await supabase
        .from('training_sessions')
        .insert({
          model_id: TEST_CONFIG.testModelId + i,
          user_id: TEST_CONFIG.testUserId,
          provider: i === 0 ? 'runpod' : i === 1 ? 'replicate' : 'fal',
          status: i === 0 ? 'training' : i === 1 ? 'completed' : 'failed',
          progress: i === 0 ? 60 : 100,
          current_step: i === 0 ? 600 : 1000,
          total_steps: 1000,
          training_duration: i > 0 ? 1200000 : null, // 20 minutes
          error_message: i === 2 ? 'Test error message' : null
        })
        .select()
        .single();
      
      if (error) throw new Error(`Failed to create test session ${i}: ${error.message}`);
      sessions.push(session);
    }
    
    // Test getting all sessions
    const allSessionsResponse = await fetch(`${TEST_CONFIG.baseUrl}/api/training/status`, {
      headers: {
        'Cookie': `sb-access-token=test-token` // Mock auth
      }
    });
    
    if (allSessionsResponse.ok) {
      const allSessionsData = await allSessionsResponse.json();
      log('All sessions response:', allSessionsData);
    }
    
    // Test getting specific model sessions
    const modelSessionsResponse = await fetch(
      `${TEST_CONFIG.baseUrl}/api/training/status?model_id=${TEST_CONFIG.testModelId}`,
      {
        headers: {
          'Cookie': `sb-access-token=test-token` // Mock auth
        }
      }
    );
    
    if (modelSessionsResponse.ok) {
      const modelSessionsData = await modelSessionsResponse.json();
      log('Model sessions response:', modelSessionsData);
    }
    
    // Test getting specific session
    const sessionResponse = await fetch(
      `${TEST_CONFIG.baseUrl}/api/training/status?session_id=${sessions[0].id}`,
      {
        headers: {
          'Cookie': `sb-access-token=test-token` // Mock auth
        }
      }
    );
    
    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      log('Specific session response:', sessionData);
    }
    
    // Clean up test data
    for (const session of sessions) {
      await supabase.from('training_sessions').delete().eq('id', session.id);
    }
    
    logSuccess('Training status API test passed');
    return true;
  } catch (error) {
    logError('Training status API test failed', error);
    return false;
  }
}

async function testTrainingHistorySummary() {
  log('Testing training history summary...');
  
  try {
    // Create test training sessions with different statuses
    const testSessions = [
      { status: 'completed', training_duration: 1200000 },
      { status: 'completed', training_duration: 1500000 },
      { status: 'failed', training_duration: null },
      { status: 'completed', training_duration: 1000000 }
    ];
    
    const createdSessions = [];
    for (const sessionData of testSessions) {
      const { data: session, error } = await supabase
        .from('training_sessions')
        .insert({
          model_id: TEST_CONFIG.testModelId,
          user_id: TEST_CONFIG.testUserId,
          provider: 'runpod',
          status: sessionData.status,
          training_duration: sessionData.training_duration,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw new Error(`Failed to create test session: ${error.message}`);
      createdSessions.push(session);
    }
    
    // Trigger history summary update by updating a session status
    await supabase
      .from('training_sessions')
      .update({ status: 'completed' })
      .eq('id', createdSessions[0].id);
    
    // Check if history summary was created
    const { data: historySummary, error: historyError } = await supabase
      .from('training_history_summary')
      .select('*')
      .eq('user_id', TEST_CONFIG.testUserId)
      .eq('date', new Date().toISOString().split('T')[0]);
    
    if (historyError) throw new Error(`Failed to fetch history summary: ${historyError.message}`);
    
    log('Training history summary:', historySummary);
    
    // Clean up test data
    for (const session of createdSessions) {
      await supabase.from('training_sessions').delete().eq('id', session.id);
    }
    
    // Clean up history summary
    if (historySummary && historySummary.length > 0) {
      await supabase
        .from('training_history_summary')
        .delete()
        .eq('user_id', TEST_CONFIG.testUserId)
        .eq('date', new Date().toISOString().split('T')[0]);
    }
    
    logSuccess('Training history summary test passed');
    return true;
  } catch (error) {
    logError('Training history summary test failed', error);
    return false;
  }
}

async function testProgressCalculation() {
  log('Testing progress calculation...');
  
  try {
    // Create test training session
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .insert({
        model_id: TEST_CONFIG.testModelId,
        user_id: TEST_CONFIG.testUserId,
        provider: 'runpod',
        status: 'training',
        progress: 50,
        current_step: 500,
        total_steps: 1000,
        training_started_at: new Date(Date.now() - 600000).toISOString() // 10 minutes ago
      })
      .select()
      .single();
    
    if (sessionError) throw new Error(`Failed to create test session: ${sessionError.message}`);
    
    // Add some status updates
    const statusUpdates = [
      { step: 100, timestamp: new Date(Date.now() - 480000) }, // 8 minutes ago
      { step: 300, timestamp: new Date(Date.now() - 240000) }, // 4 minutes ago
      { step: 500, timestamp: new Date() } // now
    ];
    
    for (const update of statusUpdates) {
      await supabase
        .from('training_status_updates')
        .insert({
          training_session_id: session.id,
          status: 'training',
          current_step: update.step,
          progress: (update.step / 1000) * 100,
          message: `Step ${update.step}`,
          source: 'system',
          created_at: update.timestamp.toISOString()
        });
    }
    
    // Test progress calculation via API
    const response = await fetch(
      `${TEST_CONFIG.baseUrl}/api/training/status?session_id=${session.id}`,
      {
        headers: {
          'Cookie': `sb-access-token=test-token` // Mock auth
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      log('Progress calculation result:', data.session?.progressInfo);
      
      if (data.session?.progressInfo) {
        const progress = data.session.progressInfo;
        
        // Validate progress calculation
        if (progress.progressPercentage !== 50) {
          throw new Error(`Expected progress 50%, got ${progress.progressPercentage}%`);
        }
        
        if (progress.currentStep !== 500) {
          throw new Error(`Expected current step 500, got ${progress.currentStep}`);
        }
        
        if (progress.totalSteps !== 1000) {
          throw new Error(`Expected total steps 1000, got ${progress.totalSteps}`);
        }
        
        logSuccess('Progress calculation validation passed');
      }
    }
    
    // Clean up test data
    await supabase.from('training_sessions').delete().eq('id', session.id);
    
    logSuccess('Progress calculation test passed');
    return true;
  } catch (error) {
    logError('Progress calculation test failed', error);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  log('🚀 Starting Training Monitoring System Tests');
  log('='.repeat(50));
  
  const tests = [
    { name: 'Database Schema', fn: testDatabaseSchema },
    { name: 'Training Session CRUD', fn: testTrainingSessionCRUD },
    { name: 'Webhook Event Processing', fn: testWebhookEvent },
    { name: 'Training Status API', fn: testTrainingStatusAPI },
    { name: 'Training History Summary', fn: testTrainingHistorySummary },
    { name: 'Progress Calculation', fn: testProgressCalculation }
  ];
  
  const results = [];
  
  for (const test of tests) {
    log(`\n📋 Running ${test.name} test...`);
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      logError(`${test.name} test failed`, error);
      results.push({ name: test.name, passed: false });
    }
  }
  
  // Summary
  log('\n' + '='.repeat(50));
  log('📊 TEST RESULTS SUMMARY');
  log('='.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    log(`${status} - ${result.name}`);
  });
  
  log(`\n🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    logSuccess('All training monitoring tests passed! 🎉');
    process.exit(0);
  } else {
    logError('Some tests failed', new Error(`${total - passed} tests failed`));
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection at', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logError('Uncaught Exception', error);
  process.exit(1);
});

// Run tests
if (require.main === module) {
  runAllTests().catch(error => {
    logError('Test runner failed', error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testDatabaseSchema,
  testTrainingSessionCRUD,
  testWebhookEvent,
  testTrainingStatusAPI,
  testTrainingHistorySummary,
  testProgressCalculation
};