/**
 * Unit tests for parameter optimization without authentication
 * Tests the core parameter selection and validation logic
 */

// Mock the parameter optimization classes for testing
const PARAMETER_SETS = {
  premium_quality: {
    name: 'Premium Quality',
    description: 'Maximum quality training for professional headshots',
    params: {
      resolution: 1024,
      learning_rate: 8e-5,
      max_train_steps: 2000,
      lora_rank: 128,
      lora_alpha: 128,
      train_batch_size: 1,
      gradient_accumulation_steps: 8,
      mixed_precision: 'bf16',
      use_8bit_adam: true,
      enable_xformers: true,
      save_steps: 500,
      warmup_steps: 200,
      scheduler_type: 'cosine',
      weight_decay: 0.01,
      max_grad_norm: 1.0
    },
    recommendedFor: ['8-15 high-quality images', 'Professional headshots'],
    estimatedTime: '25-35 minutes',
    qualityLevel: 'premium'
  },
  high_quality: {
    name: 'High Quality',
    description: 'Balanced training for good quality source images',
    params: {
      resolution: 1024,
      learning_rate: 1e-4,
      max_train_steps: 1500,
      lora_rank: 64,
      lora_alpha: 64,
      train_batch_size: 1,
      gradient_accumulation_steps: 4,
      mixed_precision: 'bf16',
      use_8bit_adam: true,
      enable_xformers: true,
      save_steps: 500,
      warmup_steps: 150,
      scheduler_type: 'cosine',
      weight_decay: 0.01,
      max_grad_norm: 1.0
    },
    recommendedFor: ['6-12 good quality images', 'Corporate headshots'],
    estimatedTime: '20-25 minutes',
    qualityLevel: 'high'
  },
  standard_quality: {
    name: 'Standard Quality',
    description: 'Reliable training for average quality source images',
    params: {
      resolution: 768,
      learning_rate: 1.2e-4,
      max_train_steps: 1200,
      lora_rank: 32,
      lora_alpha: 32,
      train_batch_size: 1,
      gradient_accumulation_steps: 2,
      mixed_precision: 'fp16',
      use_8bit_adam: true,
      enable_xformers: true,
      save_steps: 400,
      warmup_steps: 100,
      scheduler_type: 'cosine',
      weight_decay: 0.005,
      max_grad_norm: 1.0
    },
    recommendedFor: ['5-10 average quality images', 'Quick training'],
    estimatedTime: '15-20 minutes',
    qualityLevel: 'standard'
  },
  basic_quality: {
    name: 'Basic Quality',
    description: 'Fast training for testing or lower quality source images',
    params: {
      resolution: 512,
      learning_rate: 1.5e-4,
      max_train_steps: 800,
      lora_rank: 16,
      lora_alpha: 16,
      train_batch_size: 1,
      gradient_accumulation_steps: 1,
      mixed_precision: 'fp16',
      use_8bit_adam: false,
      enable_xformers: true,
      save_steps: 200,
      warmup_steps: 50,
      scheduler_type: 'linear',
      weight_decay: 0.001,
      max_grad_norm: 0.5
    },
    recommendedFor: ['4-8 basic quality images', 'Testing'],
    estimatedTime: '10-15 minutes',
    qualityLevel: 'basic'
  }
};

function selectOptimalParameters(imageCount, qualityMetrics, userPreference) {
  // Calculate quality score
  const baseScore = Math.min(imageCount / 10, 1.0);
  const resolutionScore = qualityMetrics?.averageResolution ? 
    Math.min(qualityMetrics.averageResolution / 1024, 1.0) : 0.7;
  const faceScore = qualityMetrics?.faceDetectionScore || 0.8;
  const varietyScore = qualityMetrics?.imageVariety || 0.7;
  const lightingScore = qualityMetrics?.lightingQuality || 0.7;
  
  const overallQuality = (baseScore + resolutionScore + faceScore + varietyScore + lightingScore) / 5;

  // Apply user preference modifier
  let qualityThreshold = overallQuality;
  if (userPreference === 'speed') {
    qualityThreshold -= 0.2;
  } else if (userPreference === 'quality') {
    qualityThreshold += 0.1;
  }

  // Select parameter set based on quality and image count
  if (qualityThreshold >= 0.8 && imageCount >= 8) {
    return PARAMETER_SETS.premium_quality;
  } else if (qualityThreshold >= 0.6 && imageCount >= 6) {
    return PARAMETER_SETS.high_quality;
  } else if (qualityThreshold >= 0.4 && imageCount >= 5) {
    return PARAMETER_SETS.standard_quality;
  } else {
    return PARAMETER_SETS.basic_quality;
  }
}

