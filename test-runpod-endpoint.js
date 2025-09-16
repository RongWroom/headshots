#!/usr/bin/env node

/**
 * Test script to verify RunPod training endpoint is working
 */

require('dotenv').config({ path: '.env.local' });

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_TRAINING_ENDPOINT = process.env.RUNPOD_TRAINING_ENDPOINT;

async function testEndpoint() {
  console.log('🧪 Testing RunPod training endpoint...\n');
  
  if (!RUNPOD_API_KEY) {
    console.error('❌ RUNPOD_API_KEY not found in .env.local');
    process.exit(1);
  }
  
  if (!RUNPOD_TRAINING_ENDPOINT) {
    console.error('❌ RUNPOD_TRAINING_ENDPOINT not found in .env.local');
    process.exit(1);
  }
  
  console.log('✅ Environment variables found');
  console.log(`📡 Endpoint: ${RUNPOD_TRAINING_ENDPOINT}`);
  console.log(`🔑 API Key: ${RUNPOD_API_KEY.substring(0, 8)}...`);
  
  // Test with sample image URLs (these are just test URLs)
  const testPayload = {
    input: {
      image_urls: [
        'https://picsum.photos/1024/1024?random=1',
        'https://picsum.photos/1024/1024?random=2',
        'https://picsum.photos/1024/1024?random=3',
        'https://picsum.photos/1024/1024?random=4',
        'https://picsum.photos/1024/1024?random=5',
        'https://picsum.photos/1024/1024?random=6',
        'https://picsum.photos/1024/1024?random=7',
        'https://picsum.photos/1024/1024?random=8'
      ],
      trigger_word: 'skstest',
      model_name: 'test_model',
      style_prompt: 'professional headshot'
    }
  };
  
  console.log('\n📤 Sending test request...');
  console.log(`📊 Test data: ${testPayload.input.image_urls.length} images, trigger: ${testPayload.input.trigger_word}`);
  
  try {
    const response = await fetch(RUNPOD_TRAINING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log(`\n📡 Response status: ${response.status} ${response.statusText}`);
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ RunPod endpoint is working!');
      console.log('\n📋 Response:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.id) {
        console.log(`\n🎯 Training job started with ID: ${result.id}`);
        console.log('⏱️  This would normally take 20-30 minutes to complete');
        console.log('💡 You can check status in RunPod console');
      }
    } else {
      console.log('❌ RunPod endpoint returned an error:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.error && result.error.includes('face')) {
        console.log('\n💡 This is expected - the test images are random and may not contain faces');
        console.log('✅ The endpoint is working, it just needs real face photos');
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to connect to RunPod endpoint:');
    console.error(error.message);
    
    console.log('\n🔍 Troubleshooting:');
    console.log('1. Check that your RunPod endpoint is deployed and active');
    console.log('2. Verify the endpoint URL is correct');
    console.log('3. Make sure the API key is valid');
    console.log('4. Check RunPod console for any deployment issues');
  }
}

testEndpoint().catch(console.error);