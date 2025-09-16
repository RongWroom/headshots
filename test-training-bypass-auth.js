#!/usr/bin/env node

/**
 * Test training by temporarily bypassing auth (for development only)
 */

require('dotenv').config({ path: '.env.local' });

async function testDirectRunPod() {
  console.log('🧪 Testing RunPod directly (bypassing website auth)...\n');
  
  const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
  const RUNPOD_TRAINING_ENDPOINT = process.env.RUNPOD_TRAINING_ENDPOINT;
  
  // High-quality face images for testing
  const testPayload = {
    input: {
      image_urls: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1024&h=1024&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1024&h=1024&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=1024&h=1024&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=1024&h=1024&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1024&h=1024&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1557862921-37829c790f19?w=1024&h=1024&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=1024&h=1024&fit=crop&crop=face',
        'https://images.unsplash.com/photo-1545167622-3a6ac756afa4?w=1024&h=1024&fit=crop&crop=face'
      ],
      trigger_word: 'skstest',
      model_name: 'test_headshots',
      style_prompt: 'professional corporate headshot, clean background, business attire, professional lighting'
    }
  };
  
  console.log('📋 Sending training request directly to RunPod...');
  console.log(`📊 Images: ${testPayload.input.image_urls.length}`);
  console.log(`🎯 Trigger: ${testPayload.input.trigger_word}`);
  console.log(`🎨 Style: ${testPayload.input.style_prompt}`);
  
  try {
    const response = await fetch(RUNPOD_TRAINING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log(`\n📡 Response: ${response.status} ${response.statusText}`);
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('🎉 SUCCESS! Training started!');
      console.log('\n📋 Response:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.id) {
        console.log(`\n🚀 Training Job ID: ${result.id}`);
        console.log('⏱️  Expected time: 20-30 minutes');
        console.log('📊 Check RunPod console for live progress');
        console.log('🎯 This proves your RunPod setup is working!');
      }
    } else {
      console.log('❌ Training failed:');
      console.log(JSON.stringify(result, null, 2));
      
      if (response.status === 403) {
        console.log('\n🔧 API Key Issue:');
        console.log('1. Go to RunPod Settings → API Keys');
        console.log('2. Create new key with Serverless permissions');
        console.log('3. Update RUNPOD_API_KEY in .env.local');
      }
    }
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testDirectRunPod().catch(console.error);