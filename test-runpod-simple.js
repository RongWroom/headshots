#!/usr/bin/env node

/**
 * Simple RunPod endpoint health check
 */

require('dotenv').config({ path: '.env.local' });

async function simpleTest() {
  console.log('🏥 Simple RunPod health check...\n');
  
  const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
  const RUNPOD_TRAINING_ENDPOINT = process.env.RUNPOD_TRAINING_ENDPOINT;
  
  console.log(`📡 Endpoint: ${RUNPOD_TRAINING_ENDPOINT}`);
  console.log(`🔑 API Key: ${RUNPOD_API_KEY ? RUNPOD_API_KEY.substring(0, 8) + '...' : 'NOT FOUND'}`);
  
  // Try a minimal request
  const minimalPayload = {
    input: {
      test: true
    }
  };
  
  try {
    console.log('\n📤 Sending minimal test request...');
    
    const response = await fetch(RUNPOD_TRAINING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(minimalPayload)
    });
    
    console.log(`📡 Status: ${response.status} ${response.statusText}`);
    
    const result = await response.json();
    console.log('📋 Response:', JSON.stringify(result, null, 2));
    
    if (response.status === 403) {
      console.log('\n🔍 403 Forbidden troubleshooting:');
      console.log('1. Check RunPod console - is your endpoint active?');
      console.log('2. Verify API key has Serverless permissions');
      console.log('3. Make sure endpoint is fully deployed (not just created)');
      console.log('4. Try creating a new API key with full permissions');
    } else if (response.status === 200) {
      console.log('\n✅ Endpoint is responding! Ready for real training.');
    } else {
      console.log(`\n⚠️  Unexpected status: ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

simpleTest().catch(console.error);