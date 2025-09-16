#!/usr/bin/env node

/**
 * Test your website's training API with RunPod
 */

require('dotenv').config({ path: '.env.local' });

async function testWebsiteTraining() {
  console.log('🌐 Testing website training API with RunPod...\n');
  
  // Test data - using high-quality sample images
  const testData = {
    imageUrls: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1024&h=1024&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1024&h=1024&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=1024&h=1024&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=1024&h=1024&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1024&h=1024&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1557862921-37829c790f19?w=1024&h=1024&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=1024&h=1024&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1545167622-3a6ac756afa4?w=1024&h=1024&fit=crop&crop=face'
    ],
    modelName: 'test-headshots',
    packSlug: 'corporate-headshots',
    trainingConfig: {
      trigger_word: 'skstest'
    }
  };
  
  console.log('📋 Test data prepared:');
  console.log(`  - Images: ${testData.imageUrls.length}`);
  console.log(`  - Model: ${testData.modelName}`);
  console.log(`  - Pack: ${testData.packSlug}`);
  
  try {
    console.log('\n📤 Sending request to your website API...');
    
    // Test your website's training endpoint
    const response = await fetch('http://localhost:3000/api/runpod/train', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // You'll need to add auth headers if required
      },
      body: JSON.stringify(testData)
    });
    
    console.log(`📡 Response: ${response.status} ${response.statusText}`);
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Training request successful!');
      console.log('\n📋 Response details:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.trainingId) {
        console.log(`\n🎯 Training started with ID: ${result.trainingId}`);
        console.log('⏱️  Expected completion: 20-30 minutes');
        console.log('📊 Check RunPod console for progress');
      }
    } else {
      console.log('❌ Training request failed:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.error && result.error.includes('Authentication')) {
        console.log('\n💡 You may need to sign in first or add auth headers');
      }
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure your Next.js dev server is running:');
      console.log('   npm run dev');
    }
  }
}

testWebsiteTraining().catch(console.error);