function validateTrainingParameters(params) {
  const errors = [];
  const warnings = [];

  // Resolution validation
  if (params.resolution && ![512, 768, 1024].includes(params.resolution)) {
    errors.push('Resolution must be 512, 768, or 1024');
  }

  // Learning rate validation
  if (params.learning_rate) {
    if (params.learning_rate < 1e-6 || params.learning_rate > 1e-3) {
      errors.push('Learning rate must be between 1e-6 and 1e-3');
    }
    if (params.learning_rate > 2e-4) {
      warnings.push('High learning rate may cause training instability');
    }
  }

  // Training steps validation
  if (params.max_train_steps) {
    if (params.max_train_steps < 100 || params.max_train_steps > 5000) {
      errors.push('Training steps must be between 100 and 5000');
    }
    if (params.max_train_steps > 3000) {
      warnings.push('Very high step count may lead to overfitting');
    }
  }

  // LoRA rank validation
  if (params.lora_rank) {
    if (![8, 16, 32, 64, 128, 256].includes(params.lora_rank)) {
      errors.push('LoRA rank must be one of: 8, 16, 32, 64, 128, 256');
    }
    if (params.lora_rank > 128) {
      warnings.push('Very high LoRA rank increases training time and memory usage');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

function estimateTrainingCost(params, gpuHourlyRate = 0.50) {
  const baseTime = 10;
  const resolutionMultiplier = params.resolution === 1024 ? 1.5 : 
                              params.resolution === 768 ? 1.2 : 1.0;
  const stepsMultiplier = params.max_train_steps / 1000;
  const rankMultiplier = params.lora_rank / 32;
  
  const estimatedMinutes = baseTime * resolutionMultiplier * stepsMultiplier * rankMultiplier;
  const estimatedCost = (estimatedMinutes / 60) * gpuHourlyRate;

  return {
    estimatedMinutes: Math.round(estimatedMinutes),
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    breakdown: {
      baseTime,
      resolutionMultiplier,
      stepsMultiplier,
      rankMultiplier
    }
  };
}

// Test functions
function testParameterSelection() {
  console.log('🧪 Testing Parameter Selection Logic...\n');

  const testCases = [
    {
      name: 'Premium Quality - Many High-Quality Images',
      imageCount: 10,
      qualityMetrics: {
        averageResolution: 1024,
        faceDetectionScore: 0.9,
        imageVariety: 0.8,
        lightingQuality: 0.9
      },
      userPreference: 'quality',
      expectedQuality: 'premium'
    },
    {
      name: 'High Quality - Good Images',
      imageCount: 7,
      qualityMetrics: {
        averageResolution: 1024,
        faceDetectionScore: 0.8,
        imageVariety: 0.7,
        lightingQuality: 0.8
      },
      userPreference: 'balanced',
      expectedQuality: 'high'
    },
    {
      name: 'Standard Quality - Average Images',
      imageCount: 6,
      qualityMetrics: {
        averageResolution: 768,
        faceDetectionScore: 0.7,
        imageVariety: 0.6,
        lightingQuality: 0.6
      },
      userPreference: 'balanced',
      expectedQuality: 'standard'
    },
    {
      name: 'Basic Quality - Few Images, Speed Priority',
      imageCount: 4,
      qualityMetrics: {
        averageResolution: 512,
        faceDetectionScore: 0.6,
        imageVariety: 0.4,
        lightingQuality: 0.5
      },
      userPreference: 'speed',
      expectedQuality: 'basic'
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  testCases.forEach((testCase, index) => {
    console.log(`📋 Test ${index + 1}: ${testCase.name}`);
    
    const result = selectOptimalParameters(
      testCase.imageCount,
      testCase.qualityMetrics,
      testCase.userPreference
    );

    const passed = result.qualityLevel === testCase.expectedQuality;
    
    console.log(`   Image count: ${testCase.imageCount}`);
    console.log(`   User preference: ${testCase.userPreference}`);
    console.log(`   Expected quality: ${testCase.expectedQuality}`);
    console.log(`   Selected quality: ${result.qualityLevel}`);
    console.log(`   Selected preset: ${result.name}`);
    console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    
    if (passed) passedTests++;
    console.log('');
  });

  console.log(`📊 Parameter Selection Tests: ${passedTests}/${totalTests} passed\n`);
  return passedTests === totalTests;
}

function testParameterValidation() {
  console.log('🧪 Testing Parameter Validation...\n');

  const testCases = [
    {
      name: 'Valid Premium Parameters',
      params: PARAMETER_SETS.premium_quality.params,
      expectValid: true
    },
    {
      name: 'Invalid Resolution',
      params: { ...PARAMETER_SETS.high_quality.params, resolution: 2048 },
      expectValid: false
    },
    {
      name: 'Invalid Learning Rate (Too High)',
      params: { ...PARAMETER_SETS.standard_quality.params, learning_rate: 1e-2 },
      expectValid: false
    },
    {
      name: 'Invalid LoRA Rank',
      params: { ...PARAMETER_SETS.basic_quality.params, lora_rank: 100 },
      expectValid: false
    },
    {
      name: 'Warning Case - High Learning Rate',
      params: { ...PARAMETER_SETS.high_quality.params, learning_rate: 3e-4 },
      expectValid: true,
      expectWarnings: true
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  testCases.forEach((testCase, index) => {
    console.log(`📋 Test ${index + 1}: ${testCase.name}`);
    
    const validation = validateTrainingParameters(testCase.params);
    
    const validationPassed = validation.isValid === testCase.expectValid;
    const warningsPassed = !testCase.expectWarnings || validation.warnings.length > 0;
    const passed = validationPassed && warningsPassed;
    
    console.log(`   Expected valid: ${testCase.expectValid}`);
    console.log(`   Actually valid: ${validation.isValid}`);
    console.log(`   Errors: ${validation.errors.length}`);
    console.log(`   Warnings: ${validation.warnings.length}`);
    
    if (validation.errors.length > 0) {
      console.log(`   Error details: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      console.log(`   Warning details: ${validation.warnings.join(', ')}`);
    }
    
    console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    
    if (passed) passedTests++;
    console.log('');
  });

  console.log(`📊 Parameter Validation Tests: ${passedTests}/${totalTests} passed\n`);
  return passedTests === totalTests;
}

function testCostEstimation() {
  console.log('🧪 Testing Cost Estimation...\n');

  const testCases = [
    {
      name: 'Premium Quality Cost',
      params: PARAMETER_SETS.premium_quality.params,
      expectedRange: { min: 0.30, max: 0.80 }
    },
    {
      name: 'High Quality Cost',
      params: PARAMETER_SETS.high_quality.params,
      expectedRange: { min: 0.20, max: 0.60 }
    },
    {
      name: 'Standard Quality Cost',
      params: PARAMETER_SETS.standard_quality.params,
      expectedRange: { min: 0.10, max: 0.40 }
    },
    {
      name: 'Basic Quality Cost',
      params: PARAMETER_SETS.basic_quality.params,
      expectedRange: { min: 0.05, max: 0.25 }
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  testCases.forEach((testCase, index) => {
    console.log(`📋 Test ${index + 1}: ${testCase.name}`);
    
    const estimate = estimateTrainingCost(testCase.params);
    
    const costInRange = estimate.estimatedCost >= testCase.expectedRange.min && 
                       estimate.estimatedCost <= testCase.expectedRange.max;
    
    console.log(`   Estimated time: ${estimate.estimatedMinutes} minutes`);
    console.log(`   Estimated cost: $${estimate.estimatedCost}`);
    console.log(`   Expected range: $${testCase.expectedRange.min} - $${testCase.expectedRange.max}`);
    console.log(`   Resolution multiplier: ${estimate.breakdown.resolutionMultiplier}`);
    console.log(`   Steps multiplier: ${estimate.breakdown.stepsMultiplier.toFixed(2)}`);
    console.log(`   Rank multiplier: ${estimate.breakdown.rankMultiplier.toFixed(2)}`);
    console.log(`   Result: ${costInRange ? '✅ PASS' : '❌ FAIL'}`);
    
    if (costInRange) passedTests++;
    console.log('');
  });

  console.log(`📊 Cost Estimation Tests: ${passedTests}/${totalTests} passed\n`);
  return passedTests === totalTests;
}

function testABTestingLogic() {
  console.log('🧪 Testing A/B Testing Logic...\n');

  // Simple hash function for testing
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // Test user assignment consistency
  const testUsers = ['user1', 'user2', 'user3', 'user4', 'user5'];
  const testId = 'lora-rank-test';
  
  console.log('📋 Testing User Assignment Consistency');
  
  let consistentAssignments = 0;
  
  testUsers.forEach(userId => {
    const hash1 = hashString(userId + testId) % 100;
    const hash2 = hashString(userId + testId) % 100;
    
    const consistent = hash1 === hash2;
    console.log(`   User ${userId}: Hash ${hash1} (consistent: ${consistent ? '✅' : '❌'})`);
    
    if (consistent) consistentAssignments++;
  });

  console.log(`   Consistency: ${consistentAssignments}/${testUsers.length} users\n`);

  // Test traffic split distribution
  console.log('📋 Testing Traffic Split Distribution');
  
  const sampleSize = 1000;
  const buckets = { variant1: 0, variant2: 0 };
  
  for (let i = 0; i < sampleSize; i++) {
    const userId = `testuser${i}`;
    const hash = hashString(userId + testId) % 100;
    
    if (hash < 50) {
      buckets.variant1++;
    } else {
      buckets.variant2++;
    }
  }
  
  const variant1Percent = (buckets.variant1 / sampleSize) * 100;
  const variant2Percent = (buckets.variant2 / sampleSize) * 100;
  
  console.log(`   Variant 1: ${buckets.variant1} users (${variant1Percent.toFixed(1)}%)`);
  console.log(`   Variant 2: ${buckets.variant2} users (${variant2Percent.toFixed(1)}%)`);
  
  const distributionGood = Math.abs(variant1Percent - 50) < 5 && Math.abs(variant2Percent - 50) < 5;
  console.log(`   Distribution quality: ${distributionGood ? '✅ GOOD' : '❌ POOR'}\n`);

  console.log(`📊 A/B Testing Logic: ${consistentAssignments === testUsers.length && distributionGood ? '✅ PASS' : '❌ FAIL'}\n`);
  
  return consistentAssignments === testUsers.length && distributionGood;
}

// Run all tests
async function runAllUnitTests() {
  console.log('🚀 Starting Parameter Optimization Unit Tests\n');
  console.log('=' .repeat(60));
  
  const results = {
    parameterSelection: testParameterSelection(),
    parameterValidation: testParameterValidation(),
    costEstimation: testCostEstimation(),
    abTestingLogic: testABTestingLogic()
  };
  
  console.log('=' .repeat(60));
  console.log('📊 Final Results:');
  console.log(`   Parameter Selection: ${results.parameterSelection ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Parameter Validation: ${results.parameterValidation ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Cost Estimation: ${results.costEstimation ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   A/B Testing Logic: ${results.abTestingLogic ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result);
  console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);
  
  return allPassed;
}

// Execute tests if run directly
if (require.main === module) {
  runAllUnitTests().catch(console.error);
}

module.exports = {
  testParameterSelection,
  testParameterValidation,
  testCostEstimation,
  testABTestingLogic,
  runAllUnitTests
};