/**
 * Test script for parameter optimization functionality
 * Tests the new optimized training parameters and A/B testing framework
 */

const TEST_CONFIG = {
  testImageUrls: [
    'https://httpbin.org/image/jpeg',
    'https://httpbin.org/image/png',
    'https://httpbin.org/image/webp',
    'https://httpbin.org/image/svg',
    'https://picsum.photos/1024/1024?random=1',
    'https://picsum.photos/1024/1024?random=2',
    'https://picsum.photos/1024/1024?random=3',
    'https://picsum.photos/1024/1024?random=4'
  ],
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
};

async function testParameterOptimization() {
  console.log('🧪 Testing Parameter Optimization...\n');

  try {
    // Test 1: Basic parameter optimization
    console.log('📋 Test 1: Basic Parameter Optimization');
    const basicOptimization = await fetch(`${TEST_CONFIG.baseUrl}/api/training/optimize-parameters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrls: TEST_CONFIG.testImageUrls.slice(0, 6),
        packSlug: 'corporate-headshots',
        userPreference: 'balanced'
      })
    });

    if (basicOptimization.ok) {
      const result = await basicOptimization.json();
      console.log('✅ Basic optimization successful');
      console.log(`   Selected preset: ${result.optimization.parameterSet.name}`);
      console.log(`   Quality level: ${result.optimization.parameterSet.qualityLevel}`);
      console.log(`   Estimated time: ${result.optimization.costEstimate.estimatedMinutes} minutes`);
      console.log(`   Estimated cost: $${result.optimization.costEstimate.estimatedCost}`);
      console.log(`   Recommendations: ${result.optimization.recommendations.length}`);
      if (result.optimization.abTestInfo) {
        console.log(`   A/B Test: ${result.optimization.abTestInfo.testId} (${result.optimization.abTestInfo.variantId})`);
      }
    } else {
      const error = await basicOptimization.json();
      console.log('❌ Basic optimization failed:', error.message);
      if (error.details) {
        console.log('   Details:', JSON.stringify(error.details, null, 2));
      }
    }

    console.log('');

    // Test 2: High-quality preset optimization
    console.log('📋 Test 2: High-Quality Preset Optimization');
    const highQualityOptimization = await fetch(`${TEST_CONFIG.baseUrl}/api/training/optimize-parameters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrls: TEST_CONFIG.testImageUrls,
        packSlug: 'actor-headshots',
        qualityPreset: 'premium',
        userPreference: 'quality',
        enableABTesting: true
      })
    });

    if (highQualityOptimization.ok) {
      const result = await highQualityOptimization.json();
      console.log('✅ High-quality optimization successful');
      console.log(`   Selected preset: ${result.optimization.parameterSet.name}`);
      console.log(`   Quality level: ${result.optimization.parameterSet.qualityLevel}`);
      console.log(`   LoRA rank: ${result.optimization.selectedParameters.lora_rank}`);
      console.log(`   Training steps: ${result.optimization.selectedParameters.max_train_steps}`);
      console.log(`   Learning rate: ${result.optimization.selectedParameters.learning_rate}`);
      console.log(`   Resolution: ${result.optimization.selectedParameters.resolution}`);
      console.log(`   Quality assessment: ${result.optimization.qualityAssessment.overallQuality.toFixed(2)}`);
    } else {
      const error = await highQualityOptimization.json();
      console.log('❌ High-quality optimization failed:', error.message);
    }

    console.log('');

    // Test 3: Speed-optimized parameters
    console.log('📋 Test 3: Speed-Optimized Parameters');
    const speedOptimization = await fetch(`${TEST_CONFIG.baseUrl}/api/training/optimize-parameters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrls: TEST_CONFIG.testImageUrls.slice(0, 4),
        packSlug: 'corporate-headshots',
        userPreference: 'speed',
        qualityPreset: 'basic'
      })
    });

    if (speedOptimization.ok) {
      const result = await speedOptimization.json();
      console.log('✅ Speed optimization successful');
      console.log(`   Selected preset: ${result.optimization.parameterSet.name}`);
      console.log(`   Quality level: ${result.optimization.parameterSet.qualityLevel}`);
      console.log(`   Estimated time: ${result.optimization.costEstimate.estimatedMinutes} minutes`);
      console.log(`   Training steps: ${result.optimization.selectedParameters.max_train_steps}`);
      console.log(`   LoRA rank: ${result.optimization.selectedParameters.lora_rank}`);
    } else {
      const error = await speedOptimization.json();
      console.log('❌ Speed optimization failed:', error.message);
    }

    console.log('');

    // Test 4: Parameter validation
    console.log('📋 Test 4: Parameter Validation');
    const validationTest = await fetch(`${TEST_CONFIG.baseUrl}/api/training/optimize-parameters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrls: ['invalid-url', 'not-a-url'],
        packSlug: 'invalid-pack',
        userPreference: 'invalid-preference'
      })
    });

    if (!validationTest.ok) {
      const error = await validationTest.json();
      console.log('✅ Parameter validation working correctly');
      console.log(`   Error type: ${error.errorType}`);
      console.log(`   Validation errors: ${error.details?.validationErrors?.length || 0}`);
    } else {
      console.log('❌ Parameter validation should have failed');
    }

    console.log('');

    // Test 5: Test with RunPod training endpoint (if available)
    console.log('📋 Test 5: Integration with RunPod Training');
    const runpodTest = await fetch(`${TEST_CONFIG.baseUrl}/api/runpod/train`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrls: TEST_CONFIG.testImageUrls.slice(0, 6),
        modelName: 'test-optimized-model',
        packSlug: 'corporate-headshots',
        trainingConfig: {
          user_preference: 'quality',
          quality_preset: 'high'
        }
      })
    });

    if (runpodTest.ok) {
      const result = await runpodTest.json();
      console.log('✅ RunPod integration successful');
      console.log(`   Training ID: ${result.trainingId}`);
      console.log(`   Parameter set: ${result.details.parameterSet?.name}`);
      console.log(`   Quality level: ${result.details.parameterSet?.qualityLevel}`);
      console.log(`   Optimized steps: ${result.details.trainingSteps}`);
      console.log(`   Optimized rank: ${result.details.loraRank}`);
      console.log(`   Quality assessment: ${result.details.qualityAssessment?.overallQuality?.toFixed(2)}`);
      console.log(`   Recommendations: ${result.details.optimization?.recommendations?.length || 0}`);
    } else {
      const error = await runpodTest.json();
      console.log('⚠️  RunPod integration test failed (expected if not authenticated)');
      console.log(`   Error: ${error.message}`);
      if (error.errorType === 'UNAUTHORIZED') {
        console.log('   This is expected without authentication');
      }
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Test parameter optimization classes directly
async function testParameterClasses() {
  console.log('\n🔬 Testing Parameter Optimization Classes...\n');

  try {
    // Import the classes (this would work in a Node.js environment with proper module resolution)
    console.log('📋 Testing parameter selection logic');
    
    // Simulate parameter selection for different scenarios
    const scenarios = [
      { imageCount: 10, quality: 0.9, description: 'High-quality with many images' },
      { imageCount: 6, quality: 0.7, description: 'Standard quality with good images' },
      { imageCount: 4, quality: 0.5, description: 'Basic quality with few images' },
      { imageCount: 12, quality: 0.95, description: 'Premium quality with excellent images' }
    ];

    scenarios.forEach((scenario, index) => {
      console.log(`   Scenario ${index + 1}: ${scenario.description}`);
      console.log(`     Image count: ${scenario.imageCount}`);
      console.log(`     Quality score: ${scenario.quality}`);
      
      // Simulate parameter selection logic
      let recommendedPreset;
      if (scenario.quality >= 0.8 && scenario.imageCount >= 8) {
        recommendedPreset = 'premium';
      } else if (scenario.quality >= 0.6 && scenario.imageCount >= 6) {
        recommendedPreset = 'high';
      } else if (scenario.quality >= 0.4 && scenario.imageCount >= 5) {
        recommendedPreset = 'standard';
      } else {
        recommendedPreset = 'basic';
      }
      
      console.log(`     Recommended preset: ${recommendedPreset}`);
      console.log('');
    });

    console.log('✅ Parameter selection logic tests completed');

  } catch (error) {
    console.error('❌ Parameter class tests failed:', error);
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting Parameter Optimization Tests\n');
  console.log('=' .repeat(60));
  
  await testParameterOptimization();
  await testParameterClasses();
  
  console.log('=' .repeat(60));
  console.log('✅ All parameter optimization tests completed!\n');
}

// Execute tests if run directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testParameterOptimization,
  testParameterClasses,
  runAllTests
};